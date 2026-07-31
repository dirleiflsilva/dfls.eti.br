---
title: "SQL da Semana #04 — UPSERT: inserindo ou atualizando com segurança"
date: 2026-08-06
draft: true
toc: true
slug: "sql-da-semana-04-upsert-postgresql"
description: "Aprenda a usar INSERT ON CONFLICT no PostgreSQL para criar operações idempotentes e tratar conflitos de unicidade com segurança."
tags:
  - postgresql
  - sql
  - upsert
  - on-conflict
  - idempotência
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 4
---

Integrações, cargas de dados e consumidores de eventos frequentemente precisam executar uma operação simples de descrever:

> Se o registro ainda não existe, insira. Se já existe, atualize.

Esse comportamento é conhecido como **upsert**, combinação de *update* e *insert*.

No PostgreSQL, ele pode ser implementado com `INSERT ... ON CONFLICT`.

## O problema

Considere uma tabela que registra o estado mais recente de cada pipeline em uma data de referência:

```sql
CREATE TABLE pipeline_status (
    pipeline       text NOT NULL,
    reference_date date NOT NULL,
    status         text NOT NULL,
    attempts       integer NOT NULL DEFAULT 1,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pipeline_status_uk
        UNIQUE (pipeline, reference_date)
);
```

Uma mesma execução pode ser informada novamente por retry, reprocessamento ou entrega duplicada de mensagem.

Um `INSERT` comum falharia quando a combinação de `pipeline` e `reference_date` já estivesse cadastrada:

```sql
INSERT INTO pipeline_status (
    pipeline,
    reference_date,
    status
)
VALUES (
    'customers_daily',
    DATE '2026-08-06',
    'running'
);
```

Consultar antes e decidir na aplicação se devemos inserir ou atualizar parece uma solução, mas cria uma janela de concorrência. Duas transações podem concluir ao mesmo tempo que a linha não existe.

## Ignorando duplicidades com DO NOTHING

Quando repetir o registro não exige nenhuma mudança, podemos ignorar o conflito:

```sql
INSERT INTO pipeline_status (
    pipeline,
    reference_date,
    status
)
VALUES (
    'customers_daily',
    DATE '2026-08-06',
    'running'
)
ON CONFLICT (pipeline, reference_date)
DO NOTHING;
```

O PostgreSQL usa a restrição de unicidade para identificar o conflito. Se a linha já existir, o comando termina sem inserir uma nova cópia.

Essa forma é adequada quando a primeira gravação deve prevalecer.

## Atualizando com DO UPDATE

Se o novo evento representa um estado mais recente, podemos atualizar a linha existente:

```sql
INSERT INTO pipeline_status (
    pipeline,
    reference_date,
    status
)
VALUES (
    'customers_daily',
    DATE '2026-08-06',
    'success'
)
ON CONFLICT (pipeline, reference_date)
DO UPDATE SET
    status = EXCLUDED.status,
    attempts = pipeline_status.attempts + 1,
    updated_at = now();
```

`EXCLUDED` representa a linha que tentamos inserir. Por isso, `EXCLUDED.status` contém o novo valor recebido.

Ao mesmo tempo, podemos consultar os valores atuais da linha usando o nome da tabela, como em `pipeline_status.attempts`.

## Atualizando somente quando necessário

Nem todo conflito deve provocar uma escrita. Uma condição no `DO UPDATE` permite evitar atualizações sem mudança real:

```sql
INSERT INTO pipeline_status (
    pipeline,
    reference_date,
    status
)
VALUES (
    'customers_daily',
    DATE '2026-08-06',
    'success'
)
ON CONFLICT (pipeline, reference_date)
DO UPDATE SET
    status = EXCLUDED.status,
    attempts = pipeline_status.attempts + 1,
    updated_at = now()
WHERE pipeline_status.status IS DISTINCT FROM EXCLUDED.status;
```

`IS DISTINCT FROM` compara os valores de maneira previsível mesmo quando existe `NULL`.

## Recuperando o resultado com RETURNING

`ON CONFLICT` pode ser combinado com `RETURNING`:

```sql
INSERT INTO pipeline_status (
    pipeline,
    reference_date,
    status
)
VALUES (
    'customers_daily',
    DATE '2026-08-06',
    'success'
)
ON CONFLICT (pipeline, reference_date)
DO UPDATE SET
    status = EXCLUDED.status,
    attempts = pipeline_status.attempts + 1,
    updated_at = now()
RETURNING
    pipeline,
    reference_date,
    status,
    attempts,
    updated_at;
```

A aplicação recebe o estado final sem precisar executar outra consulta. Esse uso complementa o primeiro artigo da série, sobre [`RETURNING`](/posts/sql-da-semana-01-returning-postgresql/).

## A restrição é parte da solução

O banco precisa saber o que constitui um conflito. Normalmente isso vem de uma chave primária, restrição `UNIQUE` ou índice único compatível.

Sem uma regra de unicidade correta, o upsert não garante idempotência:

```sql
CONSTRAINT pipeline_status_uk
    UNIQUE (pipeline, reference_date)
```

A escolha das colunas deve representar a identidade do evento ou entidade no domínio, não apenas facilitar a sintaxe.

Também é possível indicar uma restrição pelo nome:

```sql
ON CONFLICT ON CONSTRAINT pipeline_status_uk
DO UPDATE SET status = EXCLUDED.status
```

## Cuidados importantes

### Não transforme todo conflito em atualização

Uma violação de unicidade pode revelar um erro de modelagem ou um dado inesperado. Use `DO UPDATE` apenas quando o conflito fizer parte do fluxo normal.

### Defina quais valores podem mudar

Evite substituir todas as colunas sem necessidade. Identificadores, datas de criação e valores imutáveis normalmente não devem ser regravados.

### Idempotência exige uma chave adequada

Repetir o mesmo comando com segurança depende de uma identidade estável. Se cada retry gerar uma chave diferente, `ON CONFLICT` não reconhecerá a duplicidade.

### Observe triggers e volume de escrita

Um `DO UPDATE` executa uma atualização real. Isso pode acionar triggers, gerar novas versões de linha e aumentar WAL. A condição `WHERE` ajuda quando eventos repetidos não alteram o estado.

## Quando usar

`INSERT ... ON CONFLICT` é especialmente útil em:

- sincronização entre sistemas;
- carga incremental;
- processamento de eventos com retry;
- atualização de configurações;
- manutenção de snapshots e estados atuais;
- APIs que recebem uma chave idempotente.

O recurso concentra a decisão no banco e elimina a separação insegura entre "consultar" e "depois gravar".

## Referência

- [PostgreSQL: INSERT e ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)

