---
title: "PostgreSQL Reliability Lab - Lab 02: Inicialização de banco de dados"
date: 2026-07-12
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados"
tags:
  - postgresql
  - database
  - dbre
  - docker
  - devops
categories:
  - Projetos & Labs
description: "Evoluindo um PostgreSQL reproduzível para uma base realista, com roles, schemas, extensões, modelo de e-commerce e carga de dados automatizada."
---

No Lab 01, construímos a fundação: uma instância PostgreSQL reproduzível, persistente e validada com Docker.

Mas subir um banco saudável é apenas o primeiro passo. Para testar backup, replicação, observabilidade ou performance, precisamos de uma base que se aproxime de um cenário real: usuários com responsabilidades diferentes, schemas bem definidos, extensões operacionais, relacionamentos, índices e dados suficientes para exercitar o ambiente.

Esse é o objetivo do **Lab 02 do PostgreSQL Reliability Lab**.

---

## Objetivo

Evoluir a fundação do projeto para um banco PostgreSQL que:

- crie roles específicas para aplicação e operação
- separe objetos por responsabilidade usando schemas
- habilite extensões de diagnóstico e suporte
- modele um domínio simples de e-commerce
- carregue uma massa de dados reproduzível
- valide automaticamente todos os componentes do bootstrap

Ao final, temos uma base pronta para sustentar os próximos labs de backup, replicação, failover, observabilidade e performance.

---

## Estrutura do lab

O Lab 02 organiza a inicialização em scripts SQL numerados:

```text
labs/02-database-initialization/
├── .env.example
├── docker-compose.yml
├── init/
│   ├── 01_roles.sql
│   ├── 02_extensions.sql
│   ├── 03_schemas.sql
│   ├── 04_tables.sql
│   ├── 05_seed_procedures.sql
│   └── 06_load_sample_data.sql
├── scripts/
│   └── check.sh
└── README.md
```

O PostgreSQL executa os arquivos de `init/` em ordem alfabética durante a primeira inicialização de um volume vazio. A numeração torna explícita a dependência entre cada etapa: primeiro as identidades, depois as extensões e schemas, em seguida as tabelas e, por último, os dados.

---

## Roles separadas por responsabilidade

Em vez de concentrar todas as operações no superusuário `postgres`, o lab cria cinco roles:

- `app_owner`: proprietária dos objetos da aplicação
- `app_user`: identidade de leitura e escrita usada pela aplicação
- `readonly`: acesso somente para consultas
- `backup_user`: preparada para backup físico e replicação
- `monitor_user`: recebe a role nativa `pg_monitor`

Um trecho simplificado da criação é:

```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
        CREATE ROLE app_owner NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'app_user_password';
    END IF;
END
$$;

GRANT app_owner TO app_user;
GRANT pg_monitor TO monitor_user;
```

Essa separação aplica o princípio do menor privilégio e cria desde cedo as identidades que serão usadas nos cenários operacionais dos próximos labs.

> As senhas presentes nos scripts são exclusivas para o laboratório local. Em um ambiente real, credenciais devem ser armazenadas e distribuídas por um gerenciador de secrets.

---

## Schemas e privilégios

Os objetos são divididos em três schemas:

- `app`: tabelas do domínio da aplicação
- `audit`: eventos e trilhas de auditoria
- `seed`: procedures usadas para gerar dados

O lab também remove do público permissões que não são necessárias:

```sql
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION app_owner;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION app_owner;
CREATE SCHEMA IF NOT EXISTS seed AUTHORIZATION app_owner;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

Além dos grants atuais, são configurados **privilégios padrão** para objetos que `app_owner` criar no futuro. Isso evita um problema recorrente: uma tabela nova ser criada corretamente, mas ficar inacessível à aplicação ou à role de leitura.

---

## Extensões para operação e diagnóstico

Três extensões são habilitadas:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

O `docker-compose.yml` inicia o PostgreSQL com `pg_stat_statements` em `shared_preload_libraries` e habilita `track_io_timing`. Assim, o ambiente já coleta informações úteis para os labs de observabilidade e análise de performance.

---

## Um modelo de dados mais realista

O domínio escolhido foi um e-commerce simples, composto por:

- clientes e endereços
- categorias e produtos
- pedidos e itens
- pagamentos
- eventos de auditoria

As tabelas usam chaves estrangeiras, restrições, índices, UUID, JSONB e colunas geradas. Por exemplo, o valor total de um item é calculado pelo próprio PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS app.order_items (
    order_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL
        REFERENCES app.orders(order_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL
        REFERENCES app.products(product_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
    total_price NUMERIC(12, 2)
        GENERATED ALWAYS AS (quantity * unit_price) STORED
);
```

