---
title: "10 recursos de SQL que todo profissional de dados deveria dominar"
date: 2026-08-03
draft: true
toc: true
slug: "10-recursos-sql-profissional-dados"
description: "De CTEs e Window Functions a planos de execução e controle de concorrência: dez recursos de SQL para resolver problemas de dados com mais clareza e segurança."
tags:
  - postgresql
  - sql
  - data-platform
  - engenharia de dados
  - performance
topics:
  - PostgreSQL e SQL
---

Aprender SQL costuma começar com `SELECT`, `WHERE`, `JOIN`, `GROUP BY` e `ORDER BY`.

Esses fundamentos resolvem muitos problemas, mas o trabalho cotidiano com bancos de dados logo exige mais. Precisamos obter o registro mais recente de cada grupo, calcular acumulados, carregar dados sem criar duplicidades, investigar consultas lentas e coordenar operações concorrentes.

Nesse ponto, conhecer apenas a sintaxe básica deixa de ser suficiente.

Este artigo reúne dez recursos que considero especialmente úteis para quem trabalha com PostgreSQL, Engenharia de Dados, DBRE ou desenvolvimento de sistemas. A lista não pretende esgotar o SQL. Ela funciona como um mapa do que estudar depois dos fundamentos.

## 1. Common Table Expressions

Uma Common Table Expression, ou CTE, permite nomear um resultado intermediário com `WITH`:

```sql
WITH vendas_por_cliente AS (
    SELECT
        cliente_id,
        sum(valor) AS total
    FROM vendas
    GROUP BY cliente_id
)
SELECT cliente_id, total
FROM vendas_por_cliente
WHERE total > 10000;
```

O ganho mais imediato é de organização. Em vez de concentrar toda a lógica em uma consulta profundamente aninhada, podemos dar nomes às etapas do raciocínio.

CTEs também podem ser recursivas e participar de comandos de escrita. Entretanto, não devem ser tratadas automaticamente como uma técnica de otimização: seu efeito no plano depende da consulta, da versão do PostgreSQL e do uso de `MATERIALIZED` ou `NOT MATERIALIZED`.

## 2. Window Functions

Funções de janela calculam valores relacionados a outras linhas sem reduzir o resultado a uma linha por grupo:

```sql
SELECT
    vendedor_id,
    data_venda,
    valor,
    sum(valor) OVER (
        PARTITION BY vendedor_id
        ORDER BY data_venda
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS acumulado
FROM vendas;
```

Elas resolvem rankings, acumulados, comparações com linhas anteriores e posteriores, percentuais e diversas análises temporais.

Vale dominar pelo menos `row_number()`, `rank()`, `dense_rank()`, `lag()`, `lead()` e agregados acompanhados de `OVER`.

## 3. FILTER em agregações

`FILTER` permite calcular diferentes agregações sobre o mesmo conjunto de linhas:

```sql
SELECT
    count(*) AS total,
    count(*) FILTER (WHERE status = 'paid') AS pagos,
    count(*) FILTER (WHERE status = 'pending') AS pendentes
FROM pedidos;
```

O resultado costuma ficar mais direto do que repetir várias expressões `CASE`. Já publiquei um exemplo completo em [FILTER: agregações condicionais mais claras](/posts/sql-da-semana-02-filter-postgresql/).

## 4. DISTINCT ON

No PostgreSQL, `DISTINCT ON` é uma forma concisa de obter uma linha por grupo:

```sql
SELECT DISTINCT ON (pipeline)
    pipeline,
    status,
    finalizado_em
FROM execucoes_pipeline
ORDER BY pipeline, finalizado_em DESC, id DESC;
```

A ordenação é parte essencial da solução. Sem ela, não existe uma definição determinística de qual linha deve permanecer.

O artigo [DISTINCT ON: obtendo o registro mais recente por grupo](/posts/sql-da-semana-03-distinct-on-postgresql/) compara essa abordagem com `row_number()`.

## 5. RETURNING

Com `RETURNING`, comandos de escrita devolvem as linhas afetadas:

```sql
INSERT INTO jobs (tipo, status)
VALUES ('importacao', 'pending')
RETURNING id, status, created_at;
```

