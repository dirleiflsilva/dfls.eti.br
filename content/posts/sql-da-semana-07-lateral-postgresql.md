---
title: "SQL da Semana #07 — LATERAL: subconsultas para cada linha"
date: 2026-09-04
draft: false
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
    name        text NOT NULL UNIQUE
);

CREATE TABLE products (
    product_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL REFERENCES categories,
    name        text NOT NULL,
    sales_count integer NOT NULL DEFAULT 0
);
```

Queremos listar cada categoria acompanhada dos três produtos com maior `sales_count`.

## Dados para reproduzir o cenário

A massa de exemplo possui quatro categorias e onze produtos. Uma categoria não possui produtos, outra possui apenas dois e dois produtos de banco de dados estão empatados em vendas.

Esses casos permitem observar:

- o limite de até três produtos por categoria;
- o desempate determinístico;
- a diferença entre `CROSS JOIN LATERAL` e `LEFT JOIN LATERAL`;
- categorias com menos de três produtos;
- categorias sem produto algum.

```sql
INSERT INTO categories (name)
VALUES
    ('Banco de dados'),
    ('DevOps'),
    ('Backend'),
    ('Sem produtos');

INSERT INTO products (category_id, name, sales_count)
SELECT
    c.category_id,
    data.product_name,
    data.sales_count
FROM (
    VALUES
        ('Banco de dados', 'PostgreSQL para operações', 980),
        ('Banco de dados', 'Backup e PITR', 850),
        ('Banco de dados', 'Otimização SQL', 850),
        ('Banco de dados', 'Streaming replication', 720),
        ('Banco de dados', 'Índices no PostgreSQL', 680),
        ('DevOps', 'Docker Compose', 930),
        ('DevOps', 'CI/CD', 810),
        ('DevOps', 'Observabilidade', 760),
        ('DevOps', 'Infraestrutura como código', 700),
        ('Backend', 'FastAPI', 870),
        ('Backend', 'APIs REST', 820)
) AS data(category_name, product_name, sales_count)
JOIN categories AS c
  ON c.name = data.category_name
ORDER BY c.category_id, data.product_name;
```

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

O resultado possui oito linhas: três produtos de Banco de dados, três de DevOps e dois de Backend. A categoria Sem produtos não aparece. Entre os dois produtos com 850 vendas, `product_id` define uma ordem estável; sem esse segundo critério, qualquer um deles poderia aparecer primeiro.

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
ORDER BY c.name, p.sales_count DESC NULLS LAST, p.product_id;
```

O `ON true` aceita todas as linhas devolvidas pela subconsulta, sem aplicar outro filtro na junção. Neste exemplo, a correlação com a categoria está no `WHERE` da subconsulta. O `LEFT JOIN` preserva a linha externa mesmo quando não existe produto correspondente.

Agora o resultado possui nove linhas. A categoria Sem produtos aparece uma vez, com as colunas de `p` preenchidas com `NULL`.

## Buscando um único registro por entidade

Outro uso recorrente é recuperar um único registro relacionado. No mesmo cenário, podemos reduzir o limite para obter o produto mais vendido de cada categoria:

```sql
SELECT
    c.category_id,
    c.name AS category_name,
    top_product.product_id,
    top_product.name AS product_name,
    top_product.sales_count
FROM categories AS c
LEFT JOIN LATERAL (
    SELECT
        p.product_id,
        p.name,
        p.sales_count
    FROM products AS p
    WHERE p.category_id = c.category_id
    ORDER BY p.sales_count DESC, p.product_id
    LIMIT 1
) AS top_product ON true
ORDER BY c.name;
```

Esse problema também pode ser resolvido com [`DISTINCT ON`](/posts/sql-da-semana-03-distinct-on-postgresql/) ou [funções de janela](/posts/sql-da-semana-06-window-functions-postgresql/). Para os primeiros N registros, `row_number()` oferece uma alternativa geral:

```sql
SELECT
    category_id,
    category_name,
    product_id,
    product_name,
    sales_count
FROM (
    SELECT
        c.category_id,
        c.name AS category_name,
        p.product_id,
        p.name AS product_name,
        p.sales_count,
        row_number() OVER (
            PARTITION BY c.category_id
            ORDER BY p.sales_count DESC, p.product_id
        ) AS position
    FROM categories AS c
    JOIN products AS p
      ON p.category_id = c.category_id
) AS ranked_products
WHERE position <= 3
ORDER BY category_name, sales_count DESC, product_id;
```

A consulta com `row_number()` retorna as mesmas oito linhas do exemplo com `CROSS JOIN LATERAL`. Como usa uma junção interna com `products`, também omite a categoria Sem produtos.

A versão com janela numera os produtos de cada categoria na ordem definida antes de filtrar as três primeiras posições. A versão lateral pode combinar uma busca por categoria com `LIMIT`. A escolha depende do volume, da distribuição dos dados, dos índices e do plano produzido pelo PostgreSQL.

## LATERAL com funções

