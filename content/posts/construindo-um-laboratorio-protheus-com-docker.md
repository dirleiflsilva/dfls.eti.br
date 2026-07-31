---
title: "Construindo um laboratório Protheus com Docker"
date: 2026-07-08
draft: false
toc: true
slug: "construindo-um-laboratorio-protheus-com-docker"
tags:
  - protheus
  - docker
  - devops
  - postgresql
  - totvs
topics:
  - Protheus e AdvPL
  - DevOps e Confiabilidade
description: "Montagem de um laboratório Protheus com Docker Compose, PostgreSQL, DBAccess, AppServer e License Server, com foco em ambiente reproduzível e práticas DevOps."
---

Durante muitos anos, desenvolver para o ERP Protheus significava preparar manualmente todo o ambiente de desenvolvimento.

Instalar banco de dados, configurar DBAccess, ajustar License Server, preparar AppServer, copiar arquivos de configuração e validar dependências costumava fazer parte do processo. Cada máquina acabava se tornando um ambiente único, com pequenas diferenças difíceis de rastrear.

Embora esse modelo ainda seja comum em muitos projetos, ele fica distante de práticas que hoje considero essenciais em Engenharia de Software: ambientes descritos como código, configuração versionada, automação operacional e capacidade de recriar o laboratório de forma previsível.

Foi com esse objetivo que montei o **Protheus Docker Lab**, um laboratório pessoal para estudar Protheus com Docker usando imagens de desenvolvimento disponibilizadas pela TOTVS Engineering Pro.

> Este lab tem finalidade de estudo e desenvolvimento. Ele não substitui uma instalação corporativa, não representa uma topologia de produção e não é uma homologação oficial de ambiente Protheus.

---

## Objetivo

O objetivo do laboratório é criar uma base reproduzível para estudar:

- padronização de ambiente de desenvolvimento;
- configuração versionada;
- isolamento entre serviços;
- documentação operacional;
- automação de tarefas recorrentes;
- práticas iniciais de DevOps aplicadas ao ecossistema Protheus.

Mais do que "rodar Protheus em Docker", a ideia é transformar o ambiente em um artefato técnico: algo que possa ser versionado, revisado, recriado e evoluído.

---

## Arquitetura do laboratório

O ambiente foi organizado com Docker Compose e dividido em quatro serviços principais:

```text
host Linux
│
├── Docker Compose
│   ├── license
│   ├── postgres-iniciado
│   ├── dbaccess-postgres
│   └── appserver
│
├── config/
│   ├── appserver.ini
│   ├── dbaccess.ini
│   ├── odbc.ini
│   └── odbcinst.ini
│
└── volumes/
    ├── apo/
    ├── systemload/
    └── logs/
```

Cada container tem uma responsabilidade específica:

| Serviço | Responsabilidade |
|---|---|
| `license` | Servidor de licença para o ambiente de desenvolvimento |
| `postgres-iniciado` | Banco PostgreSQL com base Protheus de laboratório |
| `dbaccess-postgres` | Camada DBAccess para comunicação entre AppServer e PostgreSQL |
| `appserver` | AppServer Protheus e WebApp |

Essa separação facilita a leitura do ambiente, reduz acoplamento com a máquina local e cria uma base mais simples para evoluções futuras.

---

## Estrutura do repositório

O repositório ficou organizado assim:

```text
protheus-docker-lab/
├── docker-compose.yml
├── .env.example
├── README.md
├── config/
│   ├── appserver.ini.example
│   ├── odbc.ini.example
│   └── odbcinst.ini.example
├── docs/
│   └── anotacoes-laboratorio.md
├── files/
├── scripts/
│   ├── check.sh
│   ├── down.sh
│   ├── generate-dbaccess.sh
│   ├── logs.sh
│   └── up.sh
└── volumes/
    ├── apo/
    ├── logs/
    └── systemload/
```

Algumas decisões foram importantes desde o início:

- arquivos reais de ambiente ficam fora do Git;
- `.env.example` documenta as variáveis necessárias;
- `appserver.ini.example` serve como base versionada;
- `dbaccess.ini` efetivo é gerado por script;
- artefatos Protheus como RPO e arquivos de `systemload` permanecem locais;
- scripts padronizam o fluxo de preparação, subida, logs e parada.

Essa organização evita transformar o repositório em um depósito de arquivos locais e mantém o foco em configuração, documentação e automação.

---

## Docker Compose

O `docker-compose.yml` descreve os serviços do laboratório e usa variáveis do `.env` para parametrizar imagens, nomes, portas e credenciais.

Um trecho central do Compose é a relação entre PostgreSQL, DBAccess e AppServer:

```yaml
services:
  postgres-iniciado:
    image: ${POSTGRES_IMAGE}
    container_name: ${COMPOSE_PROJECT_NAME}-postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} -h localhost -p ${POSTGRES_PORT}"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s

  dbaccess-postgres:
    image: ${DBACCESS_IMAGE}
    container_name: ${COMPOSE_PROJECT_NAME}-dbaccess
    restart: unless-stopped
    depends_on:
      postgres-iniciado:
        condition: service_healthy
      license:
        condition: service_started

  appserver:
    image: ${APPSERVER_IMAGE}
    container_name: ${COMPOSE_PROJECT_NAME}-appserver
    restart: unless-stopped
    depends_on:
      dbaccess-postgres:
        condition: service_started
      license:
        condition: service_started
```

O `healthcheck` do PostgreSQL foi uma decisão importante. Em testes, o AppServer podia tentar acessar o banco antes de ele aceitar conexões. Com `pg_isready` e `depends_on` usando `condition: service_healthy`, o DBAccess passa a iniciar somente depois que o banco está pronto.

Isso não elimina a necessidade de validações funcionais, mas reduz um problema comum em ambientes orquestrados: corrida de inicialização.

---

## Configuração via `.env`

As principais configurações ficam centralizadas no `.env`, a partir do modelo `.env.example`:

```env
COMPOSE_PROJECT_NAME=protheus-docker-lab

LICENSE_IMAGE=totvsengpro/license-dev
POSTGRES_IMAGE=totvsengpro/postgres-dev:12.1.2510_bra
DBACCESS_IMAGE=totvsengpro/dbaccess-postgres-dev
APPSERVER_IMAGE=totvsengpro/appserver-dev

POSTGRES_HOST=postgres-iniciado
POSTGRES_PORT=5432
POSTGRES_DB=protheus
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

DBACCESS_ALIAS=protheus
DBACCESS_PORT=7890

APPSERVER_PORT=1234
WEBAPP_PORT=8080
```

Separar configuração do Compose facilita ajustes locais e deixa claro quais parâmetros fazem parte do contrato do laboratório.

---

## Preparação do DBAccess

Um ponto que exigiu cuidado foi o `dbaccess.ini`.

Em vez de manter esse arquivo efetivo no Git, o laboratório usa o script `scripts/generate-dbaccess.sh`. Ele executa o `dbaccesscfg` da própria imagem do DBAccess e gera:

- `config/dbaccess.ini`, com a senha codificada no formato esperado pelo DBAccess;
- `config/odbc.ini`, com o DSN `protheus`;
- `config/odbcinst.ini`, registrando o driver PostgreSQL ANSI.

Esse detalhe foi importante porque editar manualmente o `dbaccess.ini` pode corromper bytes da senha codificada. Quando isso acontece, a conexão falha de uma forma difícil de diagnosticar.

No lab validado, a conexão com PostgreSQL passou a funcionar com estes ajustes:

- `dbaccess.ini` gerado pelo `dbaccesscfg`;
- seção `[POSTGRES/protheus]` alinhada ao alias usado pelo AppServer;
- `ClientLibrary=/usr/lib64/libodbc.so`;
- DSN ODBC `protheus` montado em `/etc/odbc.ini`;
- driver ANSI `psqlodbca.so`;
- link de `libpsqlodbc.so` para o gerenciador ODBC dentro do container;
- ambiente AppServer usando o nome `PROTHEUS_DOCKER`, sem hífen.

Essas decisões ficaram documentadas no repositório porque são exatamente o tipo de conhecimento operacional que costuma se perder quando o ambiente depende apenas de tentativa e erro.

---

## AppServer e artefatos locais

O AppServer usa o ambiente `PROTHEUS_DOCKER`, definido em `config/appserver.ini`.

Os caminhos foram adaptados para os diretórios Linux usados dentro do container:

| Configuração | Caminho no container |
|---|---|
| `SourcePath` | `/opt/totvs/protheus/apo` |
| `RootPath` | `/opt/totvs/protheus/protheus_data` |
| `DBAccess Server` | `dbaccess-postgres` |
| `License Server` | `license` |

Os artefatos do Protheus precisam ser obtidos separadamente e mantidos fora do Git. Para este laboratório, os arquivos esperados são:

- `volumes/apo/tttm120.rpo`;
- `volumes/systemload/sxsbra.txt`;
- `volumes/systemload/sx2.unq`.

Também deixei o `RpoCustom` documentado no `appserver.ini.example`, mas sem apontar para o RPO base. No teste do laboratório, apontar `RpoCustom` para o RPO base causou falha ao carregar o APPMAP no WebApp.

