---
title: "SQL da Semana #08 — generate_series(): criando dados e intervalos"
date: 2026-09-11
draft: false
toc: true
slug: "sql-da-semana-08-generate-series-postgresql"
description: "Use generate_series() no PostgreSQL para criar dados de teste, gerar calendários e incluir dias sem movimento nos resultados de consultas."
tags:
  - postgresql
  - sql
  - generate-series
  - dados-de-teste
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 8
---

Para testar uma consulta, muitas vezes precisamos de registros que ainda não existem. Para montar um relatório diário, precisamos mostrar inclusive as datas em que nenhum registro foi criado.

O PostgreSQL oferece uma função útil nos dois casos: `generate_series()`.

Ela produz um conjunto de linhas a partir de limites e de um passo. Esse conjunto pode alimentar um `INSERT`, compor um calendário ou participar de uma junção.

No [Lab 02 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/), usei essa função na carga inicial de categorias, clientes e produtos. Neste episódio, vamos partir desse uso e construir um relatório que também mostra dias sem pedidos.

## Começando por uma sequência de números

```sql
SELECT n
FROM generate_series(1, 5) AS serie(n)
ORDER BY n;
```

Resultado:

```text
 n
---
 1
 2
 3
 4
 5
```

O alias `serie(n)` dá nome à relação e à coluna produzida pela função. Colocá-la no `FROM` permite usar suas linhas nas demais partes da consulta.

Para números inteiros, o terceiro argumento é opcional e tem valor padrão `1`. Podemos alterá-lo:

```sql
SELECT n
FROM generate_series(2, 10, 3) AS serie(n)
ORDER BY n;
```

O resultado é `2`, `5` e `8`. O limite final é inclusivo quando alcançado pelo passo; a função não acrescenta `10` artificialmente.

Também podemos gerar uma sequência decrescente:

```sql
SELECT n
FROM generate_series(5, 1, -2) AS serie(n)
ORDER BY n DESC;
```

Nesse caso, o resultado é `5`, `3` e `1`.

