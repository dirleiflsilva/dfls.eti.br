---
title: "SQL da Semana #03 — DISTINCT ON: obtendo o registro mais recente por grupo"
date: 2026-07-30
lastmod: 2026-08-20
draft: false
toc: true
slug: "sql-da-semana-03-distinct-on-postgresql"
description: "Aprenda a usar DISTINCT ON no PostgreSQL para obter o registro mais recente de cada grupo com ordenação determinística."
tags:
  - postgresql
  - sql
  - distinct-on
  - data-platform
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 3
---

Em plataformas de dados, é comum armazenarmos o histórico de execuções de cada pipeline.

Uma mesma rotina pode ter sido executada dezenas ou centenas de vezes, mas algumas consultas precisam mostrar apenas seu estado mais recente.

No PostgreSQL, podemos resolver esse problema de forma concisa com `DISTINCT ON`.

## O problema

Considere uma tabela que registra as execuções de pipelines:

```sql
CREATE TABLE execucoes_pipeline (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pipeline      text NOT NULL,
    status        text NOT NULL,
    iniciado_em   timestamptz NOT NULL,
    finalizado_em timestamptz
);
```

Cada linha representa uma execução:

```sql
INSERT INTO execucoes_pipeline (
    pipeline,
    status,
    iniciado_em,
    finalizado_em
)
VALUES
    (
        'carga_clientes',
        'sucesso',
        '2026-07-28 02:00:00-03',
        '2026-07-28 02:08:00-03'
    ),
    (
        'financeiro_diario',
        'falhou',
        '2026-07-28 03:00:00-03',
        '2026-07-28 03:02:00-03'
    ),
    (
        'carga_clientes',
        'falhou',
        '2026-07-29 02:00:00-03',
        '2026-07-29 02:03:00-03'
    ),
    (
        'financeiro_diario',
        'sucesso',
        '2026-07-29 03:00:00-03',
        '2026-07-29 03:11:00-03'
    ),
    (
        'carga_clientes',
        'sucesso',
        '2026-07-29 02:00:00-03',
        '2026-07-29 02:09:00-03'
    ),
    (
        'estoque',
        'executando',
        '2026-07-29 04:00:00-03',
        NULL
    );
```

Queremos retornar uma linha para cada pipeline, preservando informações como:

- identificador da execução;
- status;
- horário de início;
- horário de término.

## Por que apenas GROUP BY não resolve?

Podemos descobrir o maior horário de cada pipeline com `MAX`:

```sql
SELECT
    pipeline,
    MAX(iniciado_em) AS ultima_execucao
FROM execucoes_pipeline
GROUP BY pipeline;
```

O resultado informa o horário mais recente, mas não retorna naturalmente as demais colunas da mesma linha, como `id`, `status` e `finalizado_em`.

Uma alternativa seria juntar esse resultado novamente à tabela. Entretanto, se duas execuções tiverem o mesmo horário, a junção poderá retornar mais de uma linha para o pipeline.

Precisamos definir não apenas o maior horário, mas qual linha deve vencer quando houver empate.

## A solução com DISTINCT ON

Com `DISTINCT ON`, a consulta fica assim:

```sql
SELECT DISTINCT ON (pipeline)
    id,
    pipeline,
    status,
    iniciado_em,
    finalizado_em
FROM execucoes_pipeline
ORDER BY
    pipeline,
    iniciado_em DESC,
    id DESC;
```

Resultado:

```text
 id | pipeline           | status     | iniciado_em
----+--------------------+------------+------------------------
  5 | carga_clientes     | sucesso    | 2026-07-29 02:00:00-03
  6 | estoque            | executando | 2026-07-29 04:00:00-03
  4 | financeiro_diario  | sucesso    | 2026-07-29 03:00:00-03
```

A consulta funciona em duas partes:

1. o `ORDER BY` organiza as execuções de cada pipeline da mais recente para a mais antiga;
2. o `DISTINCT ON (pipeline)` mantém somente a primeira linha encontrada para cada pipeline.

No caso de `carga_clientes`, existem duas execuções com o mesmo valor em `iniciado_em`. O critério adicional `id DESC` faz a execução de maior identificador vencer o empate.

## A ordenação define qual linha será mantida

A estrutura geral é:

```sql
SELECT DISTINCT ON (coluna_do_grupo)
    colunas
FROM tabela
ORDER BY
    coluna_do_grupo,
    criterio_de_prioridade DESC,
    criterio_de_desempate DESC;
```

As expressões informadas em `DISTINCT ON` precisam corresponder às expressões mais à esquerda do `ORDER BY`.

Portanto, esta consulta é válida:

```sql
SELECT DISTINCT ON (pipeline)
    *
FROM execucoes_pipeline
ORDER BY pipeline, iniciado_em DESC;
```

