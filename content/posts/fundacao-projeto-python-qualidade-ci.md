---
title: "Como estruturei um projeto Python com qualidade e CI"
date: 2026-10-12
draft: false
toc: true
slug: "fundacao-projeto-python-qualidade-ci"
description: "Como estruturei a v0.1.0 do Media Transcriber com src layout, pytest, Ruff, mypy, pre-commit e uma pipeline de integração contínua no GitLab."
tags:
  - python
  - engenharia-de-software
  - testes
  - ci-cd
  - gitlab
  - ruff
  - mypy
  - pytest
topics:
  - Carreira e Aprendizado
  - Engenharia de Software
series:
  - Media Transcriber
series_order: 2
---

No [primeiro artigo sobre o Media Transcriber](/posts/media-transcriber-laboratorio-engenharia-software-python/), apresentei a ideia de transformar um projeto abandonado em um laboratório prático de Engenharia de Software com Python.

A evolução e os conteúdos relacionados também estão reunidos na [página do projeto Media Transcriber](/projects/media-transcriber/).

Mas a primeira versão não transcreve áudio, não processa vídeo nem oferece uma interface de linha de comando.

A [`v0.1.0`](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.1.0) faz algo menos visível e, ao mesmo tempo, essencial: estabelece a fundação sobre a qual as funcionalidades seguintes serão construídas.

Essa fundação inclui uma estrutura de pacote Python, gerenciamento de dependências, testes, cobertura, linting, formatação, análise estática de tipos, verificações locais e uma pipeline de integração contínua no GitLab.

O objetivo não era preencher o repositório com ferramentas. Era criar um caminho curto e reproduzível entre uma alteração no código e uma resposta objetiva:

> O projeto continua atendendo aos critérios de qualidade que defini para ele?

## O que significa uma versão sem funcionalidade de negócio

O roadmap separa a evolução do projeto em versões. A primeira é descrita assim:

```text
v0.1.0 — Fundação do Projeto
```

Seu resultado esperado não é uma aplicação útil para o usuário final. É um projeto preparado para receber funcionalidades com verificações automatizadas desde o início.

Essa escolha parece adiar o trabalho principal, mas evita que cada nova funcionalidade precise responder novamente às mesmas perguntas:

- onde fica o código da aplicação;
- como o pacote é instalado;
- onde os testes são escritos;
- quais regras de estilo são aplicadas;
- como a tipagem é verificada;
- quais comandos precisam passar antes de uma mudança ser integrada;
- como reproduzir essas verificações fora da máquina do desenvolvedor.

Ao concluir a fundação primeiro, as próximas versões passam a trabalhar dentro de um contrato já conhecido.

## O recorte exato da v0.1.0

A tag `v0.1.0` preserva o estado do repositório usado como referência neste artigo. Nesse estado, o projeto contém:

```text
media-transcriber/
├── .gitlab-ci.yml
├── .pre-commit-config.yaml
├── LICENSE
├── README.md
├── ROADMAP.md
├── docs/
│   └── vision.md
├── pyproject.toml
├── src/
│   └── media_transcriber/
│       └── __init__.py
└── tests/
    ├── __init__.py
    └── test_package.py
```

Ainda não existem CLI, validação de arquivos ou integração com FFmpeg. Esses elementos pertencem às versões seguintes.

Essa separação agora pode ser consultada por tags:

- `v0.1.0`: fundação do projeto;
- `v0.2.0`: entrada e validação de arquivos de mídia pela CLI.

Com isso, o artigo não precisa apontar para a branch `main`, que continuará mudando. A tag preserva o estado exato usado como referência.

## Uma configuração central com `pyproject.toml`

O arquivo `pyproject.toml` concentra os metadados do pacote e a configuração das principais ferramentas:

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "media-transcriber"
version = "0.1.0"
description = "Media processing and transcription application."
readme = "README.md"
license = { file = "LICENSE" }
requires-python = ">=3.11"
```

O projeto usa `setuptools` como backend de build e declara Python 3.11 como versão mínima. Na própria `v0.1.0`, o número presente no arquivo coincide com a tag Git.

As dependências de desenvolvimento ficam em um grupo opcional:

```toml
[project.optional-dependencies]
dev = [
    "mypy>=1.11,<2",
    "pre-commit>=3.8,<5",
    "pytest>=8.3,<9",
    "pytest-cov>=5,<8",
    "ruff>=0.6,<1",
]
```

Assim, a instalação básica e a preparação do ambiente de desenvolvimento expressam necessidades diferentes:

```bash
pip install -e .
pip install -e ".[dev]"
```

A opção `-e` instala o projeto em modo editável. Alterações no código-fonte ficam disponíveis no ambiente sem a necessidade de reinstalar o pacote a cada edição.

## Por que usar `src layout`

O pacote não fica diretamente na raiz do repositório. Ele está dentro de `src/`:

```text
src/
└── media_transcriber/
    └── __init__.py
