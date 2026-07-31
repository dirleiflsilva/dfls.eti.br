---
title: "SQL da Semana #06 — Window Functions: rankings e acumulados"
date: 2026-08-20
draft: true
toc: true
slug: "sql-da-semana-06-window-functions-postgresql"
description: "Aprenda a usar Window Functions no PostgreSQL para criar rankings e totais acumulados sem perder as linhas individuais do resultado."
tags:
  - postgresql
  - sql
  - window-functions
  - ranking
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 6
---

Agregações tradicionais reduzem várias linhas a um resultado por grupo.

Isso é exatamente o que queremos ao calcular o total de vendas por vendedor. Mas e se precisarmos manter cada venda e, ao mesmo tempo, mostrar sua posição no ranking e o valor acumulado?

Para esse tipo de problema, o SQL oferece **funções de janela**.

## O problema

Considere uma tabela de vendas:

```sql
CREATE TABLE vendas (
    venda_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendedor_id bigint NOT NULL,
    realizada_em timestamptz NOT NULL,
    valor       numeric(12, 2) NOT NULL
);
```

Queremos exibir cada venda com:

- sua posição entre as vendas do mesmo vendedor;
- o acumulado daquele vendedor ao longo do tempo;
- o percentual da venda em relação ao total do vendedor.

## Agregação comum perde as linhas individuais

Com `GROUP BY`, obtemos o total:

```sql
SELECT
    vendedor_id,
    sum(valor) AS total
FROM vendas
GROUP BY vendedor_id;
```

O resultado tem uma linha por vendedor. As vendas individuais deixam de aparecer.

Uma Window Function calcula valores sobre um conjunto relacionado sem condensar essas linhas.

## Criando um ranking

`row_number()` atribui um número sequencial dentro de cada partição:

```sql
SELECT
    venda_id,
    vendedor_id,
    realizada_em,
    valor,
    row_number() OVER (
        PARTITION BY vendedor_id
        ORDER BY valor DESC, venda_id
    ) AS posicao
FROM vendas
ORDER BY vendedor_id, posicao;
```

A cláusula `OVER` define a janela:

- `PARTITION BY vendedor_id` reinicia a numeração para cada vendedor;
- `ORDER BY valor DESC, venda_id` define a ordem dentro de cada grupo;
- `venda_id` funciona como desempate determinístico.

## ROW_NUMBER, RANK ou DENSE_RANK?

As três funções tratam empates de maneiras diferentes.

```sql
SELECT
    vendedor_id,
    valor,
    row_number() OVER (ORDER BY valor DESC) AS row_number,
    rank()       OVER (ORDER BY valor DESC) AS rank,
    dense_rank() OVER (ORDER BY valor DESC) AS dense_rank
FROM vendas;
```

Se os valores forem `500`, `500` e `400`:

| valor | row_number | rank | dense_rank |
|---:|---:|---:|---:|
| 500 | 1 | 1 | 1 |
| 500 | 2 | 1 | 1 |
| 400 | 3 | 3 | 2 |

- `row_number()` sempre gera números diferentes;
- `rank()` preserva o empate e deixa uma lacuna;
- `dense_rank()` preserva o empate sem deixar lacuna.

A função correta depende do significado do ranking.

## Calculando um acumulado

Uma agregação também pode ser usada como função de janela:

```sql
SELECT
    venda_id,
    vendedor_id,
    realizada_em,
    valor,
    sum(valor) OVER (
        PARTITION BY vendedor_id
        ORDER BY realizada_em, venda_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS valor_acumulado
FROM vendas
ORDER BY vendedor_id, realizada_em, venda_id;
```

A moldura:

```sql
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

significa: comece na primeira linha da partição e termine na linha atual.

Declarar a moldura explicitamente torna a intenção mais clara e evita surpresas com linhas que possuem o mesmo valor de ordenação.

## Calculando o percentual do total

Quando `OVER` não possui `ORDER BY`, a agregação considera toda a partição:

```sql
SELECT
    venda_id,
    vendedor_id,
    valor,
    round(
        valor / sum(valor) OVER (PARTITION BY vendedor_id) * 100,
        2
    ) AS percentual_do_vendedor
FROM vendas;
```

Cada linha continua no resultado, mas agora conhece o total do grupo.

## Combinando os cálculos

Podemos reunir ranking, acumulado e percentual:

```sql
SELECT
    venda_id,
    vendedor_id,
    realizada_em,
    valor,
    dense_rank() OVER (
        PARTITION BY vendedor_id
        ORDER BY valor DESC
    ) AS ranking_valor,
    sum(valor) OVER (
        PARTITION BY vendedor_id
        ORDER BY realizada_em, venda_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS valor_acumulado,
    round(
        valor / sum(valor) OVER (PARTITION BY vendedor_id) * 100,
        2
    ) AS percentual_do_total
FROM vendas
ORDER BY vendedor_id, realizada_em, venda_id;
```

## A ordem da janela não ordena a saída

O `ORDER BY` dentro de `OVER` controla o cálculo da função. Ele não substitui o `ORDER BY` final da consulta.

Se a apresentação precisa de uma ordem específica, declare-a no final do `SELECT`.

## Quando usar

Window Functions aparecem com frequência em:

- rankings;
- totais acumulados;
- médias móveis;
- comparação com a linha anterior usando `lag()`;
- comparação com a próxima linha usando `lead()`;
- percentuais sobre totais;
- identificação do primeiro ou último registro de um grupo.

Elas complementam `GROUP BY`: a diferença fundamental é preservar as linhas individuais.

## Referências

- [PostgreSQL: tutorial de Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [PostgreSQL: funções de janela](https://www.postgresql.org/docs/current/functions-window.html)