Esse conjunto é pequeno o bastante para ser compreendido rapidamente, mas diverso o suficiente para testar joins, agregações, integridade referencial, backups, restores e comportamento de consultas.

---

## Geração reproduzível de dados

A procedure `seed.load_sample_data` concentra a criação da massa de teste. Por padrão, ela gera:

- 100 clientes
- 5 categorias
- 50 produtos
- 500 pedidos
- itens, pagamentos e eventos de auditoria relacionados

```sql
CALL seed.load_sample_data(100, 5, 50, 500);
```

Usar PL/pgSQL mantém a carga junto do banco e elimina dependências de ferramentas ou arquivos externos. A procedure também utiliza restrições e `ON CONFLICT` nos cadastros principais para evitar duplicações nessas entidades.

---

## Subindo o ambiente

Clone o repositório e entre no diretório do lab:

```bash
cd labs/02-database-initialization
cp .env.example .env
```

Antes de iniciar, ajuste `POSTGRES_PASSWORD` no arquivo `.env`. Depois execute:

```bash
docker compose up -d
docker compose ps
```

O container deve chegar ao estado `healthy`. O Lab 02 expõe o PostgreSQL na porta `5433`, evitando conflito com a porta padrão usada pelo Lab 01.

> Assim como no Lab 01, os scripts de inicialização só são executados automaticamente quando o diretório de dados está vazio.

Para reconstruir toda a base:

```bash
docker compose down -v
docker compose up -d
```

O comando remove também os dados persistidos no volume. Portanto, ele deve ser usado apenas quando a intenção for reinicializar o laboratório do zero.

---

## Validação automatizada

O script `scripts/check.sh` não verifica apenas se o processo do PostgreSQL está em execução. Ele confirma que o bootstrap entregou o estado esperado:

- container em execução e banco acessível com `pg_isready`
- cinco roles criadas
- schemas `app`, `audit` e `seed` disponíveis
- extensões instaladas
- quantidade mínima de registros nas tabelas principais
- pedidos acompanhados por itens, pagamentos e eventos de auditoria

Para executar:

```bash
chmod +x scripts/check.sh
./scripts/check.sh
```

Resultado esperado:

```text
ok: database initialization validado com roles, schemas, extensões, tabelas e dados.
```

Essa validação transforma a inicialização em uma propriedade verificável: não basta o container estar de pé; o banco precisa estar pronto para cumprir seu papel.

---

## Conectando ao banco

Via container:

```bash
docker compose exec postgres psql -U postgres -d appdb
```

Ou com um cliente `psql` instalado no host:

```bash
psql "postgresql://postgres:SUA_SENHA@localhost:5433/appdb"
```

Dentro do `psql`, alguns comandos ajudam a inspecionar o resultado:

```psql
\dn
\dt app.*
\dt audit.*
\du
\dx
```

---

## Decisões de engenharia

### Scripts SQL numerados

O bootstrap tem uma ordem determinística e fácil de auditar. Cada arquivo possui uma responsabilidade clara e pode evoluir sem transformar a inicialização em um único script monolítico.

### Propriedade e acesso separados

Objetos pertencem a `app_owner`, enquanto a aplicação opera com `app_user`. Isso reduz o acoplamento entre execução e administração do schema.

### Dados gerados dentro do PostgreSQL

A procedure de seed permite variar o volume de dados e reproduzir a carga sem instalar outra linguagem ou ferramenta.

### Validação do estado, não apenas do processo

Healthcheck responde se o PostgreSQL aceita conexões. O `check.sh` vai além e verifica se roles, schemas, extensões, tabelas e dados realmente foram criados.

---

## Próximo passo

Com uma base realista e reproduzível, o próximo lab poderá tratar de **backup e restore**: backup lógico, backup físico, WAL archiving e recuperação point-in-time.

O código completo do Lab 02 está disponível no GitHub:

👉 [PostgreSQL Reliability Lab — Lab 02: Database Initialization](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/02-database-initialization)
