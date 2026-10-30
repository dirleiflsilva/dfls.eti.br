---
title: "SQL da Semana #14 — Window Frames: saldos e movimentações acumuladas"
date: 2026-10-30
draft: false
toc: true
slug: "sql-da-semana-14-window-frames-saldos-movimentacoes-acumuladas"
description: "Entenda como ROWS, RANGE e GROUPS definem a moldura de uma função de janela no PostgreSQL e calcule saldos acumulados de forma determinística."
tags:
  - postgresql
  - sql
  - window-functions
  - window-frames
  - rows
  - range
  - saldos
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 14
---

Uma conta começa o dia com determinado saldo e recebe créditos e débitos ao longo do tempo. O relatório precisa preservar cada movimentação e mostrar o saldo resultante depois de cada uma.

Uma função de janela resolve a parte do acumulado sem remover as linhas individuais. Mas escrever apenas `sum() over (order by ...)` deixa uma decisão importante implícita: **quais linhas pertencem ao cálculo da linha atual?**

Essa parte da janela é chamada de *window frame*, ou moldura. No PostgreSQL, `ROWS`, `RANGE` e `GROUPS` podem produzir resultados diferentes, principalmente quando existem valores repetidos na ordenação.

Neste episódio, vamos calcular saldos sobre uma massa sintética, observar a surpresa causada pela moldura padrão e tornar a ordem e a moldura explícitas.

> O [laboratório reproduzível do episódio 14](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/14-window-frames) contém os scripts de criação, carga, consultas, exercício e validação automatizada apresentados neste artigo.

## Do episódio introdutório para as molduras

