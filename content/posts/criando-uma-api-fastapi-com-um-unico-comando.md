---
title: "Criando uma API FastAPI com um único comando"
date: 2026-07-29
draft: true
description: "Conheça o fastapi-minimal-template, uma ferramenta CLI que cria uma API FastAPI mínima e pronta para estudos com Python, Docker e Docker Compose."
tags:
  - Python
  - FastAPI
  - Docker
  - Docker Compose
  - uv
  - Engenharia de Software
categories:
  - Python
---

Ao iniciar um projeto com determinadas tecnologias, é comum encontrarmos uma ferramenta capaz de criar automaticamente uma estrutura básica de aplicação.

No ecossistema Node.js, por exemplo, o NestJS permite iniciar um novo projeto com um único comando:

```bash
npx @nestjs/cli@latest new minha-api
```

Esse comando cria a estrutura inicial, instala as dependências e entrega uma aplicação pronta para execução.

Durante um curso de Docker e Docker Compose, percebi que os exemplos práticos utilizavam justamente essa abordagem. A aplicação em si não era o foco principal da aula. Ela servia apenas como base para estudar imagens, containers, volumes, redes e orquestração com Docker Compose.

Como meu foco atual está em Engenharia de Software com Python, surgiu uma pergunta:

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

O código-fonte está disponível no GitHub:

[github.com/dirleiflsilva/fastapi-minimal-template](https://github.com/dirleiflsilva/fastapi-minimal-template)

A ferramenta não pretende competir com templates completos para aplicações em produção.

Sua proposta é deliberadamente pequena: criar apenas o necessário para termos uma API funcional, testável e pronta para ser executada dentro de um container.

## Criando uma API com um único comando

Após instalar o `uv`, uma nova API pode ser criada com:

```bash
uvx fastapi-minimal-template@latest new hello-api
```

O `uvx` executa uma ferramenta Python em um ambiente temporário e isolado.

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

## Instalação permanente

O uso com `uvx` é adequado quando queremos executar a ferramenta sem instalá-la permanentemente.

Para quem pretende criar projetos com frequência, também é possível instalar o comando:

```bash
uv tool install fastapi-minimal-template
```

Depois da instalação:

```bash
fastapi-minimal-template new hello-api
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

A ideia começou como uma necessidade pontual para acompanhar aulas práticas de Docker, mas acabou se transformando em um pequeno laboratório de Engenharia de Software com Python.

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

A versão inicial já atende ao objetivo principal: criar uma API FastAPI mínima com um único comando.

Algumas evoluções poderão ser consideradas futuramente, desde que não comprometam a simplicidade do projeto:

* configuração opcional de health check no Docker Compose;
* escolha da versão do Python;
* inicialização opcional de um repositório Git;
* novos exemplos didáticos;
* melhorias nas mensagens da CLI;
* publicação automatizada;
* suporte a outros modos mínimos de execução.

A principal regra para qualquer evolução será preservar a proposta original.

O projeto deve continuar pequeno o suficiente para que alguém consiga compreender sua estrutura em poucos minutos.

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

Às vezes, o melhor projeto para aprender não é aquele que começa com dezenas de recursos.

É aquele que começa pequeno, resolve um problema específico e cria uma base clara para evoluções futuras.

## Repositório

O código-fonte, as instruções de uso e a documentação estão disponíveis no GitHub:

[github.com/dirleiflsilva/fastapi-minimal-template](https://github.com/dirleiflsilva/fastapi-minimal-template)