Mas a forma abaixo não é válida, porque a ordenação começa por outra coluna:

```sql
SELECT DISTINCT ON (pipeline)
    *
FROM execucoes_pipeline
ORDER BY iniciado_em DESC, pipeline;
```

Sem uma ordenação capaz de estabelecer a prioridade dentro de cada grupo, o PostgreSQL poderá manter qualquer linha do grupo. Por isso, `ORDER BY` não deve ser tratado como um detalhe opcional nesse tipo de consulta.

## Por que usar um critério de desempate?

Ordenar somente pelo horário pode parecer suficiente:

```sql
ORDER BY pipeline, iniciado_em DESC
```

Entretanto, timestamps repetidos podem existir por diferentes motivos:

- execuções iniciadas no mesmo instante;
- precisão limitada da origem dos dados;
- importações em lote;
- dados históricos;
- valores definidos manualmente.

Quando duas linhas possuem o mesmo valor no critério principal, acrescentar uma coluna única torna o resultado determinístico:

```sql
ORDER BY
    pipeline,
    iniciado_em DESC,
    id DESC
```

Assim, a mesma consulta aplicada aos mesmos dados continuará escolhendo a mesma linha.

## Cuidado com valores NULL

Neste exemplo, `iniciado_em` foi definido como `NOT NULL`.

Se a coluna usada para identificar o registro mais recente aceitar `NULL`, precisamos decidir explicitamente como esses valores serão tratados. Em uma ordenação descendente, o PostgreSQL posiciona valores nulos primeiro por padrão.

Para evitar que uma linha sem data seja escolhida como a mais recente, podemos usar:

```sql
ORDER BY
    pipeline,
    iniciado_em DESC NULLS LAST,
    id DESC
```

Outra possibilidade é impedir valores nulos na modelagem quando uma execução não puder existir sem horário de início.

## Filtrar antes ou depois muda o significado

Considere a necessidade de encontrar a execução bem-sucedida mais recente de cada pipeline:

```sql
SELECT DISTINCT ON (pipeline)
    id,
    pipeline,
    status,
    iniciado_em,
    finalizado_em
FROM execucoes_pipeline
WHERE status = 'sucesso'
ORDER BY
    pipeline,
    iniciado_em DESC,
    id DESC;
```

O `WHERE` remove as execuções com outros estados antes que `DISTINCT ON` escolha uma linha.

Essa pergunta é diferente de encontrar os pipelines cuja execução mais recente terminou com sucesso. No segundo caso, não devemos remover previamente as falhas ou execuções ainda em andamento:

```sql
SELECT
    id,
    pipeline,
    status,
    iniciado_em,
    finalizado_em
FROM (
    SELECT DISTINCT ON (pipeline)
        id,
        pipeline,
        status,
        iniciado_em,
        finalizado_em
    FROM execucoes_pipeline
    ORDER BY
        pipeline,
        iniciado_em DESC,
        id DESC
) AS ultimas_execucoes
WHERE status = 'sucesso'
ORDER BY pipeline;
```

Nesse caso, a consulta interna escolhe primeiro a execução mais recente de cada pipeline. Somente depois a consulta externa mantém aquelas cujo status é `sucesso`.

A posição do filtro precisa representar corretamente a regra que queremos responder.

## Ordenando o resultado final

Como a ordenação precisa começar pelas expressões de `DISTINCT ON`, o resultado anterior fica organizado pelo nome do pipeline.

Se quisermos apresentar as execuções mais recentes primeiro, podemos ordenar novamente em uma consulta externa:

```sql
SELECT
    id,
    pipeline,
    status,
    iniciado_em,
    finalizado_em
FROM (
    SELECT DISTINCT ON (pipeline)
        id,
        pipeline,
        status,
        iniciado_em,
        finalizado_em
    FROM execucoes_pipeline
    ORDER BY
        pipeline,
        iniciado_em DESC,
        id DESC
) AS ultimas_execucoes
ORDER BY iniciado_em DESC, id DESC;
```

A consulta interna escolhe uma execução por pipeline. A externa define apenas a ordem de apresentação dessas linhas.

## Um índice pode ajudar

Quando a tabela cresce e a consulta é executada com frequência, um índice B-tree compatível com a ordenação pode ser útil:

```sql
CREATE INDEX idx_execucoes_pipeline_ultima
ON execucoes_pipeline (
    pipeline,
    iniciado_em DESC,
    id DESC
);
```

A ordem das colunas acompanha o `ORDER BY`:

```sql
ORDER BY
    pipeline,
    iniciado_em DESC,
    id DESC
```

Isso pode permitir que o PostgreSQL leia os dados na ordem necessária sem executar uma etapa separada de ordenação.

O índice não será obrigatoriamente escolhido em todos os cenários. O planejador considera fatores como:

- tamanho da tabela;
- quantidade de pipelines;
- distribuição dos dados;
- filtros adicionais;
- proporção de linhas consultadas;
- custo de leitura da tabela e do índice.

Além disso, todo índice ocupa espaço e adiciona trabalho às operações de escrita. Antes de criá-lo em produção, valide a consulta com `EXPLAIN (ANALYZE, BUFFERS)` e considere a carga real do sistema.

## Alternativa com ROW_NUMBER

Também podemos resolver o problema com a função de janela `ROW_NUMBER()`:

```sql
WITH execucoes_classificadas AS (
    SELECT
        id,
        pipeline,
        status,
        iniciado_em,
        finalizado_em,

        ROW_NUMBER() OVER (
            PARTITION BY pipeline
            ORDER BY iniciado_em DESC, id DESC
        ) AS posicao
    FROM execucoes_pipeline
)
SELECT
    id,
    pipeline,
    status,
    iniciado_em,
    finalizado_em
FROM execucoes_classificadas
WHERE posicao = 1
ORDER BY pipeline;
```

As duas abordagens são válidas, mas possuem características diferentes.

### DISTINCT ON

- costuma ser mais conciso para selecionar uma linha por grupo;
- expressa diretamente o padrão “primeira linha de cada grupo”;
- é uma extensão específica do PostgreSQL.

### ROW_NUMBER

- torna explícita a classificação das linhas dentro de cada grupo;
- adapta-se facilmente para retornar as duas ou três execuções mais recentes;
- utiliza funções de janela disponíveis em diferentes bancos de dados.

Se a aplicação é específica para PostgreSQL e precisa apenas da primeira linha de cada grupo, `DISTINCT ON` pode deixar a consulta mais direta. Quando portabilidade ou seleção dos primeiros N registros for importante, `ROW_NUMBER()` pode ser mais adequado.

## Erros comuns

Ao usar `DISTINCT ON`, alguns problemas aparecem com frequência:

- confundir `DISTINCT ON (pipeline)` com `DISTINCT`, que considera a combinação completa das colunas selecionadas;
- omitir o `ORDER BY` e receber uma linha imprevisível de cada grupo;
- iniciar o `ORDER BY` com uma expressão diferente daquela usada em `DISTINCT ON`;
- esquecer um critério de desempate;
- deixar valores `NULL` vencerem uma ordenação descendente;
- aplicar um filtro antes da escolha quando a regra deveria avaliar o registro mais recente, independentemente de seu estado.

## Quando utilizar

`DISTINCT ON` é especialmente útil para encontrar:

- a execução mais recente de cada pipeline;
- o último status de cada job;
- a medição mais recente de cada dispositivo;
- o pedido mais recente de cada cliente;
- a última versão de cada documento;
- o evento mais recente de cada serviço.

O recurso funciona melhor quando existe uma definição clara de grupo, prioridade e desempate.

## Pratique no laboratório

O [laboratório do episódio 03](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/03-distinct-on) possui várias execuções por pipeline e empates de horário preparados para demonstrar a importância do desempate determinístico.

Depois de preparar o PostgreSQL conforme o [README do repositório](https://github.com/dirleiflsilva/sql-da-semana-postgresql), execute no `psql`:

```text
\i /sql-da-semana/03-distinct-on/01-tabelas.sql
\i /sql-da-semana/03-distinct-on/02-dados.sql
\i /sql-da-semana/03-distinct-on/03-consultas.sql
```

O exercício compara `DISTINCT ON` com `row_number()`. As duas consultas selecionam as mesmas execuções mais recentes de `backup`, `carga-clientes` e `relatorio`.

## Conclusão

`DISTINCT ON` resolve de forma concisa um problema recorrente: selecionar a linha mais relevante de cada grupo sem perder as demais colunas do registro.

Para obter resultados corretos e previsíveis, três elementos precisam estar alinhados:

```sql
SELECT DISTINCT ON (grupo)
    colunas
FROM tabela
ORDER BY
    grupo,
    prioridade DESC,
    desempate DESC;
```

O grupo define quais linhas competem entre si, a prioridade escolhe a linha desejada e o desempate torna a decisão determinística.

## Veja também

- [SQL da Semana #01 — RETURNING: obtendo dados sem fazer uma nova consulta](/posts/sql-da-semana-01-returning-postgresql/)
- [SQL da Semana #02 — FILTER: agregações condicionais mais claras](/posts/sql-da-semana-02-filter-postgresql/)

## Referências

- [PostgreSQL — SELECT e DISTINCT ON](https://www.postgresql.org/docs/current/sql-select.html#SQL-DISTINCT)
- [PostgreSQL — Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [PostgreSQL — Indexes and ORDER BY](https://www.postgresql.org/docs/current/indexes-ordering.html)
- [PostgreSQL — Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
