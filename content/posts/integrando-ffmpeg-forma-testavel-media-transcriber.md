---
title: "Integrando FFmpeg de forma testável no Media Transcriber"
date: 2026-11-11
draft: false
toc: true
slug: "integrando-ffmpeg-forma-testavel-media-transcriber"
description: "Como integrei FFmpeg ao Media Transcriber com subprocess, áudio padronizado, proteção da saída e testes unitários e de integração."
tags:
  - python
  - ffmpeg
  - subprocess
  - testes
  - pytest
  - engenharia-de-software
topics:
  - Engenharia de Software
series:
  - Media Transcriber
series_order: 4
---

No [artigo anterior](/posts/cli-python-testes-media-transcriber/), a primeira CLI do Media Transcriber passou a receber um caminho, validar a existência do arquivo e verificar sua extensão.

Isso estabeleceu uma entrada para a aplicação. Ainda faltava lidar com o conteúdo: um arquivo vazio chamado `video.mp4` passava pela validação inicial, porque nenhuma ferramenta tentava abrir a mídia.

A [`v0.3.0`](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.3.0) introduz essa próxima etapa com FFmpeg. A aplicação agora converte áudio e vídeo para um formato intermediário padronizado, que poderá alimentar a transcrição.

O problema de Engenharia de Software também muda. Ao executar um programa externo, a aplicação passa a depender de sua instalação, de seus códigos de retorno, das mensagens de erro e dos arquivos que ele deixa no disco.

Este artigo acompanha o código da tag `v0.3.0`. A transcrição fica para o próximo incremento da série.

## O que a versão entrega

O fluxo passa a ser:

```text
CLI → validação da entrada → extração com FFmpeg → arquivo WAV
```

As extensões aceitas continuam sendo `.m4a`, `.mp3`, `.wav`, `.mkv`, `.mp4` e `.webm`. A diferença é que, depois dessa primeira validação, o FFmpeg precisa conseguir ler a mídia e produzir áudio.

Todas as entradas, inclusive arquivos que já são de áudio, passam pela conversão para o mesmo formato:

| Propriedade | Formato intermediário |
|---|---|
| Contêiner | WAV |
| Codec | PCM de 16 bits com sinal, little-endian (`pcm_s16le`) |
| Taxa de amostragem | 16.000 Hz |
| Canais | Mono |

Essa escolha oferece um contrato simples para a próxima etapa. O componente de transcrição receberá áudio com características conhecidas, sem precisar decidir como tratar cada formato original.

Aqui, padronizar significa converter formato, taxa de amostragem e canais. A versão não implementa normalização de volume, redução de ruído ou melhoria da gravação.

## Separar a integração da interface

A CLI permanece responsável pelos argumentos, mensagens e códigos de saída. A integração foi concentrada em [`audio.py`](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/src/media_transcriber/audio.py), com funções para localizar o executável, montar argumentos, executar o processo e coordenar a extração.

Não foi necessário criar uma hierarquia de classes. As funções delimitam as responsabilidades e permitem substituir a execução externa durante os testes.

A localização do FFmpeg usa `shutil.which()`:

```python
def find_ffmpeg() -> str | None:
    return shutil.which(FFMPEG_EXECUTABLE)
```

Se o executável não estiver no `PATH`, a aplicação levanta `AudioExtractionError` com uma orientação de instalação. Ter o pacote Python instalado, portanto, não basta: o FFmpeg é uma dependência do ambiente.

## Executar o processo com argumentos explícitos

A função que inicia o processo tem um escopo pequeno:

```python
FFMPEG_BASE_ARGS = ("-hide_banner", "-nostdin", "-loglevel", "error")


def run_ffmpeg(
    executable: str, args: Sequence[str]
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [executable, *FFMPEG_BASE_ARGS, *args],
        capture_output=True,
        text=True,
        check=False,
    )
```

