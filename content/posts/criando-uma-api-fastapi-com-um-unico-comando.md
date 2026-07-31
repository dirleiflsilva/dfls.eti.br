---
title: "Criando uma API FastAPI com um único comando"
date: 2026-07-29
draft: false
description: "Conheça o fastapi-minimal-template, uma CLI inspirada na experiência do NestJS, distribuída pelo PyPI e capaz de criar uma API FastAPI mínima para estudos com Python, Docker e Docker Compose."
tags:
  - Python
  - FastAPI
  - Docker
  - Docker Compose
  - uv
  - PyPI
  - GitHub Actions
  - DevOps
  - Engenharia de Software
topics:
  - Engenharia de Software
---

Ao iniciar um projeto com determinadas tecnologias, é comum encontrarmos uma ferramenta capaz de criar automaticamente uma estrutura básica de aplicação.

No ecossistema Node.js, por exemplo, o NestJS permite iniciar um novo projeto com um único comando:

```bash
npx @nestjs/cli@latest new minha-api
```

Esse comando cria a estrutura inicial, instala as dependências e entrega uma aplicação pronta para execução.

Durante um curso de Docker e Docker Compose, percebi que os exemplos práticos utilizavam justamente essa abordagem. A aplicação em si não era o foco principal da aula. Ela servia apenas como base para estudar imagens, containers, volumes, redes e orquestração com Docker Compose.

Como meu foco atual está em Database Reliability Engineering (DBRE), Data Platform Engineering e DevOps, uso Python principalmente como suporte para automações, ferramentas e experimentos técnicos. A partir desse contexto, surgiu uma pergunta:

> Existe algo igualmente simples para criar uma pequena API em Python?

Existem excelentes frameworks, templates e geradores de projetos no ecossistema Python. Entretanto, muitos deles criam estruturas completas, com banco de dados, autenticação, migrations, frontend e diversos outros componentes.

Para uma aula de Docker, isso pode acabar desviando a atenção do objetivo principal.

Foi a partir dessa necessidade que surgiu o **fastapi-minimal-template**.

## O problema: precisamos mesmo de uma aplicação completa?

Ao estudar Docker, normalmente precisamos apenas de uma aplicação que:

* possa ser executada localmente;
* exponha uma porta HTTP;
* tenha pelo menos um endpoint;
* possua dependências instaláveis;
* possa ser empacotada em uma imagem;
* permita testes com Docker Compose.

Não precisamos, necessariamente, de:

* banco de dados;
* ORM;
* autenticação;
* migrations;
* filas;
* cache;
* frontend;
* arquitetura distribuída;
* infraestrutura de produção.

Adicionar esses componentes em um projeto didático aumenta o número de conceitos apresentados ao mesmo tempo.

É como estudar como funciona uma garagem usando um caminhão inteiro, quando uma bicicleta já seria suficiente para demonstrar entrada, saída e armazenamento.

A proposta do projeto é justamente fornecer essa “bicicleta”: pequena, funcional e fácil de compreender.

## O que é o fastapi-minimal-template?

O **fastapi-minimal-template** é uma ferramenta CLI open source que gera uma aplicação REST mínima utilizando FastAPI.

O projeto foi criado principalmente para servir como base em aulas e laboratórios envolvendo:

* Python;
* APIs REST;
* FastAPI;
* Docker;
* Docker Compose;
* gerenciamento de dependências com `uv`.

O código-fonte está disponível no GitHub e a CLI é distribuída pelo PyPI:

[github.com/dirleiflsilva/fastapi-minimal-template](https://github.com/dirleiflsilva/fastapi-minimal-template)

[pypi.org/project/fastapi-minimal-template](https://pypi.org/project/fastapi-minimal-template/)

A ferramenta não pretende competir com templates completos para aplicações em produção.

Sua proposta é deliberadamente pequena: criar apenas o necessário para termos uma API funcional, testável e pronta para ser executada dentro de um container.

## Uma experiência inspirada no NestJS

A inspiração do projeto não foi reproduzir a arquitetura do NestJS em Python. O ponto de referência foi a experiência de desenvolvimento proporcionada por sua CLI:

```bash
npx @nestjs/cli@latest new minha-api
```

Um comando recebe o nome do projeto, cria um diretório e prepara uma aplicação que pode ser executada. Com o `fastapi-minimal-template`, a experiência equivalente é:

```bash
uvx fastapi-minimal-template@latest new minha-api
```

Existe, porém, uma diferença intencional. A CLI do NestJS também instala as dependências durante a criação. O `fastapi-minimal-template` apenas gera os arquivos. A sincronização ocorre explicitamente no passo seguinte:

```bash
cd minha-api
uv sync
```

Separar essas etapas mantém o gerador simples, deixa claro o que cada comando faz e permite inspecionar o projeto antes de instalar suas dependências.

## A CLI não é a API gerada

É importante distinguir os dois projetos envolvidos:

| Componente | O que é | Principais dependências | Onde fica |
|---|---|---|---|
| `fastapi-minimal-template` | A ferramenta que recebe os argumentos e gera os arquivos | Typer e a biblioteca padrão do Python | PyPI e repositório da CLI |
| `hello-api` | A aplicação criada pela ferramenta | FastAPI, pytest, Ruff e arquivos opcionais para Docker | Diretório criado na máquina do usuário |

Instalar ou executar a CLI não significa manter o FastAPI instalado junto dela. Da mesma forma, depois que os arquivos são gerados, a API não depende do gerador para funcionar.

Essa separação também explica os dois arquivos `pyproject.toml`: um pertence à própria CLI e define o comando `fastapi-minimal-template`; o outro nasce dentro do projeto gerado e declara as dependências da nova API.

## Criando uma API com um único comando

O pacote está publicado no PyPI. Após instalar o `uv`, podemos confirmar a versão disponível e criar uma nova API diretamente a partir da distribuição publicada:

```bash
uvx fastapi-minimal-template@latest --version
```

Saída:

```text
fastapi-minimal-template 0.1.0
```

Agora, execute:

```bash
uvx fastapi-minimal-template@latest new hello-api
```

Não é necessário clonar o repositório nem executar `pip install` manualmente. O [`uvx`](https://docs.astral.sh/uv/guides/tools/) resolve o pacote no PyPI, prepara um ambiente isolado para a ferramenta e executa o comando exposto pelo pacote.

Esse ambiente é gerenciado pelo `uv` e pode ser mantido em cache para acelerar execuções futuras. Portanto, “sem instalação” significa que a ferramenta não fica instalada permanentemente como um comando global no ambiente do usuário; não significa que todos os arquivos baixados sejam necessariamente descartados após cada execução.

Na prática, ele oferece uma experiência semelhante ao `npx` do ecossistema Node.js:

```text
Node.js                         Python com uv
------------------------------------------------------------
npx pacote@latest              uvx pacote@latest
npm install -g pacote          uv tool install pacote
npm install                    uv sync
npm run                        uv run
```

Uma forma abreviada também está disponível:

```bash
uvx fastapi-minimal-template@latest hello-api
```

Depois de executar o comando, basta entrar no diretório criado:

```bash
cd hello-api
```

Sincronizar as dependências:

```bash
uv sync
```

E iniciar a aplicação:

```bash
uv run fastapi dev src/app/main.py
```

A API ficará disponível em:

```text
http://localhost:8000
```

A documentação Swagger poderá ser acessada em:

```text
http://localhost:8000/docs
```

E o endpoint de verificação de saúde estará em:

```text
http://localhost:8000/health
```

## O projeto gerado

O template gera uma estrutura pequena:

```text
hello-api/
├── src/
│   └── app/
│       ├── __init__.py
│       └── main.py
├── tests/
│   └── test_main.py
├── pyproject.toml
├── Dockerfile
├── compose.yaml
├── .dockerignore
├── .gitignore
└── README.md
```

Essa estrutura já permite estudar vários conceitos importantes sem transformar o exemplo em uma aplicação complexa.

O diretório `src` mantém o código da aplicação separado dos demais arquivos do projeto.

O diretório `tests` contém os testes automatizados.

O `pyproject.toml` centraliza as informações do projeto e suas dependências.

Já o `Dockerfile` e o `compose.yaml` permitem utilizar a aplicação diretamente em laboratórios de containers.

## Como os templates chegam dentro do wheel

Para gerar um projeto sem depender de arquivos externos, os templates são distribuídos junto com a CLI.

No repositório, eles ficam dentro do pacote Python:

```text
src/fastapi_minimal_template/
├── cli.py
├── generator.py
└── template/
    ├── src/app/main.py
    ├── tests/test_main.py
    ├── pyproject.toml.template
    ├── README.md.template
    ├── Dockerfile
    ├── compose.yaml
    ├── .dockerignore
    └── .gitignore
```

O `pyproject.toml` configura o Hatchling para construir o pacote localizado em `src/fastapi_minimal_template`:

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/fastapi_minimal_template"]
```

Como o diretório `template` está dentro desse pacote, seus arquivos são incluídos no wheel. Podemos conferir o artefato construído com:

```bash
uv build --no-sources
unzip -l dist/fastapi_minimal_template-0.1.0-py3-none-any.whl
```

Entre as entradas listadas estarão:

```text
fastapi_minimal_template/template/Dockerfile
fastapi_minimal_template/template/compose.yaml
fastapi_minimal_template/template/pyproject.toml.template
fastapi_minimal_template/template/src/app/main.py
fastapi_minimal_template/template/tests/test_main.py
```

Em tempo de execução, o gerador utiliza `importlib.resources` para localizar esses recursos dentro do pacote instalado. Em seguida, copia a árvore para um diretório temporário, substitui marcadores como `{{ project_name }}` e `{{ project_title }}` e só então move o resultado completo para o destino.

Os arquivos terminados em `.template` perdem esse sufixo durante a geração. Assim, `pyproject.toml.template` se torna `pyproject.toml` e `README.md.template` se torna `README.md`.

Esse detalhe é o que torna possível executar a CLI baixada do PyPI em qualquer diretório: o modelo necessário para criar a API viaja dentro do próprio wheel.

## Uma API realmente mínima

A aplicação gerada possui dois endpoints.

O primeiro é a rota raiz:

```python
from fastapi import FastAPI

app = FastAPI(
    title="Hello Api",
    version="0.1.0",
)


@app.get("/")
async def hello_world() -> dict[str, str]:
    return {"message": "Hello World"}
```

Ao acessar:

```http
GET /
```

recebemos:

```json
{
  "message": "Hello World"
}
```

O segundo endpoint é utilizado para verificar se a aplicação está em funcionamento:

```python
@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
```

A chamada:

```http
GET /health
```

retorna:

```json
{
  "status": "healthy"
}
```

Embora simples, o endpoint de saúde é especialmente útil em estudos envolvendo Docker.

Ele pode ser utilizado futuramente em:

* health checks do Docker;
* Docker Compose;
* balanceadores de carga;
* Kubernetes;
* pipelines de entrega;
* ferramentas de observabilidade.

## Testes automatizados desde o início

Mesmo sendo um projeto mínimo, o template inclui testes com `pytest`.

Um dos testes verifica o endpoint principal:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_hello_world() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}
```

Os testes podem ser executados com:

```bash
uv run pytest
```

Essa decisão é importante porque uma aplicação simples não precisa ser uma aplicação sem qualidade.

Ao incluir testes desde a criação do projeto, reforçamos uma prática importante da Engenharia de Software: o código deve nascer testável.

Além disso, o teste fornece uma validação rápida após qualquer alteração no Dockerfile, nas dependências ou na própria aplicação.

## Executando com Docker

O projeto gerado já possui um `Dockerfile`.

Para construir a imagem:

```bash
docker build -t hello-api .
```

Depois, execute o container:

```bash
docker run --rm -p 8000:8000 hello-api
```

A porta `8000` do container será publicada na porta `8000` da máquina local.

A aplicação continuará disponível em:

```text
http://localhost:8000
```

Essa pequena API já é suficiente para praticar:

* criação de imagens;
* instruções do Dockerfile;
* escolha da imagem base;
* instalação de dependências;
* definição do diretório de trabalho;
* cópia de arquivos;
* exposição de portas;
* execução de containers;
* mapeamento de portas;
* análise de logs.

## Executando com Docker Compose

Também é possível iniciar a aplicação usando Docker Compose:

```bash
docker compose up --build
```

O arquivo `compose.yaml` gerado define o serviço da API e publica sua porta:

```yaml
services:
  api:
    build:
      context: .
    ports:
      - "8000:8000"
```

Nesse primeiro momento, existe apenas um serviço.

Isso é intencional.

O objetivo é começar com uma configuração simples e permitir que ela seja ampliada durante os estudos.

Posteriormente, o aluno pode adicionar:

* PostgreSQL;
* Redis;
* volumes;
* redes;
* variáveis de ambiente;
* health checks;
* dependências entre serviços;
* profiles;
* configurações específicas por ambiente.

Dessa forma, o template funciona como ponto de partida e não como solução final.

## Gerando um projeto sem Docker

Em alguns cenários, podemos querer apenas a aplicação FastAPI.

Nesse caso, utilize:

```bash
uvx fastapi-minimal-template@latest new hello-api --no-docker
```

A opção `--no-docker` omite:

* `Dockerfile`;
* `compose.yaml`;
* `.dockerignore`.

Isso permite utilizar a mesma ferramenta em exercícios voltados apenas para Python ou FastAPI.

## Proteção contra sobrescrita

Por padrão, a ferramenta não altera um diretório existente.

Se já existir um diretório chamado `hello-api`, a criação será interrompida.

Essa proteção evita a perda acidental de arquivos.

Quando a substituição for realmente desejada, ela precisa ser informada explicitamente:

```bash
uvx fastapi-minimal-template@latest new hello-api --force
```

Esse comportamento segue um princípio importante para ferramentas de linha de comando:

> Operações potencialmente destrutivas não devem acontecer de forma implícita.

## Execução isolada ou instalação permanente

O uso com `uvx` é adequado quando queremos executar a ferramenta sem instalá-la permanentemente.

Para quem pretende criar projetos com frequência, também é possível instalar o comando:

```bash
uv tool install fastapi-minimal-template
```

Depois da instalação:

```bash
fastapi-minimal-template new hello-api
```

Nesse caso, `uv tool install` também obtém o pacote do PyPI, mas cria uma instalação persistente da ferramenta e disponibiliza seu executável no `PATH`. A diferença prática é:

```text
uvx fastapi-minimal-template@latest ...  execução sob demanda
uv tool install fastapi-minimal-template instalação permanente da CLI
```

Também podemos executar uma versão específica sem instalação:

```bash
uvx fastapi-minimal-template@0.1.0 new hello-api
```

Fixar a versão pode ser útil em aulas, documentações e pipelines, pois evita que uma atualização futura altere inesperadamente o projeto gerado.

## Mais do que um boilerplate

Embora o resultado seja uma API “Hello World”, o desenvolvimento do template envolveu diversos conceitos relevantes de Engenharia de Software:

* criação de uma CLI;
* organização de pacotes Python;
* empacotamento com `pyproject.toml`;
* criação de comandos com `[project.scripts]`;
* processamento de templates;
* validação de entradas;
* proteção contra path traversal;
* testes unitários;
* testes de integração;
* lint e formatação;
* integração contínua;
* construção de distribuições;
* publicação de pacotes Python.

Ou seja, um projeto pequeno não precisa ser superficial.

A aplicação gerada é simples, mas a ferramenta responsável por gerá-la precisa lidar com questões reais de qualidade, segurança e distribuição.

Essa talvez tenha sido a parte mais interessante do desenvolvimento.

A ideia começou como uma necessidade pontual para acompanhar aulas práticas de Docker, mas acabou se transformando em um pequeno laboratório de automação, empacotamento e práticas de Engenharia de Software aplicadas a uma ferramenta Python.

## Dois workflows, duas responsabilidades

O repositório utiliza dois workflows do GitHub Actions. Embora ambos executem verificações de qualidade e construam o pacote, eles atendem a momentos diferentes:

| Workflow | Quando executa | Objetivo | Publica no PyPI? |
|---|---|---|---|
| `ci.yml` | Em pushes e pull requests | Detectar problemas cedo com lint, formatação, testes e build | Não |
| `release.yml` | Quando uma tag iniciada por `v` é enviada | Revalidar o commit, construir os artefatos e publicar uma versão | Sim |

O `ci.yml` responde à pergunta: “esta alteração continua saudável e o pacote ainda pode ser construído?”.

O `release.yml` responde a outra: “este commit marcado como versão está pronto para se tornar um artefato público e imutável no PyPI?”.

Repetir as verificações no workflow de release é proposital. A publicação não depende apenas do resultado de uma execução anterior: o próprio commit apontado pela tag é validado antes do upload.

## Publicação orientada por tags

A versão do pacote possui uma única fonte de verdade:

```python
# src/fastapi_minimal_template/__init__.py
__version__ = "0.1.0"
```

Para preparar uma nova release, atualizamos essa versão, o lockfile e executamos as verificações locais:

```bash
uv lock
uv sync --locked
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv build --no-sources
```

Depois do commit passar pelo CI, criamos e enviamos uma tag com o mesmo número da versão e o prefixo `v`:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

O padrão `v*` configurado em `release.yml` faz o push da tag iniciar o workflow de publicação. A tag funciona como uma decisão explícita: pushes comuns podem validar o projeto, mas não devem criar novas versões no PyPI.

Antes do upload, o deployment ainda precisa ser aprovado no environment protegido `pypi` do GitHub. Depois da aprovação, o workflow executa `uv publish`.

Esse cuidado também é importante porque os arquivos de uma versão publicada no PyPI não podem ser substituídos. Uma correção exige um novo número, como `0.1.1`.

## Trusted Publishing e OIDC

Para publicar, o GitHub Actions precisa provar ao PyPI que está autorizado a representar este projeto. Isso é feito com [Trusted Publishing](https://docs.pypi.org/trusted-publishers/) e OpenID Connect, ou OIDC.

O projeto configura no PyPI uma relação de confiança com uma identidade específica:

```text
Owner:            dirleiflsilva
Repository:       fastapi-minimal-template
Workflow:         release.yml
Environment:      pypi
```

No workflow, a permissão necessária aparece de forma explícita:

```yaml
permissions:
  contents: read
  id-token: write
```

A permissão `id-token: write` permite que o job solicite ao GitHub um token de identidade OIDC. O PyPI valida as informações desse token contra o Trusted Publisher cadastrado e, se tudo corresponder, fornece uma credencial de publicação temporária, válida por 15 minutos, para aquela execução.

O fluxo pode ser resumido assim:

```text
tag vX.Y.Z
    │
    ▼
GitHub Actions executa release.yml
    │
    ├── valida código e constrói dist/
    ├── recebe aprovação do environment pypi
    └── solicita identidade OIDC ao GitHub
             │
             ▼
PyPI valida repositório, workflow e environment
             │
             ▼
credencial temporária → uv publish
```

## Por que não armazenar um `PYPI_TOKEN`

Uma alternativa tradicional seria criar um token permanente no PyPI, salvá-lo como secret no GitHub e disponibilizá-lo ao workflow como `PYPI_TOKEN`.

Esse projeto não precisa fazer isso. Com Trusted Publishing:

* não existe uma credencial de longa duração para vazar;
* não é necessário copiar, armazenar ou rotacionar manualmente um token;
* a autorização fica limitada à identidade configurada no PyPI;
* a credencial temporária é emitida apenas durante a execução autorizada;
* a aprovação do environment adiciona uma barreira antes da publicação.

Secrets do GitHub são úteis, mas um secret permanente continua sendo uma credencial reutilizável caso seja exposto. OIDC troca esse segredo estático por confiança verificável entre o GitHub e o PyPI.

Isso não elimina a necessidade de proteger o repositório e revisar o workflow. A segurança passa a depender também das permissões sobre tags, branches, environments e alterações em `release.yml`. Ainda assim, remove do processo um dos alvos mais sensíveis: o token permanente de upload.

## Por que não utilizar um template completo?

Templates completos são extremamente úteis quando precisamos iniciar uma aplicação real com vários componentes já integrados.

Entretanto, eles podem não ser a melhor escolha para todos os contextos.

### Vantagens de um template completo

* mais recursos disponíveis;
* estrutura próxima de um sistema real;
* configurações de produção;
* integrações prontas;
* redução do trabalho inicial em projetos maiores.

### Vantagens de um template mínimo

* menos conceitos simultâneos;
* menor quantidade de arquivos;
* execução mais rápida;
* facilidade para compreender cada componente;
* maior liberdade para evoluir o projeto;
* melhor adequação para aulas e laboratórios.

O fastapi-minimal-template escolhe conscientemente a segunda abordagem.

Ele não tenta antecipar todas as necessidades futuras.

Entrega somente uma base pequena e funcional sobre a qual cada conceito pode ser adicionado no momento adequado.

## Próximos passos

A versão `0.1.0` atende ao objetivo principal: criar uma API FastAPI mínima com um único comando. Ela também completa o ciclo de distribuição da ferramenta, do código-fonte ao pacote publicado.

Evoluções futuras poderão ser consideradas desde que preservem a proposta original. O projeto deve continuar pequeno o suficiente para que alguém consiga compreender sua estrutura em poucos minutos.

## Conclusão

O fastapi-minimal-template nasceu de uma necessidade bastante objetiva: criar uma aplicação Python simples para aulas práticas de Docker e Docker Compose.

Em vez de copiar arquivos manualmente a cada novo exercício, agora é possível executar:

```bash
uvx fastapi-minimal-template@latest new hello-api
```

Em seguida:

```bash
cd hello-api
uv sync
uv run fastapi dev src/app/main.py
```

Com poucos comandos, temos:

* uma API FastAPI funcionando;
* documentação Swagger;
* endpoint de health check;
* testes automatizados;
* Dockerfile;
* Docker Compose;
* gerenciamento de dependências com `uv`.

Mais importante do que economizar alguns minutos na criação de arquivos, o projeto demonstra como uma necessidade pequena pode se transformar em um exercício prático de Engenharia de Software.

O caminho completo também ficou curto:

```text
PyPI → uvx → CLI isolada → templates do wheel → projeto FastAPI
```

E, no sentido da publicação:

```text
commit validado → tag v0.1.0 → GitHub Actions → OIDC → PyPI
```

Às vezes, o melhor projeto para aprender não é aquele que começa com dezenas de recursos.

É aquele que começa pequeno, resolve um problema específico e cria uma base clara para evoluções futuras.

## Repositório

O código-fonte, as instruções de uso e a documentação estão disponíveis no GitHub. A versão publicada pode ser consultada no PyPI:

[github.com/dirleiflsilva/fastapi-minimal-template](https://github.com/dirleiflsilva/fastapi-minimal-template)

[pypi.org/project/fastapi-minimal-template](https://pypi.org/project/fastapi-minimal-template/)
