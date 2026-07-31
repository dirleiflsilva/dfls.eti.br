---
title: "SQL da Semana #05 — CTE: organizando consultas complexas"
date: 2026-08-13
draft: true
toc: true
slug: "sql-da-semana-05-cte-postgresql"
description: "Aprenda a usar Common Table Expressions com WITH para dividir consultas SQL em etapas nomeadas, legíveis e reutilizáveis."
tags:
  - postgresql
  - sql
  - cte
  - with
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 5
---

Consultas SQL costumam crescer de maneira incremental.

Primeiro precisamos filtrar os dados. Depois agregar por cliente, calcular uma média, comparar cada resultado com essa média e ordenar somente os casos mais relevantes.

Quando todas essas etapas ficam aninhadas em uma única expressão, a consulta pode continuar correta, mas se torna difícil de ler e modificar.

Uma **Common Table Expression**, ou CTE, permite dividir esse raciocínio em resultados nomeados.

## O problema

Considere uma tabela com execuções de pipelines:

```sql
CREATE TABLE execucoes_pipeline (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pipeline      text NOT NULL,
    status        text NOT NULL,
    iniciado_em   timestamptz NOT NULL,
    finalizado_em timestamptz
);
```

Queremos encontrar pipelines que, nos últimos 30 dias:

- tiveram pelo menos cinco execuções finalizadas;
- apresentaram duração média acima da média geral;
- exibam também sua taxa de falhas.

## Dividindo o problema em etapas

Com `WITH`, cada etapa recebe um nome:

```sql
WITH execucoes_recentes AS (
    SELECT
        pipeline,
        status,
        extract(epoch FROM finalizado_em - iniciado_em) AS duracao_segundos
    FROM execucoes_pipeline
    WHERE iniciado_em >= current_date - interval '30 days'
      AND finalizado_em IS NOT NULL
),
metricas_por_pipeline AS (
    SELECT
        pipeline,
        count(*) AS execucoes,
        avg(duracao_segundos) AS duracao_media,
        count(*) FILTER (WHERE status = 'failed')::numeric
            / count(*) AS taxa_falha
    FROM execucoes_recentes
    GROUP BY pipeline
),
media_geral AS (
    SELECT avg(duracao_media) AS duracao_media_geral
    FROM metricas_por_pipeline
)
SELECT
    m.pipeline,
    m.execucoes,
    round(m.duracao_media, 2) AS duracao_media_segundos,
    round(m.taxa_falha * 100, 2) AS taxa_falha_percentual
FROM metricas_por_pipeline AS m
CROSS JOIN media_geral AS g
WHERE m.execucoes >= 5
  AND m.duracao_media > g.duracao_media_geral
ORDER BY m.duracao_media DESC;
```

A consulta pode ser lida como uma sequência:

1. selecionar execuções recentes;
2. calcular métricas por pipeline;
3. calcular a média geral;
4. filtrar e apresentar o resultado.

## Uma CTE não cria uma tabela permanente

Os nomes `execucoes_recentes`, `metricas_por_pipeline` e `media_geral` existem apenas durante a execução do comando.

Eles funcionam como resultados auxiliares disponíveis para a consulta principal e para CTEs declaradas depois deles.

Isso permite reutilizar um resultado intermediário sem criar tabelas temporárias apenas para organizar a consulta.

## CTE e subconsulta são sempre equivalentes?

Muitas CTEs poderiam ser escritas como subconsultas. A escolha deve considerar clareza e plano de execução.

Nas versões atuais do PostgreSQL, uma CTE não recursiva, sem efeitos colaterais e referenciada uma vez pode ser incorporada à consulta principal. Quando ela é materializada, o resultado intermediário é calculado separadamente.

Podemos tornar a intenção explícita em situações específicas:

```sql
WITH dados AS MATERIALIZED (
    SELECT ...
)
SELECT ...
FROM dados;
```

ou:

```sql
WITH dados AS NOT MATERIALIZED (
    SELECT ...
)
SELECT ...
FROM dados;
```

Essas opções não devem ser aplicadas por regra geral. Compare os planos com `EXPLAIN (ANALYZE, BUFFERS)` quando a decisão afetar uma consulta importante.

## CTEs também podem modificar dados

O `WITH` pode acompanhar comandos de escrita e usar `RETURNING` para encadear operações:

```sql
WITH jobs_finalizados AS (
    UPDATE jobs
    SET status = 'archived'
    WHERE status = 'success'
      AND finalizado_em < current_date - interval '90 days'
    RETURNING id, pipeline, finalizado_em
)
INSERT INTO jobs_archive (job_id, pipeline, finalizado_em)
SELECT id, pipeline, finalizado_em
FROM jobs_finalizados;
```

Esse tipo de comando exige atenção à semântica e aos efeitos de escrita, mas pode expressar uma operação composta de maneira atômica.

## E as CTEs recursivas?

Com `WITH RECURSIVE`, uma CTE pode referenciar o próprio resultado. Isso permite percorrer hierarquias, dependências e grafos simples.

```sql
WITH RECURSIVE arvore AS (
    SELECT id, parent_id, nome, 0 AS nivel
    FROM categorias
    WHERE parent_id IS NULL

    UNION ALL

    SELECT c.id, c.parent_id, c.nome, a.nivel + 1
    FROM categorias AS c
    JOIN arvore AS a ON a.id = c.parent_id
)
SELECT *
FROM arvore
ORDER BY nivel, nome;
```

CTEs recursivas merecem um artigo próprio. O ponto importante aqui é perceber que `WITH` vai além da organização visual.

## Quando usar

CTEs funcionam bem quando:

- a consulta possui etapas conceituais claras;
- um resultado intermediário precisa ser reutilizado;
- nomes ajudam a documentar a regra de negócio;
- precisamos encadear comandos com `RETURNING`;
- existe uma estrutura hierárquica ou recursiva.

Evite criar dezenas de CTEs pequenas que apenas renomeiam operações triviais. A consulta continua precisando ser compreensível como um todo.

## Conclusão

CTEs ajudam a escrever SQL como uma sequência de transformações nomeadas.

O principal benefício é tornar o raciocínio mais explícito. O impacto no desempenho, porém, deve ser observado no plano de execução em vez de deduzido apenas pela aparência da consulta.

## Referência

- [PostgreSQL: consultas WITH e Common Table Expressions](https://www.postgresql.org/docs/current/queries-with.html)