O comando é passado como uma lista, sem ativar um shell. Assim, um caminho com espaços continua sendo um único argumento. A [documentação de `subprocess`](https://docs.python.org/3/library/subprocess.html) também recomenda sequências de argumentos para que o módulo cuide dessa passagem.

As opções de execução tornam o comportamento adequado à CLI: `-nostdin` desabilita a interação pela entrada padrão; `-hide_banner` remove o banner; `-loglevel error` reduz a saída aos erros.

Com `capture_output=True` e `text=True`, a função devolve as saídas capturadas como texto. Já `check=False` permite que a aplicação examine `returncode` e `stderr` antes de construir sua própria mensagem de falha.

Essa função executa e devolve o resultado. A decisão sobre o significado desse resultado fica na coordenação da extração.

## Construir o comando sem executar FFmpeg

A montagem dos argumentos é independente do subprocesso:

```python
def build_extraction_args(input_path: Path, output_path: Path) -> list[str]:
    return [
        "-i", str(input_path),
        "-vn", "-sn", "-dn",
        "-ac", str(INTERMEDIATE_AUDIO_CHANNELS),
        "-ar", str(INTERMEDIATE_AUDIO_SAMPLE_RATE),
        "-c:a", INTERMEDIATE_AUDIO_CODEC,
        "-f", INTERMEDIATE_AUDIO_CONTAINER,
        str(output_path),
    ]
```

As opções `-vn`, `-sn` e `-dn` descartam vídeo, legendas e dados na saída. As demais definem o áudio intermediário, conforme a [documentação do FFmpeg](https://ffmpeg.org/ffmpeg.html).

O comando não informa `-map`, portanto a escolha da trilha de áudio segue a seleção automática do FFmpeg. Em uma mídia com várias trilhas, esta versão não permite escolher idioma ou combinar trilhas; converter para mono altera os canais da trilha selecionada.

Informar `-f wav` também deixa explícito o contêiner. O conteúdo gerado permanece WAV mesmo se o usuário fornecer outro sufixo em `--output`; a CLI desta versão não exige a extensão `.wav` no destino. Usar esse sufixo evita uma identificação enganosa do arquivo.

Separar a montagem permite testar as opções de conversão sem instalar ou executar FFmpeg. Mas conferir a lista de argumentos é apenas uma parte da validação: ainda precisamos verificar o arquivo produzido pela ferramenta real.

## Proteger o arquivo de saída

Por padrão, `video.mp4` gera `video.wav` no mesmo diretório. O usuário pode escolher outro caminho com `--output` e autorizar a substituição de uma saída existente com `--overwrite`.

Antes de iniciar a conversão, `resolve_output_path()` verifica se:

- entrada e saída resolvem para caminhos diferentes;
- o diretório de destino existe;
- o destino não é um diretório;
- uma saída existente só será substituída com `--overwrite`.

Isso produz um caso que merece atenção: ao receber `audio.wav`, o destino padrão seria o próprio arquivo de entrada. A aplicação rejeita essa operação e pede outro caminho:

```bash
media-transcriber audio.wav --output audio-preparado.wav
```

A proteção seguinte trata uma conversão interrompida por erro. O FFmpeg grava primeiro em um temporário criado com `tempfile.mkstemp()` no diretório de destino. O nome tem um sufixo como `.partial.wav`.

Somente depois de o FFmpeg devolver código `0` a aplicação executa:

```python
partial_path.replace(destination)
```

A limpeza fica em um bloco `finally`:

```python
finally:
    partial_path.unlink(missing_ok=True)
```

Se o FFmpeg falhar, o temporário é removido. Uma saída anterior permanece preservada, inclusive quando a execução foi iniciada com `--overwrite`.

O comando interno utiliza `-y` porque o temporário já foi criado por Python e precisa ser preenchido pelo FFmpeg. A autorização para substituir o destino final é verificada antes, pela aplicação.

Essa abordagem cobre as falhas tratadas durante a execução normal. Uma interrupção abrupta do processo pode impedir o `finally`, e a verificação de existência não implementa exclusão mútua entre duas extrações concorrentes para o mesmo destino.

## Transformar falhas externas em respostas da CLI

Uma integração precisa explicar tanto a ausência do executável quanto a rejeição de uma mídia.

A implementação diferencia alguns cenários pelo conteúdo de `stderr`: ausência de streams, entrada ilegível ou corrompida e falha genérica. A mensagem inclui um resumo do diagnóstico do FFmpeg, removendo prefixos com endereços de memória quando presentes.

Essas classificações são heurísticas baseadas em mensagens da ferramenta. Não constituem uma análise completa da mídia nem um contrato estável de todas as versões do FFmpeg. Há um tratamento genérico para os demais retornos de erro.

Na CLI, os resultados e erros tratados ficam assim:

| Código | Situação |
|---|---|
| `0` | Extração concluída; caminho informado em `stdout` |
| `1` | `AudioExtractionError`, incluindo rejeição do destino ou falha do FFmpeg, informada em `stderr` |
| `2` | Entrada rejeitada pela validação inicial ou pelos argumentos |

Um arquivo inexistente resulta em `2`. Um `.mp4` existente, mas corrompido, passa pela validação inicial e falha na extração com `1`.

Essa distinção ajuda quem executa o comando manualmente e quem precisa utilizá-lo em um script.

O tratamento ainda tem um limite: erros do sistema de arquivos ao criar o temporário, substituir o destino ou remover o parcial não são convertidos em `AudioExtractionError` e podem exibir um traceback. A execução também não define um `timeout`. Esses pontos ficam como melhorias para tornar o comportamento mais previsível em outros ambientes.

## Testes unitários para as decisões da aplicação

Os [testes de áudio](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/tests/test_audio.py) usam `monkeypatch` para substituir a localização do executável e a chamada a `subprocess.run()`.

O processo simulado devolve um `CompletedProcess` e escreve conteúdo no caminho temporário recebido. Isso permite observar o ciclo dos arquivos, além de conferir os argumentos enviados.

Os cenários incluem executável ausente, falha ao iniciar o processo, destino inválido, saída existente, conversão bem-sucedida e limpeza após erro.

Um teste especialmente útil verifica a preservação da saída anterior:

```python
fake_ffmpeg(monkeypatch, returncode=1)
existing = media_file.with_suffix(".wav")
existing.write_bytes(b"old audio")

with pytest.raises(audio.AudioExtractionError):
    audio.extract_audio(media_file, overwrite=True)

assert existing.read_bytes() == b"old audio"
```

Esse teste observa uma consequência relevante para o usuário: uma tentativa malsucedida não deve destruir o resultado anterior.

O processo simulado não produz um WAV verdadeiro. Por isso, esses testes comprovam as decisões da aplicação, mas precisam ser complementados pela integração real.

## Testes de integração com mídia sintética

Em [`test_audio_integration.py`](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/tests/test_audio_integration.py), o próprio FFmpeg gera mídias curtas durante os testes.

As fontes `lavfi` produzem um tom de 440 Hz e um vídeo de teste, ambos com duração de um segundo. Isso dispensa arquivos pessoais e downloads de amostras.

Depois da extração, o módulo `wave` da biblioteca padrão abre a saída e verifica:

```python
with wave.open(str(path), "rb") as wav_file:
    assert wav_file.getnchannels() == audio.INTERMEDIATE_AUDIO_CHANNELS
    assert wav_file.getframerate() == audio.INTERMEDIATE_AUDIO_SAMPLE_RATE
    assert wav_file.getsampwidth() == 2
    duration = wav_file.getnframes() / wav_file.getframerate()

assert duration == pytest.approx(DURATION_SECONDS, abs=0.1)
```

Agora existe uma evidência sobre o conteúdo: o arquivo pode ser aberto como WAV, tem um canal, 16 kHz, amostras de dois bytes e duração compatível com a entrada.

Os nove casos de integração cobrem extração de vídeo, conversão de MP3, M4A e WAV, vídeo sem áudio, três entradas ilegíveis e o fluxo da CLI chamando `main()` com FFmpeg real. Este último não inicia o comando instalado em outro processo; seu alcance é a integração da função principal com a conversão.

## Fazer a integração acontecer na pipeline

Os testes recebem a marca `integration` e são ignorados quando o FFmpeg não está disponível. Isso facilita a execução local, mas exige cuidado na CI: uma pipeline sem a dependência poderia terminar sem exercitar a conversão.

Na configuração da `v0.3.0`, o job de testes usa `python:3.11-slim` e instala FFmpeg antes de executar `pytest -rs`. A opção `-rs` mostra os motivos dos testes ignorados.

Localmente, os grupos podem ser executados separadamente:

```bash
pytest -m "not integration"
pytest -m integration
```

Linting, formatação e análise estática continuam com Ruff e mypy. A integração externa passa a fazer parte das verificações sem misturar a responsabilidade de cada ferramenta.

Na revisão deste artigo, em 11/11/2026, a tag `v0.3.0` (commit `8adc58e`) foi instalada em um ambiente virtual novo com Python 3.12.3 e FFmpeg 6.1.1. Os 56 testes passaram, incluindo os nove de integração com FFmpeg real e o teste da versão instalada. Ruff, verificação de formatação e mypy também passaram. A cobertura reportada foi de 100% de linhas e branches no código medido; isso não cobre, por exemplo, os limites de concorrência e de tratamento de erros de escrita descritos acima.

## Reproduzir a versão do artigo

Para acompanhar este incremento, use a tag correspondente em um diretório novo, com Python 3.11 ou superior e FFmpeg disponível no `PATH`. Os comandos abaixo usam Bash e um ambiente virtual próprio para evitar que metadados de outra versão interfiram na validação:

```bash
git clone --branch v0.3.0 --depth 1 \
  https://gitlab.com/dirleiflsilva/media-transcriber.git \
  media-transcriber-v0.3.0
cd media-transcriber-v0.3.0

python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

ffmpeg -version
pytest -rs
ruff check .
ruff format --check .
mypy
```

Uma execução com mídia própria pode usar:

```bash
media-transcriber entrevista.mp4
media-transcriber entrevista.mp4 --output entrevista-preparada.wav
```

O diretório escolhido precisa existir. Para substituir uma saída anterior, acrescente `--overwrite`.

## O aprendizado deste incremento

A `v0.3.0` acrescenta processamento real ao Media Transcriber. Junto da conversão, surgem decisões sobre dependências do ambiente, falhas externas e preservação dos arquivos do usuário.

A separação em funções pequenas permite testar essas decisões com rapidez. Os testes com FFmpeg real complementam essa verificação ao inspecionar o áudio produzido. O temporário mantém a escrita parcial afastada do destino final durante uma conversão que pode falhar.

Com isso, a aplicação passa a entregar um WAV padronizado. O próximo problema da série será consumir esse áudio em um mecanismo de Speech-to-Text, mantendo a integração separada da interface de linha de comando.

## Referências

- [Media Transcriber — tag v0.3.0](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.3.0)
- [Integração com FFmpeg](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/src/media_transcriber/audio.py)
- [CLI na v0.3.0](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/src/media_transcriber/cli.py)
- [Testes unitários de áudio](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/tests/test_audio.py)
- [Testes de integração](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/tests/test_audio_integration.py)
- [Pipeline GitLab CI](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/.gitlab-ci.yml)
- [README da v0.3.0](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.3.0/README.md)
- [Documentação de subprocess](https://docs.python.org/3/library/subprocess.html)
- [Documentação do FFmpeg: opções e seleção de streams](https://ffmpeg.org/ffmpeg.html)