No [SQL da Semana #06](/posts/sql-da-semana-06-window-functions-postgresql/), usamos funções de janela para criar rankings, acumulados e percentuais. A consulta já declarou esta moldura:

```sql
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

Agora vamos aprofundar o significado dessa expressão e compará-la com outras formas de definir o conjunto de linhas visto por cada resultado.

Uma especificação de janela pode conter três decisões diferentes:

```sql
sum(valor) OVER (
    PARTITION BY conta_id
    ORDER BY ocorrido_em, movimento_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
```

- `PARTITION BY` define onde o cálculo reinicia;
- `ORDER BY` estabelece a sequência dentro da partição;
- a moldura define o trecho dessa sequência usado na linha atual.

Separar essas responsabilidades ajuda a revisar consultas cujo resultado depende da ordem dos eventos.

## O cenário

O exemplo representa um razão simplificado em uma base própria. Os dados são sintéticos e não existe leitura nem escrita em tabelas de ERP ou de uma instituição financeira.

```sql
CREATE SCHEMA sql_semana_14;

CREATE TABLE sql_semana_14.movimentacoes (
    movimento_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id     bigint NOT NULL,
    ocorrido_em  timestamptz NOT NULL,
    descricao    text NOT NULL,
    valor        numeric(12, 2) NOT NULL,
    CHECK (valor <> 0)
);

INSERT INTO sql_semana_14.movimentacoes
    (conta_id, ocorrido_em, descricao, valor)
VALUES
    (101, '2026-10-30 08:00:00-03', 'Saldo inicial',          1000.00),
    (101, '2026-10-30 09:15:00-03', 'Pagamento fornecedor',   -180.00),
    (101, '2026-10-30 10:00:00-03', 'Recebimento pedido 501',  250.00),
    (101, '2026-10-30 10:00:00-03', 'Tarifa da operação',      -10.00),
    (101, '2026-10-30 14:30:00-03', 'Pagamento frete',         -60.00),
    (202, '2026-10-30 08:00:00-03', 'Saldo inicial',           500.00),
    (202, '2026-10-30 11:00:00-03', 'Recebimento pedido 880',  120.00),
    (202, '2026-10-30 16:00:00-03', 'Pagamento fornecedor',   -200.00);
```

Créditos são positivos e débitos são negativos. Essa convenção deixa o saldo acumulado igual à soma dos movimentos até determinado ponto.

O saldo inicial foi incluído como uma movimentação para manter o exemplo autocontido. Em outro modelo, ele poderia vir de uma tabela de posições anteriores e ser combinado com os eventos do período. Essa escolha precisa estar explícita para evitar somar o mesmo saldo inicial mais de uma vez.

## Um acumulado por conta

A consulta mais direta usa `sum()` como função de janela:

```sql
SELECT
    movimento_id,
    conta_id,
    ocorrido_em,
    descricao,
    valor,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em, movimento_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS saldo
FROM sql_semana_14.movimentacoes
ORDER BY conta_id, ocorrido_em, movimento_id;
```

Para a conta 101, o resultado é:

| ID | Horário | Descrição | Valor | Saldo |
|---:|---|---|---:|---:|
| 1 | 08:00 | Saldo inicial | 1000.00 | 1000.00 |
| 2 | 09:15 | Pagamento fornecedor | -180.00 | 820.00 |
| 3 | 10:00 | Recebimento pedido 501 | 250.00 | 1070.00 |
| 4 | 10:00 | Tarifa da operação | -10.00 | 1060.00 |
| 5 | 14:30 | Pagamento frete | -60.00 | 1000.00 |

`PARTITION BY conta_id` impede que os movimentos da conta 202 sejam somados à conta 101. A ordem usa o instante e o identificador do movimento, produzindo uma sequência total mesmo quando dois eventos possuem o mesmo horário.

A moldura começa na primeira linha da conta e termina na linha atual. Por isso, cada resultado inclui todo o histórico anterior segundo essa ordem.

## O que acontece quando a moldura é omitida

Podemos reduzir a expressão para:

```sql
sum(valor) OVER (
    PARTITION BY conta_id
    ORDER BY ocorrido_em
)
```

Quando existe `ORDER BY` e a moldura não é declarada, o comportamento padrão corresponde a uma moldura baseada em `RANGE` que começa no início da partição e termina na linha atual, incluindo também suas linhas pares.

Linhas pares são aquelas que possuem o mesmo valor nas expressões do `ORDER BY`. Na conta 101, o recebimento e a tarifa ocorreram às 10:00. Para a janela ordenada apenas por `ocorrido_em`, elas pertencem ao mesmo grupo.

```sql
SELECT
    movimento_id,
    ocorrido_em,
    descricao,
    valor,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em
    ) AS saldo_com_moldura_padrao
FROM sql_semana_14.movimentacoes
WHERE conta_id = 101
ORDER BY ocorrido_em, movimento_id;
```

As duas linhas das 10:00 recebem `1060.00`. A moldura da linha do recebimento já inclui a tarifa, porque ambas são pares na ordenação:

| ID | Horário | Valor | Saldo com moldura padrão |
|---:|---|---:|---:|
| 1 | 08:00 | 1000.00 | 1000.00 |
| 2 | 09:15 | -180.00 | 820.00 |
| 3 | 10:00 | 250.00 | 1060.00 |
| 4 | 10:00 | -10.00 | 1060.00 |
| 5 | 14:30 | -60.00 | 1000.00 |

O resultado não está incorreto segundo a consulta. Ele apenas responde a outra pergunta: qual é o saldo depois de considerar o grupo inteiro daquele instante?

Se o relatório pretende mostrar a evolução evento a evento, precisa definir como ordenar eventos simultâneos e usar uma moldura compatível com essa sequência.

## ROWS conta linhas físicas da ordem lógica

`ROWS` delimita a moldura por posições individuais na sequência definida pela janela:

```sql
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

Os limites significam:

- `UNBOUNDED PRECEDING`: primeira linha da partição;
- `CURRENT ROW`: linha que está sendo calculada.

Ao ordenar por `ocorrido_em, movimento_id`, cada evento ocupa uma posição determinística. Os movimentos das 10:00 deixam de ser indistinguíveis para a janela: o movimento 3 vem antes do 4.

O identificador não deve ser usado como desempate apenas por conveniência se ele não representar a sequência correta do negócio. Sistemas que recebem eventos atrasados podem precisar de um número de sequência da origem, instante de efetivação ou outra chave que preserve a ordem relevante.

Sem um critério total, duas execuções podem apresentar pares em ordens diferentes. Uma moldura `ROWS` não cria por conta própria uma ordem que o `ORDER BY` deixou ambígua.

## RANGE trabalha com valores da ordenação

`RANGE` define limites a partir dos valores do `ORDER BY`, e não de uma quantidade fixa de linhas.

Isso é útil para intervalos temporais. A consulta abaixo calcula o valor líquido movimentado nas 24 horas que terminam no instante de cada evento:

```sql
SELECT
    movimento_id,
    conta_id,
    ocorrido_em,
    valor,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em
        RANGE BETWEEN INTERVAL '24 hours' PRECEDING AND CURRENT ROW
    ) AS movimentado_ultimas_24h
FROM sql_semana_14.movimentacoes
ORDER BY conta_id, ocorrido_em, movimento_id;
```

A quantidade de linhas na moldura pode variar. Entram todas as movimentações da mesma conta cujo `ocorrido_em` esteja dentro do intervalo, incluindo pares no limite atual.

Para usar um deslocamento como `INTERVAL '24 hours' PRECEDING`, a janela precisa ter uma única expressão no `ORDER BY`, e o tipo do deslocamento deve ser compatível com essa expressão. Não podemos adicionar `movimento_id` ao mesmo `ORDER BY` apenas para desempatar essa moldura temporal.

Essa característica reforça que `RANGE` responde a uma pergunta por domínio de valores — aqui, tempo — enquanto `ROWS` responde por posições na sequência.

## GROUPS conta grupos de pares

`GROUPS` avança por grupos que compartilham os mesmos valores do `ORDER BY`. Ele fica entre as duas ideias anteriores: não conta linhas individuais, mas também não exige um deslocamento no domínio do valor.

```sql
SELECT
    movimento_id,
    ocorrido_em,
    valor,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em
        GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW
    ) AS grupo_atual_e_anterior
FROM sql_semana_14.movimentacoes
WHERE conta_id = 101
ORDER BY ocorrido_em, movimento_id;
```

Para as linhas das 10:00, a moldura contém:

- o grupo atual, formado pelo recebimento de `250.00` e pela tarifa de `-10.00`;
- o grupo anterior, formado pelo pagamento de `-180.00` das 09:15.

O resultado para ambas é `60.00`. As duas linhas recebem o mesmo valor porque pertencem ao mesmo grupo de pares.

`GROUPS` é útil quando empates representam uma unidade lógica e a pergunta deve avançar por essas unidades. Ele não é necessário apenas porque existem valores repetidos; a semântica do relatório deve justificar o agrupamento dos pares.

## Uma janela móvel de três movimentações

Nem toda moldura começa na primeira linha. Para calcular o valor líquido das três movimentações mais recentes, incluindo a atual:

```sql
SELECT
    movimento_id,
    conta_id,
    ocorrido_em,
    valor,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em, movimento_id
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS liquido_ultimos_tres_movimentos
FROM sql_semana_14.movimentacoes
ORDER BY conta_id, ocorrido_em, movimento_id;
```

Na primeira linha da conta ainda não existem duas anteriores. A moldura é reduzida ao que está disponível, sem criar valores ausentes artificialmente.

Para a conta 101, as três últimas linhas produzem:

| ID atual | Valores na moldura | Líquido |
|---:|---|---:|
| 3 | 1000.00, -180.00, 250.00 | 1070.00 |
| 4 | -180.00, 250.00, -10.00 | 60.00 |
| 5 | 250.00, -10.00, -60.00 | 180.00 |

Esse cálculo não é o saldo da conta. A partir da quarta linha, ele descarta movimentos mais antigos. O nome da coluna precisa deixar claro que se trata do líquido de uma janela móvel.

## Molduras diferentes na mesma consulta

Uma mesma linha pode mostrar o saldo desde o início e o movimento líquido recente:

```sql
SELECT
    movimento_id,
    conta_id,
    ocorrido_em,
    descricao,
    valor,
    sum(valor) OVER saldo_desde_inicio AS saldo,
    sum(valor) OVER ultimos_tres AS liquido_ultimos_tres
FROM sql_semana_14.movimentacoes
WINDOW
    saldo_desde_inicio AS (
        PARTITION BY conta_id
        ORDER BY ocorrido_em, movimento_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ),
    ultimos_tres AS (
        PARTITION BY conta_id
        ORDER BY ocorrido_em, movimento_id
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    )
ORDER BY conta_id, ocorrido_em, movimento_id;
```

A cláusula `WINDOW` nomeia as duas especificações. Isso ajuda quando várias expressões reutilizam a mesma partição e ordem, embora as molduras continuem diferentes.

O PostgreSQL ainda precisa executar o trabalho indicado pelo plano. Nomear janelas melhora a leitura e reduz repetição textual; não é uma garantia de que qualquer combinação será calculada em uma única etapa.

## Saldo anterior sem subconsulta

Também podemos terminar a moldura na linha anterior:

```sql
SELECT
    movimento_id,
    conta_id,
    ocorrido_em,
    valor,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em, movimento_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS saldo_anterior,
    sum(valor) OVER (
        PARTITION BY conta_id
        ORDER BY ocorrido_em, movimento_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS saldo_atual
FROM sql_semana_14.movimentacoes
ORDER BY conta_id, ocorrido_em, movimento_id;
```

Na primeira movimentação, `saldo_anterior` é `NULL`, pois a moldura está vazia. Se o relatório preferir exibir zero antes do primeiro lançamento, essa apresentação pode ser feita com `coalesce(..., 0)`, desde que zero represente corretamente o estado inicial naquele modelo.

Outra possibilidade seria calcular o saldo atual e usar `lag()` para consultar seu valor na linha anterior. Delimitar a moldura diretamente deixa explícito que a soma deve terminar antes da linha atual.

## Cuidado com filtros e o histórico disponível

Funções de janela são calculadas depois do `WHERE`. Se filtrarmos apenas os movimentos das 10:00 em uma consulta simples, o saldo não incluirá os eventos das 08:00 e 09:15.

Quando o relatório precisa calcular o histórico completo e exibir apenas parte dele, separe as etapas:

```sql
WITH saldos AS (
    SELECT
        movimento_id,
        conta_id,
        ocorrido_em,
        descricao,
        valor,
        sum(valor) OVER (
            PARTITION BY conta_id
            ORDER BY ocorrido_em, movimento_id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS saldo
    FROM sql_semana_14.movimentacoes
    WHERE conta_id = 101
)
SELECT *
FROM saldos
WHERE ocorrido_em >= '2026-10-30 10:00:00-03'
ORDER BY ocorrido_em, movimento_id;
```

O filtro da conta fica dentro porque define a partição necessária. O filtro de apresentação por horário fica fora, depois do cálculo.

Em uma tabela grande, ler todo o histórico pode ser caro. Uma estratégia comum é manter posições de fechamento confiáveis e somar apenas os movimentos posteriores ao último fechamento. Essa otimização muda o desenho dos dados e precisa garantir que eventos atrasados, correções e reprocessamentos sejam tratados.

## Escolhendo a moldura pela pergunta

| Pergunta | Moldura possível |
|---|---|
| Qual é o saldo depois de cada evento em uma sequência determinística? | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |
| Qual foi o líquido das três movimentações mais recentes? | `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` |
| Qual foi o líquido nas últimas 24 horas? | `RANGE BETWEEN INTERVAL '24 hours' PRECEDING AND CURRENT ROW` |
| Qual é o total do instante atual e do instante anterior? | `GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW` |
| Qual era o saldo antes do evento atual? | `ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING` |

A sintaxe deve seguir o significado da pergunta. Trocar `ROWS` por `RANGE` apenas porque ambos produzem o mesmo resultado em uma massa sem empates deixa uma diferença escondida que pode aparecer quando novos dados forem inseridos.

## Cuidados antes de levar a consulta para produção

- defina qual coluna representa a ordem de negócio dos movimentos;
- adicione um desempate determinístico quando a análise for evento a evento;
- não suponha que timestamps tenham precisão suficiente para formar uma chave única;
- declare a moldura em consultas nas quais empates mudam o resultado;
- diferencie saldo acumulado de valor líquido em janela móvel;
- calcule o histórico antes de aplicar filtros apenas de apresentação;
- considere eventos atrasados e correções retroativas;
- valide o sinal de créditos e débitos e a origem do saldo inicial;
- confira o plano com volume representativo e `EXPLAIN (ANALYZE, BUFFERS)`;
- reconcilie o último saldo calculado com uma referência conhecida.

Para localizar os movimentos de uma conta em ordem, um índice iniciado por `(conta_id, ocorrido_em, movimento_id)` pode ser útil. A decisão depende dos filtros, do volume e do plano observado. A função de janela ainda precisa processar as linhas necessárias para produzir o histórico solicitado.

## Exercício

Adicione à conta 101 estes movimentos:

```sql
INSERT INTO sql_semana_14.movimentacoes
    (conta_id, ocorrido_em, descricao, valor)
VALUES
    (101, '2026-10-31 10:00:00-03', 'Recebimento pedido 502', 100.00),
    (101, '2026-11-01 10:00:00-03', 'Pagamento serviço',      -40.00);
```

Depois, produza para cada linha:

1. o saldo desde o início;
2. o líquido dos dois movimentos mais recentes;
3. o líquido das 24 horas anteriores, incluindo o instante atual;
4. o saldo imediatamente anterior.

Compare quantas linhas entram nas molduras `ROWS` e `RANGE`. Em seguida, adicione outro movimento no mesmo instante de um registro existente e observe quais resultados tratam os dois eventos como pares.

## Conclusão

Uma função de janela não é definida apenas por partição e ordenação. A moldura determina quais linhas participam do cálculo da linha atual.

No saldo evento a evento, `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` combina com uma ordem determinística. `RANGE` é apropriado quando os limites pertencem ao domínio do valor, como as últimas 24 horas. `GROUPS` avança por conjuntos de pares e preserva esses empates como unidades.

O principal cuidado é não depender por acidente da moldura padrão. Quando movimentos compartilham o mesmo horário, `sum() over (order by ocorrido_em)` pode incluir o grupo inteiro e repetir o mesmo saldo para todas as linhas pares.

Declarar a ordem e a moldura transforma uma intenção genérica de “calcular o acumulado” em uma regra verificável: qual histórico entra, onde ele começa e exatamente onde termina.

## Referências

- [PostgreSQL 16 — sintaxe de chamadas de funções de janela](https://www.postgresql.org/docs/16/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS)
- [PostgreSQL 16 — tutorial de funções de janela](https://www.postgresql.org/docs/16/tutorial-window.html)
- [PostgreSQL 16 — processamento de um SELECT](https://www.postgresql.org/docs/16/sql-select.html)