Isso evita uma consulta adicional apenas para recuperar um identificador ou conferir os dados gravados. O recurso funciona com `INSERT`, `UPDATE`, `DELETE` e `MERGE`.

Veja o exemplo detalhado em [RETURNING: obtendo dados sem fazer uma nova consulta](/posts/sql-da-semana-01-returning-postgresql/).

## 6. UPSERT com ON CONFLICT

Quando uma inserção encontra uma chave ou restrição de unicidade existente, `ON CONFLICT` permite ignorar ou atualizar a linha:

```sql
INSERT INTO metricas (chave, valor, atualizado_em)
VALUES ('jobs.processados', 42, now())
ON CONFLICT (chave)
DO UPDATE SET
    valor = EXCLUDED.valor,
    atualizado_em = EXCLUDED.atualizado_em;
```

O recurso é importante em cargas idempotentes, sincronizações e consumidores que podem receber novamente o mesmo evento. A restrição de unicidade continua sendo a base da garantia.

## 7. LATERAL

`LATERAL` permite que uma subconsulta no `FROM` utilize colunas de itens anteriores:

```sql
SELECT
    c.customer_id,
    ultimo.order_id,
    ultimo.created_at
FROM customers AS c
LEFT JOIN LATERAL (
    SELECT order_id, created_at
    FROM orders AS o
    WHERE o.customer_id = c.customer_id
    ORDER BY created_at DESC
    LIMIT 1
) AS ultimo ON true;
```

Ele é especialmente útil para buscar os primeiros ou últimos itens de cada grupo e para expandir funções que dependem da linha atual.

## 8. JSONB

Nem todo dado chega perfeitamente modelado em colunas relacionais. O PostgreSQL oferece `jsonb` para armazenar documentos JSON em uma representação que pode ser consultada e indexada:

```sql
SELECT payload ->> 'event_type' AS event_type
FROM eventos
WHERE payload @> '{"source": "billing"}';
```

`jsonb` é valioso para atributos variáveis, eventos e integrações, mas não elimina a necessidade de modelagem. Campos essenciais para integridade, relacionamento e consultas frequentes normalmente continuam melhores como colunas explícitas.

## 9. EXPLAIN e EXPLAIN ANALYZE

Uma consulta correta pode se tornar cara conforme os dados crescem. `EXPLAIN` mostra o plano escolhido pelo otimizador:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM pedidos
WHERE customer_id = 42;
```

`ANALYZE` executa a consulta e acrescenta tempos e quantidades reais. Por isso, deve ser usado com cuidado em comandos que alteram dados ou em ambientes sensíveis.

Aprender a reconhecer sequential scans, index scans, estimativas incorretas, loops e uso de buffers é mais útil do que criar índices por tentativa e erro.

## 10. Transações e controle de concorrência

Transações não servem apenas para agrupar comandos. Elas definem o que cada operação consegue observar e como mudanças concorrentes são coordenadas.

```sql
BEGIN;

SELECT id, status
FROM jobs
WHERE status = 'pending'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 1;

-- processar e atualizar o job selecionado

COMMIT;
```

Conhecer isolamento, locks, deadlocks, `FOR UPDATE`, `NOWAIT` e `SKIP LOCKED` ajuda a evitar duplicidade de processamento e inconsistências que não aparecem em testes com um único usuário.

## Como estudar esses recursos

Uma boa sequência é combinar leitura e experimento:

1. criar uma tabela pequena;
2. reproduzir o problema sem o recurso;
3. aplicar a nova construção;
4. testar casos de borda;
5. observar o plano com `EXPLAIN`;
6. aumentar o volume e comparar o comportamento.

O objetivo não é usar sintaxe avançada em toda consulta. É reconhecer quando um recurso expressa o problema com mais clareza, segurança ou eficiência.

## Referências

- [Documentação do PostgreSQL: consultas](https://www.postgresql.org/docs/current/queries.html)
- [Documentação do PostgreSQL: funções de janela](https://www.postgresql.org/docs/current/functions-window.html)
- [Documentação do PostgreSQL: uso de EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Documentação do PostgreSQL: controle de concorrência](https://www.postgresql.org/docs/current/mvcc.html)