Funções no `FROM` podem receber argumentos que referenciam colunas de itens anteriores. Nesse caso, a palavra `LATERAL` é opcional, mas escrevê-la pode deixar a dependência evidente:

```sql
SELECT
    e.event_id,
    item.key,
    item.value
FROM (
    VALUES
        (1, '{"source":"site","status":"paid"}'::jsonb),
        (2, '{"source":"api","status":"pending"}'::jsonb)
) AS e(event_id, payload)
CROSS JOIN LATERAL jsonb_each_text(e.payload) AS item;
```

Cada documento `payload` é expandido em pares de chave e valor. Neste exemplo, os dois eventos produzem quatro linhas no total. Para garantir a ordem de exibição, acrescente `ORDER BY e.event_id, item.key` à consulta.

## O índice importa

Para a consulta dos produtos mais vendidos, um índice compatível pode ajudar:

```sql
CREATE INDEX products_category_sales_idx
    ON products (category_id, sales_count DESC, product_id);
```

Ele acompanha o filtro por categoria e a ordenação usada para o `LIMIT`. Isso não significa que o índice será sempre escolhido; confirme com `EXPLAIN (ANALYZE, BUFFERS)` e dados representativos.

Com apenas onze produtos, é normal que o PostgreSQL prefira uma leitura sequencial. A massa pequena valida o resultado das consultas, mas não serve como evidência de desempenho. Por isso, o README do laboratório deixa explícito que o exercício é funcional; para comparar planos, use uma carga maior e representativa do cenário real.

## Cuidados

Uma subconsulta lateral pode ser executada repetidamente para muitas linhas externas. Em grandes volumes, essa característica precisa ser observada no plano.

Antes de escolher a abordagem:

- confira a cardinalidade da tabela externa;
- crie índices coerentes com filtro e ordenação;
- use desempates determinísticos;
- compare com funções de janela ou, para um registro por grupo, `DISTINCT ON`;
- meça com dados próximos do cenário real.

## Quando usar

`LATERAL` é uma boa ferramenta para:

- obter os primeiros ou últimos N registros de cada grupo;
- calcular uma subconsulta dependente de cada linha;
- expandir arrays ou documentos JSON;
- chamar funções que retornam conjuntos;
- preservar entidades sem correspondência com `LEFT JOIN LATERAL`.

O ponto central é o escopo: a expressão lateral consegue enxergar as colunas declaradas antes dela no `FROM`.

## Pratique no laboratório

O [laboratório do episódio 07](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/07-lateral) reproduz o cenário deste artigo e já está disponível no GitHub.

O diretório segue o padrão dos episódios anteriores:

```text
episodios/07-lateral/
|-- 01-tabelas.sql
|-- 02-dados.sql
|-- 03-consultas.sql
`-- README.md
```

O primeiro arquivo recria o schema `sql_semana_07` e cria `categories` e `products`. O segundo insere as quatro categorias e os onze produtos. O terceiro reúne, nesta ordem:

1. os três produtos mais vendidos com `CROSS JOIN LATERAL`;
2. a preservação da categoria vazia com `LEFT JOIN LATERAL`;
3. o produto mais vendido de cada categoria com `LIMIT 1`;
4. a solução alternativa com `row_number()`;
5. a expansão do JSON com `jsonb_each_text()`;
6. a criação do índice e o `EXPLAIN (ANALYZE, BUFFERS)`.

O `README.md` descreve o cenário, os resultados esperados e o que observar em cada consulta.

Depois de preparar o PostgreSQL conforme o [README do repositório](https://github.com/dirleiflsilva/sql-da-semana-postgresql), execute no `psql` aberto dentro do contêiner:

```text
\i /sql-da-semana/07-lateral/01-tabelas.sql
\i /sql-da-semana/07-lateral/02-dados.sql
\i /sql-da-semana/07-lateral/03-consultas.sql
```

Esses caminhos são os usados dentro do contêiner do laboratório. Se usar um cliente SQL no host, abra os arquivos locais em `episodios/07-lateral/` e execute-os na mesma ordem.

Como critério funcional, a primeira consulta deve retornar oito linhas e omitir Sem produtos. A segunda deve retornar nove linhas e preservar essa categoria com valores `NULL`. A terceira deve retornar quatro linhas, uma por categoria.

## Conclusão

`LATERAL` permite que um item do `FROM` use valores produzidos pelos itens anteriores. Isso torna natural expressar buscas como “os três produtos mais vendidos de cada categoria” ou “um único registro relacionado a cada entidade”.

O tipo de junção controla o que acontece quando a expressão lateral não devolve linhas: `CROSS JOIN` elimina a linha externa e `LEFT JOIN` a preserva. Com ordenação determinística, índices coerentes e medição do plano, o recurso se torna uma alternativa clara para problemas de top-N por grupo.

## Referências

- [PostgreSQL: expressões de tabela e LATERAL](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-LATERAL)
- [PostgreSQL: índices e ORDER BY](https://www.postgresql.org/docs/current/indexes-ordering.html)
