---
title: "CLI em Python com testes: a primeira funcionalidade do Media Transcriber"
date: 2026-10-28
draft: false
toc: true
slug: "cli-python-testes-media-transcriber"
description: "Como construí a primeira CLI do Media Transcriber com argparse, validação de arquivos, códigos de saída previsíveis, testes automatizados e tipagem estática."
tags:
  - python
  - cli
  - argparse
  - testes
  - pytest
  - engenharia-de-software
topics:
  - Engenharia de Software
series:
  - Media Transcriber
series_order: 3
---

No artigo anterior, mostrei como a [`v0.1.0` estabeleceu a fundação do Media Transcriber](/posts/fundacao-projeto-python-qualidade-ci/) com estrutura de pacote, pytest, Ruff, mypy, pre-commit e uma pipeline no GitLab.

Ainda não existia uma funcionalidade para o usuário. A aplicação podia ser instalada e validada, mas não recebia um arquivo de mídia.

A [`v0.2.0`](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.2.0) usa essa base para entregar o primeiro fluxo executável do projeto: uma interface de linha de comando capaz de receber um caminho, validar o arquivo e comunicar o resultado por mensagem e código de saída.

```text
media-transcriber caminho/para/video.mp4
        ↓
interpretação dos argumentos
        ↓
validação do caminho e da extensão
        ↓
mensagem + código de saída
```

É um incremento pequeno. Ainda não há FFmpeg nem transcrição. Justamente por isso, ele oferece um recorte claro para estudar responsabilidades, erros de entrada, testabilidade e o contrato de uma CLI.

## O escopo da v0.2.0

O roadmap chama esta milestone de **Entrada de Mídia**. Seu resultado esperado é que a aplicação consiga receber e validar corretamente um arquivo.

Nesta versão, a CLI verifica:

- se um caminho foi informado;
- se o caminho existe;
- se ele representa um arquivo, e não um diretório;
- se possui uma das extensões aceitas;
- se a extensão é reconhecida com letras maiúsculas ou minúsculas.

Os formatos admitidos são:

| Categoria | Extensões |
|---|---|
| Áudio | `.m4a`, `.mp3`, `.wav` |
| Vídeo | `.mkv`, `.mp4`, `.webm` |

A aceitação da extensão não significa que o conteúdo já tenha sido inspecionado ou processado. Um arquivo vazio chamado `exemplo.mp3`, por exemplo, passa por esta etapa porque o objetivo da milestone é validar a entrada inicial, não decodificar a mídia.

Ficaram fora de propósito:

- inspeção do conteúdo do arquivo;
- detecção por MIME type;
- integração com FFmpeg;
- extração de áudio;
- transcrição;
- criação de arquivos de saída.

Essa delimitação impede que a primeira funcionalidade tente resolver várias etapas do roadmap ao mesmo tempo.

## Registrando um comando instalável

O `pyproject.toml` declara o ponto de entrada da aplicação:

```toml
[project.scripts]
media-transcriber = "media_transcriber.cli:main"
```

Depois da instalação do pacote, o ambiente cria o comando `media-transcriber` e direciona sua execução para a função `main()` do módulo `media_transcriber.cli`.

O mesmo fluxo também pode ser iniciado como módulo:

```bash
python -m media_transcriber caminho/para/audio.mp3
```

Para isso, o pacote contém um `__main__.py` pequeno:

```python
from media_transcriber.cli import main

raise SystemExit(main())
```

As duas formas chegam à mesma função. Não há uma implementação para o comando instalado e outra para `python -m`; existe um único ponto de entrada reutilizado por ambas.

O `SystemExit` transforma o inteiro devolvido por `main()` no código observado pelo processo que chamou a aplicação.

## Interpretando argumentos com a biblioteca padrão

A CLI usa `argparse`, disponível na biblioteca padrão do Python:

```python
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="media-transcriber",
        description="Valida um arquivo de áudio ou vídeo para transcrição.",
    )
    parser.add_argument(
        "media_file",
        type=Path,
        help="caminho do arquivo de mídia",
    )
    return parser
```