```

O `pyproject.toml` informa ao `setuptools` onde encontrá-lo:

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

Essa organização ajuda a fazer com que os testes utilizem o pacote instalado, em vez de importarem acidentalmente uma pasta disponível apenas porque o comando foi executado na raiz do repositório.

O benefício aparece cedo: se a configuração de empacotamento estiver errada, o problema tende a surgir durante a instalação ou o teste, e não somente quando o projeto for distribuído ou executado em outro ambiente.

Isso não significa que todo script Python precise dessa estrutura. Para uma aplicação que será desenvolvida em várias etapas, porém, tratar o código como pacote desde o começo reduz uma mudança estrutural futura.

## Um teste pequeno para validar a fundação

A `v0.1.0` contém apenas um teste:

```python
from importlib.metadata import version

import media_transcriber


def test_package_version() -> None:
    assert media_transcriber.__name__ == "media_transcriber"
    assert version("media-transcriber") == "0.1.0"
```

Ele confirma dois pontos da própria fundação:

1. o pacote pode ser importado;
2. a versão instalada é `0.1.0`.

O teste não comprova comportamento de negócio, porque ainda não existe comportamento de negócio nessa versão. Sua responsabilidade é pequena e coerente com o estado do projeto.

O pytest é configurado no mesmo `pyproject.toml`:

```toml
[tool.pytest.ini_options]
addopts = "--cov=media_transcriber --cov-report=term-missing"
testpaths = ["tests"]

[tool.coverage.run]
branch = true
source = ["media_transcriber"]

[tool.coverage.report]
show_missing = true
```

Executar `pytest` já produz o relatório de cobertura, incluindo branches e linhas ausentes.

Na validação desta tag, o relatório mostrou 100% de cobertura. Esse número precisa ser interpretado com honestidade: o módulo `__init__.py` ainda possui zero instruções executáveis. Portanto, 100% aqui confirma a configuração da ferramenta, não uma aplicação amplamente testada.

Cobertura é uma medida de código exercitado. Ela não mede, sozinha, qualidade dos testes, correção das regras ou cenários relevantes.

## Ruff para linting e formatação

O Ruff cumpre duas funções no projeto:

- analisar o código em busca de problemas e violações selecionadas;
- verificar e aplicar a formatação.

A configuração inicial é curta:

```toml
[tool.ruff]
line-length = 88
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]
```

As famílias escolhidas cobrem erros e estilo do pycodestyle, problemas detectados pelo Pyflakes, ordenação de imports e modernização de sintaxe para versões atuais do Python.

Os comandos usados para validar o repositório são:

```bash
ruff check .
ruff format --check .
```

O primeiro analisa as regras de lint. O segundo verifica se os arquivos já estão formatados, sem modificá-los.

Para aplicar a formatação localmente:

```bash
ruff format .
```

Separar verificação e correção é importante na pipeline: o CI deve informar que o repositório não atende ao padrão, sem editar silenciosamente o código durante a validação.

## Mypy em modo estrito

A análise estática de tipos foi configurada desde o início:

```toml
[tool.mypy]
python_version = "3.11"
strict = true
files = ["src", "tests"]
```

O modo estrito torna a introdução de código sem anotações ou com comportamentos de tipo ambíguos mais visível.

Ativar essa exigência quando o projeto ainda é pequeno é mais simples do que tentar tipar uma base inteira depois. Ao mesmo tempo, a configuração não garante que o desenho esteja correto. Ela verifica um conjunto específico de inconsistências antes da execução.

Lint, formatação, tipos e testes respondem a perguntas diferentes. A presença de uma ferramenta não elimina a necessidade das demais.

## Pre-commit como feedback local

A pipeline é importante, mas esperar o push para descobrir um erro simples torna o ciclo mais lento. O pre-commit aproxima parte das verificações do momento em que a alteração está sendo preparada.

Na `v0.1.0`, os hooks são:

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.13.2
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format
  - repo: local
    hooks:
      - id: mypy
        name: mypy
        entry: mypy
        language: system
        types: [python]
        pass_filenames: false
      - id: pytest
        name: pytest
        entry: pytest
        language: system
        pass_filenames: false
```

Depois de instalar as dependências de desenvolvimento:

```bash
pre-commit install
```

Também é possível executar todos os hooks sem criar um commit:

```bash
pre-commit run --all-files
```

Mypy e pytest usam o ambiente local, por isso o projeto precisa estar instalado com as dependências de desenvolvimento. Essa decisão mantém a configuração simples, mas exige que a documentação de preparação do ambiente seja seguida.

O pre-commit reduz erros triviais antes do push. Ele não substitui a pipeline: hooks locais podem não estar instalados, podem ser ignorados e dependem do ambiente da máquina.

## A primeira pipeline no GitLab

O arquivo `.gitlab-ci.yml` define uma única etapa chamada `validate` e quatro jobs independentes:

```yaml
image: python:3.11-slim

stages:
  - validate

default:
  before_script:
    - python -m pip install --upgrade pip
    - python -m pip install -e ".[dev]"

lint:
  stage: validate
  script:
    - ruff check .

format-check:
  stage: validate
  script:
    - ruff format --check .

type-check:
  stage: validate
  script:
    - mypy

test:
  stage: validate
  script:
    - pytest
  coverage: '/TOTAL.*\s+(\d+%)$/'
```

Todos os jobs instalam o projeto com o conjunto `dev`. Depois, cada um responde por uma verificação específica:

| Job | Pergunta respondida |
|---|---|
| `lint` | O código atende às regras selecionadas do Ruff? |
| `format-check` | Os arquivos estão formatados? |
| `type-check` | O mypy aceita o código e os testes? |
| `test` | Os testes passam e qual cobertura foi registrada? |

Manter jobs separados torna a falha mais fácil de identificar. Se a formatação estiver incorreta, não é necessário procurar o motivo dentro de um log que mistura todas as ferramentas.

Essa pipeline ainda é deliberadamente simples. Não existe build de imagem, publicação de pacote, deploy ou matriz com várias versões do Python. Nenhuma dessas etapas resolve um problema presente na `v0.1.0`.

## Validação reproduzida na tag

Para preparar este artigo, a tag `v0.1.0` foi aberta em um worktree isolado e instalada em um ambiente virtual próprio.

Os quatro comandos definidos pelo projeto foram executados novamente:

```bash
ruff check .
ruff format --check .
mypy
pytest
```

Resultado:

- Ruff: nenhuma ocorrência;
- formatação: seis arquivos já formatados;
- mypy: nenhuma inconsistência em três arquivos analisados;
- pytest: um teste aprovado;
- cobertura: 100% sobre um pacote ainda sem instruções executáveis.

O ambiente de reprodução usou Python 3.12.3, compatível com o requisito `>=3.11`. A pipeline, por sua vez, declara a imagem `python:3.11-slim`.

Registrar essas diferenças evita transformar “funcionou na validação” em uma afirmação vaga. A fundação foi exercitada fora do ambiente original, mas a versão continua pequena e não valida processamento de mídia.

## O que ficou de fora de propósito

A fundação não inclui:

- FFmpeg;
- mecanismo de transcrição;
- banco de dados;
- API HTTP;
- Dockerfile;
- arquitetura em múltiplas camadas;
- publicação no PyPI;
- entrega contínua.

Também não foram criadas abstrações para problemas que ainda não existem.

O objetivo da primeira versão era automatizar o feedback essencial, não antecipar toda a arquitetura futura. A complexidade deve entrar quando uma necessidade concreta justificar seu custo.

## O que mudou na v0.2.0

A [`v0.2.0`](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.2.0) usa essa base para introduzir a primeira funcionalidade: uma CLI capaz de receber um caminho e validar a existência, o tipo e a extensão de um arquivo de mídia.

Nesse ponto, o conjunto de testes cresce de um para quinze, e a cobertura passa a representar código executável de validação e interface de linha de comando.

Essa comparação demonstra a utilidade da fundação. A nova funcionalidade não precisou inventar seu próprio processo de qualidade. Ela entrou em um projeto que já sabia como instalar dependências, executar testes, analisar tipos, verificar estilo e repetir tudo no GitLab.

## Conclusão

A `v0.1.0` do Media Transcriber não entrega transcrição. Ela entrega um ambiente no qual as próximas funcionalidades podem evoluir com feedback automatizado.

O valor da fundação não está na quantidade de ferramentas, mas na integração entre elas:

```text
alteração local
      ↓
Ruff + mypy + pytest
      ↓
pre-commit
      ↓
push para o GitLab
      ↓
pipeline independente do ambiente local
```

O resultado é uma base pequena, versionada e reproduzível. Pequena o suficiente para ser compreendida; estruturada o suficiente para sustentar a próxima etapa.

A lição principal desta versão é que qualidade não precisa aparecer apenas quando o projeto se torna grande. Ela pode começar como um conjunto mínimo de decisões explícitas, executadas desde o primeiro ciclo de desenvolvimento.

## Referências

- [Media Transcriber — tag v0.1.0](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.1.0)
- [Media Transcriber — tag v0.2.0](https://gitlab.com/dirleiflsilva/media-transcriber/-/tags/v0.2.0)
- [Roadmap do Media Transcriber](https://gitlab.com/dirleiflsilva/media-transcriber/-/blob/main/ROADMAP.md)
- [Python Packaging User Guide — `pyproject.toml`](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)
- [pytest](https://docs.pytest.org/)
- [Ruff](https://docs.astral.sh/ruff/)
- [mypy](https://mypy.readthedocs.io/)
- [pre-commit](https://pre-commit.com/)
- [GitLab CI/CD](https://docs.gitlab.com/ci/)