Passo zero gera erro. Limites incompatíveis com a direção do passo produzem zero linhas, assim como argumentos nulos. Essas regras estão descritas na [documentação de funções que retornam conjuntos do PostgreSQL 16](https://www.postgresql.org/docs/16/functions-srf.html).

## Criando dados de teste com INSERT SELECT

Os exemplos a seguir usam tabelas temporárias e podem ser executados na mesma sessão SQL, sem depender do schema do laboratório.

```sql
CREATE TEMP TABLE clientes_exemplo (
    cliente_id integer PRIMARY KEY,
    nome       text NOT NULL,
    email      text NOT NULL UNIQUE
);

INSERT INTO clientes_exemplo (cliente_id, nome, email)
SELECT
    n,
    'Cliente ' || n,
    'cliente' || n || '@example.com'
FROM generate_series(1, 100) AS serie(n);

SELECT count(*) AS total_clientes
FROM clientes_exemplo;
```

O resultado esperado é `100`.

Cada número funciona como entrada para construir uma linha completa. O mesmo padrão pode gerar códigos, nomes e outros atributos sintéticos, sem escrever cem grupos de `VALUES`.

Essa carga é determinística: os mesmos limites e expressões produzem os mesmos valores. O exemplo pressupõe a tabela recém-criada; repetir o `INSERT` sobre ela preenchida causa conflito de chave primária.

## Como isso aparece no Lab 02

A procedure `seed.load_sample_data()` usa parâmetros para definir o tamanho de partes da carga. Este é o trecho de categorias:

```sql
INSERT INTO app.categories (name)
SELECT 'Category ' || gs
FROM generate_series(1, p_categories) AS gs
ON CONFLICT (name) DO NOTHING;
```

O trecho pertence à procedure: `p_categories` é um parâmetro dela, não uma variável disponível em qualquer sessão SQL.

Na inicialização do lab, a chamada é:

```sql
CALL seed.load_sample_data(100, 5, 50, 500);
```

Os argumentos representam clientes, categorias, produtos e pedidos. A função `generate_series()` participa da criação dos três primeiros conjuntos; os pedidos e suas relações são construídos por laços na procedure.

Nos clientes, o número gerado compõe nome, e-mail e documento. Nos produtos, compõe SKU e nome. Parte dos demais atributos utiliza `random()` e `now()`.

Essa diferença importa: a rotina permite reconstruir a carga segundo suas regras, mas preços e datas podem variar entre execuções. Para um teste que exige valores exatos, use expressões determinísticas ou preserve uma referência adequada à comparação.

O `ON CONFLICT` também tem um papel específico: evita inserir novamente categorias com o mesmo nome. Ele não faz parte de `generate_series()` nem transforma automaticamente toda a rotina em uma operação sem efeitos ao ser repetida.

O código usado como referência está em [05_seed_procedures.sql, no commit a3d1de9](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/a3d1de9c19d5584ddb287c22b767f82637577708/labs/02-database-initialization/init/05_seed_procedures.sql).

## Gerando um calendário de datas

Para trabalhar com dias, podemos somar uma sequência de inteiros a uma data inicial:

```sql
SELECT DATE '2026-09-07' + n AS dia
FROM generate_series(0, 6) AS serie(n)
ORDER BY dia;
```

O resultado contém sete datas, de `07/09/2026` a `13/09/2026`. Como o primeiro deslocamento é zero, a própria data inicial aparece na saída.

Essa abordagem é conveniente quando o domínio é uma data de calendário, sem hora ou fuso.

Para horários, existe uma forma que recebe timestamps e um intervalo:

```sql
SELECT instante
FROM generate_series(
    TIMESTAMP '2026-09-11 09:00:00',
    TIMESTAMP '2026-09-11 11:00:00',
    INTERVAL '30 minutes'
) AS serie(instante)
ORDER BY instante;
```

Ela produz cinco horários: `09:00`, `09:30`, `10:00`, `10:30` e `11:00`. Os tipos foram escritos explicitamente para deixar clara a versão da função utilizada.

Aqui usamos `timestamp` sem fuso. Se o problema envolve instantes globais e horários locais, a escolha de `timestamptz`, fuso e intervalo precisa acompanhar essa regra de negócio. As assinaturas disponíveis estão na [documentação de generate_series()](https://www.postgresql.org/docs/16/functions-srf.html).

## Mostrando dias sem pedidos

Considere um relatório com pedidos em apenas três dias da semana:

```sql
CREATE TEMP TABLE pedidos_exemplo (
    pedido_id integer PRIMARY KEY,
    dia       date NOT NULL,
    valor     numeric(12, 2) NOT NULL
);

INSERT INTO pedidos_exemplo (pedido_id, dia, valor)
VALUES
    (1, DATE '2026-09-07', 100.00),
    (2, DATE '2026-09-07',  50.00),
    (3, DATE '2026-09-09', 200.00),
    (4, DATE '2026-09-11',  80.00);
```

Uma agregação direta só encontra as datas existentes:

```sql
SELECT dia, count(*) AS quantidade, sum(valor) AS total
FROM pedidos_exemplo
GROUP BY dia
ORDER BY dia;
```

Para mostrar os sete dias, vamos construir primeiro o calendário e usá-lo como lado esquerdo da junção:

```sql
WITH calendario AS (
    SELECT DATE '2026-09-07' + n AS dia
    FROM generate_series(0, 6) AS serie(n)
)
SELECT
    c.dia,
    count(p.pedido_id) AS quantidade,
    coalesce(sum(p.valor), 0.00::numeric) AS total
FROM calendario AS c
LEFT JOIN pedidos_exemplo AS p
    ON p.dia = c.dia
GROUP BY c.dia
ORDER BY c.dia;
```

Resultado esperado:

| Dia | Quantidade | Total |
|---|---:|---:|
| 2026-09-07 | 2 | 150.00 |
| 2026-09-08 | 0 | 0.00 |
| 2026-09-09 | 1 | 200.00 |
| 2026-09-10 | 0 | 0.00 |
| 2026-09-11 | 1 | 80.00 |
| 2026-09-12 | 0 | 0.00 |
| 2026-09-13 | 0 | 0.00 |

O calendário define quais datas devem aparecer. O `LEFT JOIN` preserva essas datas mesmo quando não encontra pedidos.

Usamos `count(p.pedido_id)` porque a coluna fica nula nos dias sem correspondência. Um `count(*)` contaria a linha preservada pela junção e mostraria `1` nesses dias. Já `coalesce()` transforma a soma nula em zero.

Se acrescentar filtros sobre pedidos, avalie colocá-los no `ON` ou em uma agregação anterior à junção. Um filtro como `WHERE p.valor > 0` eliminaria as linhas sem correspondência e retiraria os dias vazios do resultado.

A [CTE](/posts/sql-da-semana-05-cte-postgresql/) deixa a construção do calendário separada da agregação, facilitando a leitura.

## O volume gerado também faz parte da consulta

A função permite criar muitas linhas com pouco código. Antes de aumentar os limites, estime o tamanho do conjunto e das junções que virão depois.

Um calendário de 365 dias cruzado com 10 mil clientes produz 3,65 milhões de combinações antes de qualquer filtro. Isso pode ser intencional, mas precisa fazer parte do desenho da consulta.

Para cargas de estudo, comece com um conjunto pequeno, confira contagens e valores e só então aumente o volume. Para relatórios, gere apenas o intervalo necessário.

## Quando usar

`generate_series()` é útil para criar massas sintéticas, construir calendários e produzir intervalos que servirão de base para outras consultas.

No laboratório, ela reduz o trabalho de montar dados iniciais. No relatório, permite representar datas que ainda não existem na tabela de fatos. Em ambos os casos, os limites e o passo definem o conjunto que será entregue à próxima operação SQL.

Como exercício, amplie o calendário do exemplo para todo o mês de setembro: use `DATE '2026-09-01'` como data inicial e gere deslocamentos de `0` a `29`. Mantenha os dias sem pedidos. O resultado deve conter 30 linhas, quatro pedidos no total e uma soma de `430.00`.