O argumento `media_file` é posicional e obrigatório. Definir `type=Path` faz com que a camada de CLI entregue um objeto `pathlib.Path` à aplicação, em vez de manter o caminho como uma string sem semântica específica.

O próprio `argparse` fornece a ajuda:

```console
$ media-transcriber --help
usage: media-transcriber [-h] media_file

Valida um arquivo de áudio ou vídeo para transcrição.

positional arguments:
  media_file  caminho do arquivo de mídia

options:
  -h, --help  show this help message and exit
```

Ele também trata a ausência do argumento obrigatório. Nesse caso, imprime o uso em `stderr` e encerra com código `2` antes que a validação de mídia seja chamada.

Para esta interface pequena, usar a biblioteca padrão evita introduzir uma dependência externa antes de existir uma necessidade concreta de grupos de comandos, subcomandos ou recursos adicionais.

## Separando a interface da validação

Seria possível verificar o arquivo dentro da própria função `main()`. A implementação separa as responsabilidades em dois módulos:

```text
cli.py
├── interpreta argumentos
├── chama a validação
└── traduz o resultado para terminal e código de saída

media.py
├── conhece as extensões aceitas
├── verifica o caminho
└── devolve o Path absoluto ou lança um erro de validação
```

A função principal fica assim:

```python
def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        media_path = validate_media_file(args.media_file)
    except MediaValidationError as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2

    print(f"Arquivo de mídia válido: {media_path}")
    return 0
```

O parâmetro `argv` merece atenção. Quando recebe `None`, o `argparse` usa os argumentos reais do processo. Nos testes, é possível passar uma sequência explícita:

```python
main(["caminho/para/arquivo.mp3"])
```

Isso permite testar a função sem alterar globalmente `sys.argv` e sem iniciar um subprocesso para cada cenário.

A CLI ainda tem uma responsabilidade importante: converter uma exceção da aplicação em uma mensagem apropriada para o terminal e em um código de saída previsível.

## Uma exceção específica para entradas inválidas

O módulo de mídia define um erro próprio:

```python
class MediaValidationError(ValueError):
    """Raised when an input path is not a supported media file."""
```

Essa exceção diferencia falhas esperadas de entrada de outros erros de programação ou de infraestrutura.

A função `main()` captura apenas `MediaValidationError`. Ela não usa um `except Exception` genérico que poderia esconder defeitos inesperados e apresentá-los como se fossem apenas um arquivo inválido.

Esse contrato também desacopla o núcleo de validação da saída no terminal. `validate_media_file()` não imprime mensagens nem decide o código do processo; ela devolve um caminho válido ou informa por exceção por que a validação falhou.

## Validando o caminho em etapas

As extensões suportadas ficam em um conjunto imutável:

```python
SUPPORTED_EXTENSIONS = frozenset(
    {".m4a", ".mkv", ".mp3", ".mp4", ".wav", ".webm"}
)
```

O uso de `frozenset` expressa que a coleção é uma configuração fixa desta versão. Para a verificação de pertencimento, a ordem das extensões não é relevante.

A validação começa aceitando uma string ou um `Path`:

```python
def validate_media_file(path: str | Path) -> Path:
    media_path = Path(path).expanduser()
```

`expanduser()` permite interpretar caminhos iniciados com `~` conforme o diretório pessoal do usuário. Depois, três condições são avaliadas.

### O caminho precisa existir

```python
if not media_path.exists():
    raise MediaValidationError(
        f"Arquivo não encontrado: {media_path}"
    )
```

Uma extensão válida não torna um caminho inexistente aceitável. Essa verificação ocorre antes da análise do sufixo para produzir um diagnóstico coerente com a causa mais imediata.

### O caminho precisa ser um arquivo

```python
if not media_path.is_file():
    raise MediaValidationError(
        f"O caminho informado não é um arquivo: {media_path}"
    )
```

Um diretório chamado `videos.mp4` ainda é um diretório. Conferir somente o nome ou a extensão deixaria esse caso passar.

### A extensão precisa ser suportada

```python
extension = media_path.suffix.lower()

if extension not in SUPPORTED_EXTENSIONS:
    supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
    extension_label = extension or "sem extensão"
    raise MediaValidationError(
        f"Formato não suportado ({extension_label}). "
        f"Formatos aceitos: {supported}"
    )
```

