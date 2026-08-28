---
title: "SQL da Semana #06 — Window Functions: rankings e acumulados"
date: 2026-08-28
draft: false
toc: true
affiliate: true
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
    valor       numeric(12, 2) NOT NULL CHECK (valor > 0)
);
```

Queremos exibir cada venda com:

- sua posição entre as vendas do mesmo vendedor;
- o acumulado daquele vendedor ao longo do tempo;
- o percentual da venda em relação ao total do vendedor.

## Dados para reproduzir o cenário

O [laboratório do episódio 06](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/06-window-functions) contém dez vendas: cinco do vendedor 101 e cinco do vendedor 202.

Cada vendedor possui exatamente R$ 1.000,00 em vendas. A massa de dados também inclui valores repetidos, vendas realizadas no mesmo instante e uma ordem cronológica diferente da ordem por valor. Essas características permitem observar empates, desempates e acumulados de forma determinística.

Os arquivos do laboratório separam a criação da tabela, a carga dos dados e as consultas. Assim, cada etapa pode ser executada e conferida manualmente.

## Agregação comum perde as linhas individuais

Com `GROUP BY`, obtemos o total:

```sql
SELECT
    vendedor_id,
    count(*) AS quantidade_vendas,
    sum(valor) AS valor_total
FROM vendas
GROUP BY vendedor_id
ORDER BY vendedor_id;
```

O resultado tem uma linha por vendedor. As vendas individuais deixam de aparecer.

| Vendedor | Quantidade de vendas | Valor total |
|---:|---:|---:|
| 101 | 5 | R$ 1.000,00 |
| 202 | 5 | R$ 1.000,00 |

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
    venda_id,
    vendedor_id,
    valor,
    row_number() OVER (
        PARTITION BY vendedor_id
        ORDER BY valor DESC, venda_id
    ) AS row_number,
    rank() OVER (
        PARTITION BY vendedor_id
        ORDER BY valor DESC
    ) AS rank,
    dense_rank() OVER (
        PARTITION BY vendedor_id
        ORDER BY valor DESC
    ) AS dense_rank
FROM vendas
ORDER BY vendedor_id, valor DESC, venda_id;
```

Para o vendedor 101, os valores em ordem decrescente são R$ 300,00, três vendas de R$ 200,00 e R$ 100,00:

| venda_id | valor | row_number | rank | dense_rank |
|---:|---:|---:|---:|---:|
| 2 | 300,00 | 1 | 1 | 1 |
| 3 | 200,00 | 2 | 2 | 2 |
| 4 | 200,00 | 3 | 2 | 2 |
| 5 | 200,00 | 4 | 2 | 2 |
| 1 | 100,00 | 5 | 5 | 3 |

- `row_number()` gera números diferentes e usa `venda_id` para desempatar;
- `rank()` preserva o empate e deixa uma lacuna;
- `dense_rank()` preserva o empate sem deixar lacuna.

A função correta depende do significado do ranking. No vendedor 202, por exemplo, três vendas de R$ 250,00 empatam na primeira posição: a venda seguinte recebe `rank` 4 e `dense_rank` 2.

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

No laboratório, as vendas 3 e 4 foram realizadas no mesmo instante. O desempate por `venda_id` define qual delas entra primeiro no acumulado:

| Vendedor | Ordem das vendas | Evolução do acumulado |
|---:|---|---|
| 101 | 1, 2, 3, 4, 5 | 100, 400, 600, 800, 1.000 |
| 202 | 6, 7, 8, 9, 10 | 250, 350, 600, 750, 1.000 |

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
FROM vendas
ORDER BY vendedor_id, venda_id;
```

Cada linha continua no resultado, mas agora conhece o total do grupo. Como cada vendedor soma R$ 1.000,00, uma venda de R$ 100,00 representa 10%, uma de R$ 150,00 representa 15% e uma de R$ 300,00 representa 30%.

A restrição `CHECK (valor > 0)` garante valores positivos. Como cada partição possui pelo menos uma venda, o total usado como divisor não pode ser zero nesse cenário.

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
    ) AS ranking_por_valor,
    sum(valor) OVER (
        PARTITION BY vendedor_id
        ORDER BY realizada_em, venda_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS valor_acumulado,
    round(
        valor / sum(valor) OVER (PARTITION BY vendedor_id) * 100,
        2
    ) AS percentual_do_vendedor
FROM vendas
ORDER BY vendedor_id, realizada_em, venda_id;
```

O resultado do vendedor 101 evidencia que cada janela pode seguir uma ordem diferente:

| venda_id | valor | ranking por valor | valor acumulado | percentual |
|---:|---:|---:|---:|---:|
| 1 | 100,00 | 3 | 100,00 | 10,00% |
| 2 | 300,00 | 1 | 400,00 | 30,00% |
| 3 | 200,00 | 2 | 600,00 | 20,00% |
| 4 | 200,00 | 2 | 800,00 | 20,00% |
| 5 | 200,00 | 2 | 1.000,00 | 20,00% |

A venda 1 aparece primeiro por ser a mais antiga, mas ocupa a terceira posição no ranking por valor. A venda 2 ocupa a primeira posição do ranking, embora seja a segunda na sequência cronológica.

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

## Pratique no laboratório

O repositório [SQL da Semana — laboratórios PostgreSQL](https://github.com/dirleiflsilva/sql-da-semana-postgresql) fornece um PostgreSQL 16 com Docker Compose. Os arquivos SQL não são executados automaticamente: criar a tabela, carregar os dados e rodar as consultas faz parte da prática.

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
\i /sql-da-semana/06-window-functions/01-tabelas.sql
\i /sql-da-semana/06-window-functions/02-dados.sql
\i /sql-da-semana/06-window-functions/03-consultas.sql
```

O primeiro arquivo recria somente o schema `sql_semana_06`. Por isso, a sequência completa pode ser executada novamente sem duplicar dados.

Quem quiser entender a preparação do ambiente pode consultar o artigo [PostgreSQL Reliability Lab — Ambiente confiável com Docker](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/). Para uma instalação nativa, há também o guia de [configuração do PostgreSQL no Windows](/posts/configurando-postgresql-windows-protheus-desenvolvimento/).

## Conclusão

Funções de janela permitem analisar uma linha no contexto do seu grupo sem remover os detalhes do resultado.

`PARTITION BY` define os grupos, o `ORDER BY` da janela controla a sequência do cálculo e a moldura delimita quais linhas participam dele. O `ORDER BY` final possui outra responsabilidade: organizar a apresentação.

Com essa separação, a mesma consulta pode combinar ranking por valor, acumulado cronológico e percentual sobre o total de cada vendedor.

## Para aprofundar

Estes dois livros ajudam a avançar dos fundamentos da linguagem para consultas analíticas e aplicações práticas de SQL.

{{< book
    title="SQL Guia Prático"
    authors="Alice Zhao"
    description="Uma referência de consulta para o uso cotidiano de SQL, com exemplos aplicáveis a PostgreSQL e a outros bancos de dados relacionais."
    url="https://link.amazon/B03EXY4dn"
>}}

{{< book
    title="SQL para Análise de Dados"
    authors="Cathy Tanimura"
    description="Aprofunda o uso de SQL em preparação de dados, séries temporais, análise de coortes, detecção de anomalias e experimentos."
    url="https://link.amazon/B0295GlWz"
>}}

## Referências

- [PostgreSQL: tutorial de Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [PostgreSQL: funções de janela](https://www.postgresql.org/docs/current/functions-window.html)
