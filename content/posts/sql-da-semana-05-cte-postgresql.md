---
title: "SQL da Semana #05 — CTE: organizando consultas complexas"
date: 2026-08-20
draft: false
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

## Dados para reproduzir o cenário

O [laboratório do episódio 05](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/05-cte) contém um conjunto de dados executável com:

- quinze execuções finalizadas nos últimos 30 dias;
- cinco execuções para cada pipeline;
- durações e taxas de falha diferentes;
- uma execução com mais de 30 dias;
- uma execução recente ainda não finalizada.

Essa composição permite observar tanto os cálculos quanto os filtros da consulta. Os arquivos estão separados em criação das tabelas, carga dos dados e consultas, para que cada etapa possa ser executada manualmente.

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
    WHERE iniciado_em >= current_timestamp - interval '30 days'
      AND finalizado_em IS NOT NULL
),
metricas_por_pipeline AS (
    SELECT
        pipeline,
        count(*) AS total_execucoes,
        round(avg(duracao_segundos), 2) AS duracao_media,
        round(
            100.0 * count(*) FILTER (WHERE status = 'falha') / count(*),
            2
        ) AS taxa_falhas_percentual
    FROM execucoes_recentes
    GROUP BY pipeline
),
media_geral AS (
    SELECT avg(duracao_segundos) AS duracao_media_geral
    FROM execucoes_recentes
)
SELECT
    m.pipeline,
    m.total_execucoes,
    m.duracao_media,
    m.taxa_falhas_percentual,
    round(g.duracao_media_geral, 2) AS duracao_media_geral
FROM metricas_por_pipeline AS m
CROSS JOIN media_geral AS g
WHERE m.total_execucoes >= 5
  AND m.duracao_media > g.duracao_media_geral
ORDER BY m.pipeline;
```

A consulta pode ser lida como uma sequência:

1. selecionar execuções recentes;
2. calcular métricas por pipeline;
3. calcular a média geral;
4. filtrar e apresentar o resultado.

A cláusula [`FILTER`](/posts/sql-da-semana-02-filter-postgresql/), usada para calcular a taxa de falhas, mantém a agregação condicional legível sem repetir expressões `CASE`.

## Resultado esperado

Com os dados do laboratório, a média geral das quinze execuções recentes é de **640 segundos**. A consulta retorna:

| Pipeline | Execuções | Duração média (s) | Taxa de falhas | Média geral (s) |
|---|---:|---:|---:|---:|
| `carga-vendas` | 5 | 720,00 | 20,00% | 640,00 |
| `relatorio` | 5 | 1.020,00 | 20,00% | 640,00 |

O pipeline `backup` possui duração média de 180 segundos e fica abaixo da média geral. A execução com 40 dias e aquela sem horário de término não participam dos cálculos.

## Uma CTE não cria uma tabela permanente

Os nomes `execucoes_recentes`, `metricas_por_pipeline` e `media_geral` existem apenas durante a execução do comando.

Eles funcionam como resultados auxiliares disponíveis para a consulta principal e para CTEs declaradas depois deles.

Isso permite reutilizar um resultado intermediário sem criar tabelas temporárias apenas para organizar a consulta.

## CTE e subconsulta são sempre equivalentes?

Muitas CTEs poderiam ser escritas como subconsultas. A escolha deve considerar clareza e plano de execução.

Nas versões atuais do PostgreSQL, uma CTE não recursiva, sem efeitos colaterais e referenciada uma vez pode ser incorporada à consulta principal. Quando é referenciada mais de uma vez, por padrão seu resultado é calculado separadamente e reutilizado. Esse comportamento evita trabalho duplicado, mas também pode impedir que alguns filtros da consulta principal sejam aplicados diretamente sobre a origem dos dados.

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

O `WITH` pode acompanhar comandos de escrita e usar [`RETURNING`](/posts/sql-da-semana-01-returning-postgresql/) para encadear operações:

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

Esse exemplo encadeia o `UPDATE` e o `INSERT` em uma única instrução SQL, usando o resultado de `RETURNING` como ligação entre as duas operações.

CTEs que modificam dados são executadas uma única vez e compartilham o mesmo snapshot. Quando uma instrução contém várias escritas independentes, a ordem efetiva entre elas é imprevisível; por isso, elas não devem tentar alterar as mesmas linhas. O fluxo de dados deve ser expresso por meio de `RETURNING`, como no exemplo.

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

## Pratique no laboratório

O repositório [SQL da Semana — laboratórios PostgreSQL](https://github.com/dirleiflsilva/sql-da-semana-postgresql) fornece um PostgreSQL 16 com Docker Compose, mas não executa os exemplos automaticamente. A criação das tabelas, a carga dos dados e as consultas fazem parte da prática.

Clone o repositório e inicie o banco:

```bash
git clone https://github.com/dirleiflsilva/sql-da-semana-postgresql.git
cd sql-da-semana-postgresql
cp .env.example .env
docker compose up -d
docker compose exec postgres psql -U postgres -d sql_da_semana
```

Dentro do `psql`, execute os arquivos do episódio na ordem:

```text
\i /sql-da-semana/05-cte/01-tabelas.sql
\i /sql-da-semana/05-cte/02-dados.sql
\i /sql-da-semana/05-cte/03-consultas.sql
```

Quem quiser entender a preparação do ambiente pode consultar o artigo [PostgreSQL Reliability Lab — Ambiente confiável com Docker](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/). Para uma instalação nativa, há também o guia de [configuração do PostgreSQL no Windows](/posts/configurando-postgresql-windows-protheus-desenvolvimento/).

## Conclusão

CTEs ajudam a escrever SQL como uma sequência de transformações nomeadas.

O principal benefício é tornar o raciocínio mais explícito. O impacto no desempenho, porém, deve ser observado no plano de execução em vez de deduzido apenas pela aparência da consulta.

## Referência

- [PostgreSQL: consultas WITH e Common Table Expressions](https://www.postgresql.org/docs/current/queries-with.html)
