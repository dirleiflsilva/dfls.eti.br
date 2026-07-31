---
title: "SQL da Semana #07 — LATERAL: subconsultas para cada linha"
date: 2026-08-27
draft: true
toc: true
slug: "sql-da-semana-07-lateral-postgresql"
description: "Aprenda a usar LATERAL no PostgreSQL para executar subconsultas correlacionadas no FROM e buscar os primeiros registros de cada grupo."
tags:
  - postgresql
  - sql
  - lateral
  - top-n-per-group
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 7
---

Subconsultas colocadas no `FROM` normalmente são independentes das tabelas que aparecem antes delas.

Mas alguns problemas exigem que a subconsulta seja avaliada para cada linha externa. Um exemplo comum é buscar os três produtos mais vendidos de cada categoria.

No PostgreSQL, `LATERAL` permite expressar essa dependência diretamente.

## O problema

Considere as tabelas:

```sql
CREATE TABLE categories (
    category_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text NOT NULL
);

CREATE TABLE products (
    product_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL REFERENCES categories,
    name        text NOT NULL,
    sales_count integer NOT NULL DEFAULT 0
);
```

Queremos listar cada categoria acompanhada dos três produtos com maior `sales_count`.

## Por que uma subconsulta comum não resolve diretamente?

Esta tentativa não consegue acessar `c.category_id`:

```sql
SELECT *
FROM categories AS c
JOIN (
    SELECT *
    FROM products AS p
    WHERE p.category_id = c.category_id
    ORDER BY p.sales_count DESC
    LIMIT 3
) AS top_products ON true;
```

A subconsulta no `FROM` possui seu próprio escopo. Ao adicionar `LATERAL`, ela passa a poder usar colunas dos itens anteriores:

```sql
SELECT
    c.category_id,
    c.name AS category_name,
    p.product_id,
    p.name AS product_name,
    p.sales_count
FROM categories AS c
CROSS JOIN LATERAL (
    SELECT
        product_id,
        name,
        sales_count
    FROM products AS p
    WHERE p.category_id = c.category_id
    ORDER BY p.sales_count DESC, p.product_id
    LIMIT 3
) AS p
ORDER BY c.name, p.sales_count DESC, p.product_id;
```

Para cada categoria, a subconsulta recebe o `category_id` atual, ordena apenas seus produtos e devolve até três linhas.

## CROSS JOIN LATERAL e categorias vazias

Com `CROSS JOIN LATERAL`, uma categoria sem produtos não aparece, pois a subconsulta não produz linhas.

Se todas as categorias precisam permanecer no resultado, use `LEFT JOIN LATERAL`:

```sql
SELECT
    c.category_id,
    c.name AS category_name,
    p.product_id,
    p.name AS product_name,
    p.sales_count
FROM categories AS c
LEFT JOIN LATERAL (
    SELECT
        product_id,
        name,
        sales_count
    FROM products AS p
    WHERE p.category_id = c.category_id
    ORDER BY p.sales_count DESC, p.product_id
    LIMIT 3
) AS p ON true
ORDER BY c.name, p.sales_count DESC NULLS LAST;
```

O `ON true` indica que a correlação principal já está dentro da subconsulta. O `LEFT JOIN` preserva a linha externa mesmo quando não existe produto correspondente.

## Buscando o registro mais recente por entidade

Outro uso recorrente é recuperar um único registro relacionado:

```sql
SELECT
    c.customer_id,
    c.name,
    ultimo_pedido.order_id,
    ultimo_pedido.created_at,
    ultimo_pedido.total
FROM customers AS c
LEFT JOIN LATERAL (
    SELECT
        o.order_id,
        o.created_at,
        o.total
    FROM orders AS o
    WHERE o.customer_id = c.customer_id
    ORDER BY o.created_at DESC, o.order_id DESC
    LIMIT 1
) AS ultimo_pedido ON true;
```

Esse problema também pode ser resolvido com [`DISTINCT ON`](/posts/sql-da-semana-03-distinct-on-postgresql/) ou Window Functions. A melhor alternativa depende do volume, dos índices, das colunas necessárias e do plano escolhido.

## LATERAL com funções

Funções que retornam conjuntos podem usar valores da linha externa. Para funções, a palavra `LATERAL` muitas vezes é opcional, mas escrevê-la pode deixar a dependência evidente:

```sql
SELECT
    e.event_id,
    item.key,
    item.value
FROM events AS e
CROSS JOIN LATERAL jsonb_each_text(e.payload) AS item;
```

Cada documento `payload` é expandido em pares de chave e valor.

## O índice importa

Para a consulta dos produtos mais vendidos, um índice compatível pode ajudar:

```sql
CREATE INDEX products_category_sales_idx
    ON products (category_id, sales_count DESC, product_id);
```

Ele acompanha o filtro por categoria e a ordenação usada para o `LIMIT`. Isso não significa que o índice será sempre escolhido; confirme com `EXPLAIN (ANALYZE, BUFFERS)` e dados representativos.

## Cuidados

Uma subconsulta lateral pode ser executada repetidamente para muitas linhas externas. Em grandes volumes, essa característica precisa ser observada no plano.

Antes de escolher a abordagem:

- confira a cardinalidade da tabela externa;
- crie índices coerentes com filtro e ordenação;
- use desempates determinísticos;
- compare com Window Functions ou `DISTINCT ON`;
- meça com dados próximos do cenário real.

## Quando usar

`LATERAL` é uma boa ferramenta para:

- obter os primeiros ou últimos N registros de cada grupo;
- calcular uma subconsulta dependente de cada linha;
- expandir arrays ou documentos JSON;
- chamar funções que retornam conjuntos;
- preservar entidades sem correspondência com `LEFT JOIN LATERAL`.

O ponto central é o escopo: a expressão lateral consegue enxergar as colunas declaradas antes dela no `FROM`.

## Referência

- [PostgreSQL: expressões de tabela e LATERAL](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-LATERAL)

