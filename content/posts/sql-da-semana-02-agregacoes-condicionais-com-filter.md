---
title: "SQL da Semana #02 — FILTER: agregações condicionais mais claras"
date: 2026-07-23
draft: false
toc: true
slug: "sql-da-semana-02-filter-postgresql"
description: "Aprenda a usar a cláusula FILTER do PostgreSQL para criar agregações condicionais mais legíveis e evitar expressões CASE repetitivas."
tags:
  - postgresql
  - sql
  - filter
  - agregações
  - sql-da-semana
categories:
  - SQL da Semana
---

Em relatórios SQL, é comum precisarmos calcular diferentes totais a partir do mesmo conjunto de dados.

Imagine uma tabela de pedidos com a seguinte estrutura:

```sql
CREATE TABLE pedidos (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id  bigint NOT NULL,
    status      text NOT NULL,
    valor       numeric(12, 2) NOT NULL,
    criado_em   timestamp NOT NULL DEFAULT current_timestamp
);
```

Queremos apresentar, em uma única consulta:

- quantidade total de pedidos;
- pedidos pagos;
- pedidos pendentes;
- pedidos cancelados;
- valor total dos pedidos pagos.

## A solução tradicional com CASE

Uma forma comum de resolver o problema é colocar expressões `CASE` dentro das funções de agregação:

```sql
SELECT
    COUNT(*) AS total_pedidos,

    SUM(
        CASE
            WHEN status = 'pago' THEN 1
            ELSE 0
        END
    ) AS pedidos_pagos,

    SUM(
        CASE
            WHEN status = 'pendente' THEN 1
            ELSE 0
        END
    ) AS pedidos_pendentes,

    SUM(
        CASE
            WHEN status = 'cancelado' THEN 1
            ELSE 0
        END
    ) AS pedidos_cancelados,

    SUM(
        CASE
            WHEN status = 'pago' THEN valor
            ELSE 0
        END
    ) AS valor_pago
FROM pedidos;
```

A consulta funciona, mas se torna repetitiva à medida que novos indicadores são adicionados.

## Utilizando FILTER

No PostgreSQL, podemos aplicar uma condição diretamente sobre cada agregação com a cláusula `FILTER`:

```sql
SELECT
    COUNT(*) AS total_pedidos,

    COUNT(*) FILTER (
        WHERE status = 'pago'
    ) AS pedidos_pagos,

    COUNT(*) FILTER (
        WHERE status = 'pendente'
    ) AS pedidos_pendentes,

    COUNT(*) FILTER (
        WHERE status = 'cancelado'
    ) AS pedidos_cancelados,

    COALESCE(
        SUM(valor) FILTER (
            WHERE status = 'pago'
        ),
        0
    ) AS valor_pago
FROM pedidos;
```

A intenção de cada coluna fica mais clara: executar determinada agregação apenas sobre as linhas que atendem à condição.

## Sintaxe geral

A estrutura básica é:

```sql
funcao_agregadora(expressao)
FILTER (WHERE condicao)
```

A cláusula pode ser usada com funções como:

- `COUNT`;
- `SUM`;
- `AVG`;
- `MIN`;
- `MAX`;
- `ARRAY_AGG`;
- `STRING_AGG`;
- agregações definidas pelo usuário.

## Exemplo agrupado por cliente

Também podemos combinar `FILTER` com `GROUP BY`:

```sql
SELECT
    cliente_id,

    COUNT(*) AS total_pedidos,

    COUNT(*) FILTER (
        WHERE status = 'pago'
    ) AS pedidos_pagos,

    COUNT(*) FILTER (
        WHERE status = 'pendente'
    ) AS pedidos_pendentes,

    COALESCE(
        SUM(valor) FILTER (
            WHERE status = 'pago'
        ),
        0
    ) AS valor_pago
FROM pedidos
GROUP BY cliente_id
ORDER BY cliente_id;
```

Nesse caso, cada cliente terá seus próprios indicadores.

O `COALESCE` foi utilizado porque `SUM` retorna `NULL` quando nenhuma linha atende ao filtro. Para relatórios, muitas vezes é mais conveniente apresentar zero.

## FILTER com intervalo de datas

As condições não precisam se limitar a uma única coluna.

Podemos calcular valores referentes a períodos diferentes:

```sql
SELECT
    COUNT(*) FILTER (
        WHERE criado_em >= current_date
    ) AS pedidos_hoje,

    COUNT(*) FILTER (
        WHERE criado_em >= current_timestamp - interval '7 days'
    ) AS pedidos_ultimos_7_dias,

    COUNT(*) FILTER (
        WHERE criado_em >= date_trunc('month', current_date)
    ) AS pedidos_no_mes
FROM pedidos;
```

Uma única consulta produz diferentes indicadores temporais sem repetir subconsultas.

## FILTER com window functions

A cláusula também pode ser utilizada em agregações executadas como funções de janela.

```sql
SELECT
    id,
    cliente_id,
    status,
    valor,

    COUNT(*) FILTER (
        WHERE status = 'pago'
    ) OVER (
        PARTITION BY cliente_id
    ) AS total_pagos_cliente
FROM pedidos;
```

A consulta mantém cada pedido no resultado, mas acrescenta a quantidade de pedidos pagos do respectivo cliente.

## Qual é o ganho?

O principal ganho é a legibilidade.

Compare:

```sql
SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END)
```

com:

```sql
SUM(valor) FILTER (WHERE status = 'pago')
```

Na segunda forma, a agregação e sua condição ficam explicitamente separadas.

Isso facilita:

- leitura;
- revisão;
- manutenção;
- inclusão de novos indicadores;
- redução de expressões repetitivas.

## Quando utilizar

`FILTER` é especialmente útil em:

- dashboards;
- relatórios gerenciais;
- indicadores de status;
- métricas por período;
- tabelas de resumo;
- consultas com várias agregações condicionais.

Ele não elimina todos os usos de `CASE`.

Quando a transformação precisa ocorrer dentro da própria expressão, ou quando cada condição deve retornar valores diferentes, `CASE` continua sendo adequado.

Mas, quando a necessidade é simplesmente restringir quais linhas participam de uma agregação, `FILTER` costuma expressar melhor a intenção.

## Conclusão

A cláusula `FILTER` é um recurso simples, mas capaz de deixar consultas analíticas muito mais claras.

Em vez de repetir expressões `CASE` dentro de várias agregações, podemos declarar diretamente a condição de cada indicador:

```sql
COUNT(*) FILTER (WHERE condicao)
```

Para relatórios com múltiplas métricas calculadas sobre o mesmo conjunto de dados, esse recurso pode reduzir bastante o ruído da consulta e melhorar sua manutenção.

## Referências

- [PostgreSQL — Aggregate Expressions](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES)
- [PostgreSQL — Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html)
- [PostgreSQL — Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