Converter o sufixo para minúsculas permite aceitar tanto `video.mp4` quanto `video.MP4`. Quando não existe sufixo, a mensagem usa “sem extensão” em vez de exibir um valor vazio.

Se todas as verificações passam, a função devolve o caminho absoluto:

```python
return media_path.resolve()
```

Isso oferece à próxima etapa da aplicação uma referência normalizada para o arquivo, sem depender do diretório em que o comando foi chamado posteriormente.

## Saída padrão, saída de erro e códigos de processo

Uma CLI não se comunica apenas pelo texto que uma pessoa lê. Scripts, pipelines e outras ferramentas também observam seus streams e códigos de saída.

O contrato desta versão é:

| Situação | Stream | Código |
|---|---|---:|
| Arquivo aceito | `stdout` | `0` |
| Arquivo rejeitado pela validação | `stderr` | `2` |
| Argumento obrigatório ausente | `stderr`, pelo `argparse` | `2` |

Exemplo de sucesso:

```console
$ media-transcriber samples/reuniao.mp3
Arquivo de mídia válido: /caminho/absoluto/samples/reuniao.mp3
$ echo $?
0
```

Exemplo de falha:

```console
$ media-transcriber samples/anotacoes.txt
Erro: Formato não suportado (.txt). Formatos aceitos: .m4a, .mkv, .mp3, .mp4, .wav, .webm
$ echo $?
2
```

Separar `stdout` e `stderr` permite redirecionar o resultado normal sem misturá-lo aos diagnósticos. O código diferente de zero permite que uma automação interrompa o fluxo sem precisar interpretar a frase exibida.

O código `2` é usado tanto pelo `argparse` para uso incorreto quanto pela validação para entrada recusada. Em uma CLI maior, talvez faça sentido distinguir mais categorias. Para o contrato pequeno desta milestone, os testes registram explicitamente a decisão atual.

## Testando a validação sem depender de arquivos reais de mídia

Os testes usam a fixture `tmp_path` do pytest. Cada cenário recebe um diretório temporário isolado e pode criar apenas os caminhos necessários.

O caso parametrizado percorre todas as extensões suportadas:

```python
@pytest.mark.parametrize("extension", sorted(SUPPORTED_EXTENSIONS))
def test_accepts_supported_media_files(
    tmp_path: Path,
    extension: str,
) -> None:
    media_file = tmp_path / f"sample{extension}"
    media_file.touch()

    assert validate_media_file(media_file) == media_file.resolve()
```

O teste não precisa manter arquivos binários de áudio e vídeo no repositório porque essa versão não inspeciona seus conteúdos. Criar arquivos vazios é coerente com a regra efetivamente implementada.

Outros cenários verificam:

- extensão em letras maiúsculas;
- arquivo inexistente;
- diretório no lugar de arquivo;
- extensão não suportada;
- arquivo sem extensão.

Cada teste observa o comportamento público da função, incluindo a mensagem relevante da exceção.

## Testando a CLI como função

Os testes da interface chamam `main()` com argumentos explícitos e usam `capsys` para capturar `stdout` e `stderr`.

No caminho de sucesso:

```python
def test_cli_accepts_valid_media_file(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    media_file = tmp_path / "sample.mp3"
    media_file.touch()

    exit_code = main([str(media_file)])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert str(media_file.resolve()) in captured.out
    assert captured.err == ""
```

O teste não verifica apenas o inteiro devolvido. Ele confirma que a mensagem foi para o stream correto e contém o caminho absoluto esperado.

Para um arquivo inexistente, o contrato muda:

```python
exit_code = main([str(tmp_path / "missing.mp4")])

captured = capsys.readouterr()
assert exit_code == 2
assert "Arquivo não encontrado" in captured.err
assert captured.out == ""
```

O caso sem argumentos é diferente porque o `argparse` lança `SystemExit`. O teste captura essa saída, verifica o código `2` e procura o uso do comando em `stderr`.

Essa diferença documenta qual camada encerra cada cenário: a aplicação devolve um código para erros de validação; o parser controla erros na própria sintaxe da linha de comando.