Outro detalhe validado foi manter `volumes/systemload` montado com permissão de escrita. Mesmo com os arquivos existindo no container, a montagem somente leitura fez o AppServer reportar `SXSBRA.TXT not found`.

---

## Scripts operacionais

Mesmo em um laboratório, repetir comandos manualmente aumenta a chance de erro. Por isso, o repositório inclui scripts simples:

| Script | Função |
|---|---|
| `scripts/check.sh` | valida arquivos obrigatórios e o Compose antes da subida |
| `scripts/generate-dbaccess.sh` | gera configuração efetiva do DBAccess e ODBC |
| `scripts/up.sh` | valida e sobe o ambiente |
| `scripts/logs.sh` | acompanha logs de um serviço, por padrão o AppServer |
| `scripts/down.sh` | derruba o ambiente |

O fluxo principal ficou assim:

```bash
cp .env.example .env
cp config/appserver.ini.example config/appserver.ini
./scripts/generate-dbaccess.sh
./scripts/check.sh
./scripts/up.sh
```

E para acompanhar logs:

```bash
./scripts/logs.sh
```

Ou diretamente:

```bash
docker compose logs -f appserver
```

Essa automação é simples, mas estabelece uma rotina única de operação para o lab.

---

## Portas expostas

O laboratório expõe duas portas principais:

| Porta | Uso |
|---|---|
| `1234` | conexão TCP com o AppServer |
| `8080` | WebApp |

Essas portas também ficam parametrizadas no `.env`, permitindo ajuste local sem alterar o Compose.

---

## Decisões de engenharia

### Configuração como código

O ambiente deixa de depender apenas de instruções manuais e passa a ser descrito em arquivos versionados.

Isso melhora rastreabilidade, revisão e capacidade de reconstrução.

### Arquivos efetivos fora do Git

Arquivos como `.env`, `dbaccess.ini`, `appserver.ini`, RPO e `systemload` são locais.

O Git guarda os modelos, scripts e documentação, mas não publica artefatos sensíveis ou específicos da instalação.

### Validação antes da subida

O `scripts/check.sh` verifica se os arquivos obrigatórios existem e se o Compose é válido antes de executar o ambiente.

Essa checagem evita falhas previsíveis e documenta a preparação mínima esperada.

### Healthcheck no PostgreSQL

O DBAccess depende do PostgreSQL estar saudável, não apenas iniciado.

Essa decisão reduz falhas intermitentes causadas por ordem de inicialização.

### Escopo controlado

REST e outros serviços do ecossistema Protheus ficaram fora deste primeiro lab.

O objetivo foi validar uma base simples e estável antes de adicionar novos componentes.

---

## Limitações conhecidas

Este laboratório ainda tem limitações importantes:

- usa imagens de desenvolvimento da TOTVS Engineering Pro;
- não é destinado a produção;
- depende de artefatos Protheus obtidos separadamente;
- ainda não inclui pipeline CI/CD;
- ainda não inclui observabilidade;
- ainda não automatiza backup e restore do PostgreSQL;
- `depends_on` ajuda na ordem de inicialização, mas não substitui testes funcionais completos.

Essas limitações fazem parte do desenho do primeiro lab. A proposta é começar com uma base validada e evoluir por etapas.

---

## Roadmap

O repositório já documenta uma sequência planejada para a série:

| Parte | Tema | Status |
|---|---|---|
| 1 | Criando um laboratório Protheus com Docker | Validado |
| 2 | Organização do projeto e boas práticas com Docker Compose | Planejado |
| 3 | Automatizando o ambiente com scripts e Makefile | Planejado |
| 4 | Gerenciamento de configurações com `.env` | Planejado |
| 5 | Persistência de dados e volumes Docker | Planejado |
| 6 | Atualizando imagens do Protheus com segurança | Planejado |
| 7 | Integrando o laboratório com GitHub Actions | Planejado |

---

## Repositório

O código do laboratório está disponível no GitHub:

[github.com/dirleiflsilva/protheus-docker-lab](https://github.com/dirleiflsilva/protheus-docker-lab)

O estado usado como referência para este post foi validado em `2026-07-08`, no commit `2781f4a` (`Valida ambiente base Protheus Docker`).

---

## Conclusão

Este lab mostrou que é possível criar uma base Protheus mais organizada para estudo e desenvolvimento usando Docker Compose, configuração versionada e pequenas automações.

O ganho principal não está apenas em subir containers. Está em documentar decisões, reduzir improviso, preservar aprendizados de troubleshooting e criar um ambiente que possa evoluir com segurança.

Para quem trabalha com Protheus e quer aproximar o dia a dia de práticas DevOps, esse tipo de laboratório é um bom ponto de partida: pequeno o suficiente para ser compreendido, mas estruturado o bastante para sustentar próximos experimentos.