## Reaproveitando a fundação da versão anterior

A funcionalidade entrou no mesmo fluxo de qualidade estabelecido na `v0.1.0`:

```bash
ruff check .
ruff format --check .
mypy
pytest
```

Na reprodução da tag `v0.2.0`, os resultados foram:

- Ruff: nenhuma ocorrência;
- formatação: 11 arquivos já formatados;
- mypy em modo estrito: nenhuma inconsistência em oito arquivos;
- pytest: 15 testes aprovados;
- cobertura total: 95%;
- `cli.py`: 100% de cobertura;
- `media.py`: 100% de cobertura.

Os dois pontos não cobertos estão em `__main__.py`. Os testes chamam `main()` diretamente, portanto validam o comportamento da CLI sem executar o módulo como um novo processo.

Essa é uma limitação conhecida da cobertura atual. Um teste de subprocesso poderia exercer `python -m media_transcriber` e o comando instalado, verificando a integração do entry point de ponta a ponta. Para o recorte desta milestone, o pacote, o registro do script e a função principal permanecem separados e pequenos.

## O que este incremento ensina

A primeira funcionalidade do Media Transcriber não exigiu uma arquitetura sofisticada. Ainda assim, algumas decisões tornam sua evolução mais segura:

- o entry point é declarado pelo pacote;
- as duas formas de execução reutilizam a mesma função;
- a interpretação de argumentos fica separada da regra de validação;
- uma exceção específica representa entradas rejeitadas;
- erros esperados não escondem exceções inesperadas;
- streams e códigos de saída formam um contrato observável;
- arquivos temporários tornam os testes isolados e reproduzíveis;
- a tipagem cobre tanto o código quanto os testes.

Essas escolhas são pequenas porque o problema ainda é pequeno. Elas não antecipam filas, adaptadores, casos de uso ou camadas que somente aparecerão nas próximas etapas.

## O limite entre validar o nome e validar a mídia

A `v0.2.0` identifica candidatos a arquivo de mídia. Ela não garante que o conteúdo corresponda à extensão.

Esse limite precisa permanecer explícito. Renomear `documento.txt` para `documento.mp3` é suficiente para passar pela regra atual, desde que o caminho exista e seja um arquivo.

Na próxima milestone, a integração com FFmpeg introduzirá uma verificação mais próxima do conteúdo real e novos tipos de falha:

- executável indisponível;
- formato inválido ou corrompido;
- arquivo sem stream de áudio;
- erro durante a extração;
- gerenciamento do arquivo intermediário.

Quando essas necessidades entrarem, a separação atual oferece um ponto de partida: a CLI recebe a entrada, a validação inicial prepara um `Path` e a integração externa pode evoluir sem concentrar todas as decisões em `main()`.

## Conclusão

A `v0.2.0` transforma o Media Transcriber de um pacote com infraestrutura de qualidade em uma aplicação que já pode ser chamada pelo usuário.

Ela ainda não transcreve. Seu primeiro contrato é mais fundamental:

```text
entrada válida   → mensagem em stdout → código 0
entrada inválida → mensagem em stderr → código 2
```

O valor deste incremento não está somente nas poucas linhas da CLI. Está na combinação entre um escopo explícito, responsabilidades pequenas e testes que observam o comportamento externo.

A fundação criada anteriormente permitiu que a funcionalidade entrasse acompanhada de linting, formatação, tipos, testes e cobertura. Agora, o projeto possui uma entrada estável para avançar ao próximo problema real: integrar o FFmpeg de forma testável e transformar vídeo em áudio preparado para transcrição.

## Referências

- [Media Transcriber — tag v0.2.0](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.2.0)
- [Implementação da CLI](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.2.0/src/media_transcriber/cli.py)
- [Validação de mídia](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.2.0/src/media_transcriber/media.py)
- [Testes da CLI](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.2.0/tests/test_cli.py)
- [Testes da validação](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.2.0/tests/test_media.py)
- [Roadmap do Media Transcriber](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/v0.2.0/ROADMAP.md)
- [Documentação do `argparse`](https://docs.python.org/3/library/argparse.html)
- [Documentação do `pathlib`](https://docs.python.org/3/library/pathlib.html)
