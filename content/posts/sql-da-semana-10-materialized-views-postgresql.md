---
title: "SQL da Semana #10 — Materialized Views: consolidando indicadores de pedidos"
date: 2026-10-02
draft: false
toc: true
slug: "sql-da-semana-10-materialized-views-postgresql"
description: "Use materialized views no PostgreSQL para armazenar indicadores de pedidos, entender a defasagem dos dados e planejar o refresh."
tags:
  - postgresql
  - sql
  - materialized-views
  - indicadores
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 10
---

Um painel consulta pedidos várias vezes ao dia para mostrar quantidade e valor por data e situação. Quando a consulta precisa percorrer e agrupar muitas linhas a cada acesso, recalcular sempre o mesmo resultado pode deixar de ser uma boa troca.

Uma materialized view permite armazenar o resultado dessa consulta no PostgreSQL. A leitura passa a usar dados já consolidados, mas surge uma decisão nova: quando atualizar essa cópia?

Neste episódio, vamos criar indicadores de pedidos, alterar os dados de origem e observar que a materialized view permanece desatualizada até receber um `REFRESH`.

> O [laboratório do episódio 10](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/10-materialized-views) está disponível no GitHub. Ele permite comparar a consulta direta com o resultado armazenado e executar os dois modos de refresh apresentados neste artigo.

## O cenário

O exemplo representa uma base própria de integração, com dados sintéticos. Não há acesso nem escrita em tabelas do ERP.

Queremos consultar, por dia e situação:

- a quantidade de pedidos;
- o valor total;
- o ticket médio.

Para manter o exercício pequeno, cada pedido já possui seu valor total. Em um sistema real, esse valor pode vir de itens, descontos, impostos e outras regras que precisam fazer parte da definição do indicador.

## Tabela e dados iniciais

```sql
CREATE SCHEMA sql_semana_10;

CREATE TABLE sql_semana_10.pedidos (
    pedido_id integer PRIMARY KEY,
    criado_em timestamptz NOT NULL,
    situacao  text NOT NULL CHECK (
        situacao IN ('pendente', 'aprovado', 'cancelado')
    ),
    valor_total numeric(12, 2) NOT NULL CHECK (valor_total >= 0)
);

INSERT INTO sql_semana_10.pedidos
    (pedido_id, criado_em, situacao, valor_total)
VALUES
    (1, '2026-09-28 09:15:00-03', 'aprovado',  120.00),
    (2, '2026-09-28 10:40:00-03', 'aprovado',   80.00),
    (3, '2026-09-28 14:10:00-03', 'cancelado',  50.00),
    (4, '2026-09-29 08:30:00-03', 'aprovado',  200.00),
    (5, '2026-09-29 11:20:00-03', 'pendente',   90.00),
    (6, '2026-09-30 16:00:00-03', 'aprovado',  160.00);
```

O uso de `timestamptz` preserva o instante. Para definir o dia do indicador, precisamos também declarar qual fuso representa o calendário do negócio.

## A consulta que será consolidada

Antes de criar outro objeto, podemos validar a agregação diretamente nas tabelas de origem:

```sql
SELECT
    (criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
    situacao,
    count(*) AS quantidade,
    sum(valor_total) AS valor_total,
    round(avg(valor_total), 2) AS ticket_medio
FROM sql_semana_10.pedidos
GROUP BY
    (criado_em AT TIME ZONE 'America/Sao_Paulo')::date,
    situacao
ORDER BY dia, situacao;
```

Resultado esperado:

| Dia | Situação | Quantidade | Valor total | Ticket médio |
|---|---|---:|---:|---:|
| 2026-09-28 | aprovado | 2 | 200.00 | 100.00 |
| 2026-09-28 | cancelado | 1 | 50.00 | 50.00 |
| 2026-09-29 | aprovado | 1 | 200.00 | 200.00 |
| 2026-09-29 | pendente | 1 | 90.00 | 90.00 |
| 2026-09-30 | aprovado | 1 | 160.00 | 160.00 |

Essa consulta já responde à pergunta. A materialized view não muda o significado da agregação: ela muda onde e quando o resultado é calculado e armazenado.

## Criando a materialized view

```sql
CREATE MATERIALIZED VIEW sql_semana_10.indicadores_pedidos AS
SELECT
    (criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
    situacao,
    count(*) AS quantidade,
    sum(valor_total) AS valor_total,
    round(avg(valor_total), 2) AS ticket_medio
FROM sql_semana_10.pedidos
GROUP BY
    (criado_em AT TIME ZONE 'America/Sao_Paulo')::date,
    situacao;
```

Por padrão, o PostgreSQL executa a consulta durante a criação e armazena suas linhas. Depois disso, podemos consultar o objeto como uma relação:

```sql
SELECT dia, situacao, quantidade, valor_total, ticket_medio
FROM sql_semana_10.indicadores_pedidos
ORDER BY dia, situacao;
```

O resultado inicial é igual ao da consulta de origem. A diferença aparece quando os pedidos mudam.

## Observando a defasagem

Vamos aprovar o pedido que estava pendente e incluir outro pedido no mesmo dia:

```sql
UPDATE sql_semana_10.pedidos
SET situacao = 'aprovado'
WHERE pedido_id = 5;

INSERT INTO sql_semana_10.pedidos
    (pedido_id, criado_em, situacao, valor_total)
VALUES
    (7, '2026-09-29 18:45:00-03', 'aprovado', 110.00);
```

A consulta direta sobre `pedidos` passa a mostrar três pedidos aprovados em 29/09, total de `400.00` e ticket médio de `133.33`. A linha pendente desaparece.

Já a materialized view continua com o retrato anterior:

```sql
SELECT dia, situacao, quantidade, valor_total, ticket_medio
FROM sql_semana_10.indicadores_pedidos
WHERE dia = DATE '2026-09-29'
ORDER BY situacao;
```

Ela ainda informa um aprovado de `200.00` e um pendente de `90.00`. Uma materialized view não acompanha automaticamente cada `INSERT`, `UPDATE` ou `DELETE` realizado nas tabelas de origem.

## Atualizando o resultado armazenado

```sql
REFRESH MATERIALIZED VIEW sql_semana_10.indicadores_pedidos;
```

Depois do comando, a mesma consulta sobre 29/09 retorna:

| Dia | Situação | Quantidade | Valor total | Ticket médio |
|---|---|---:|---:|---:|
| 2026-09-29 | aprovado | 3 | 400.00 | 133.33 |

O `REFRESH` recalcula a consulta que define a materialized view e substitui seu conteúdo. Ele não é um agendador. A aplicação ou a operação do banco precisa decidir quando executá-lo, considerando custo, frequência das mudanças e defasagem aceitável para quem consome o indicador.

## E se houver leitores durante o refresh?

O modo padrão bloqueia consultas concorrentes à materialized view enquanto atualiza seu conteúdo. Quando ela precisa continuar disponível para leitura, o PostgreSQL oferece:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY
    sql_semana_10.indicadores_pedidos;
```

Esse comando exige que a materialized view já esteja populada e possua ao menos um índice `UNIQUE` baseado apenas em colunas, sem cláusula `WHERE`, e que identifique todas as linhas. Neste resultado, `dia` e `situacao` identificam cada grupo:

```sql
CREATE UNIQUE INDEX indicadores_pedidos_dia_situacao_uq
    ON sql_semana_10.indicadores_pedidos (dia, situacao);

REFRESH MATERIALIZED VIEW CONCURRENTLY
    sql_semana_10.indicadores_pedidos;
```

O modo concorrente evita bloquear as leituras da materialized view, mas não torna a atualização gratuita nem permite várias atualizações simultâneas do mesmo objeto. A documentação também observa que o refresh comum tende a usar menos recursos e terminar mais rapidamente. A escolha deve ser validada com o volume e a concorrência reais.

Mesmo que a definição contenha `ORDER BY`, um refresh não garante preservar a ordem física. Toda consulta que depende de ordenação deve usar seu próprio `ORDER BY`.

## Quando usar — e quando não usar

Uma materialized view pode ser útil quando:

- a consulta de origem é relativamente cara;
- o resultado é lido muitas vezes;
- alguma defasagem é aceitável;
- existe uma regra clara para atualizar e monitorar o objeto.

Ela pode ser uma escolha ruim quando o consumidor precisa refletir cada alteração imediatamente. Também não corrige uma consulta mal definida, índices ausentes nas tabelas de origem ou um modelo inadequado.

Antes de adotá-la, vale responder:

1. Qual atraso é aceitável para o indicador?
2. Quanto tempo e quantos recursos o refresh consome?
3. O que acontece se o refresh falhar?
4. Como o consumidor conhece a última atualização bem-sucedida?
5. O refresh comum atende ou as leituras precisam continuar disponíveis?

## Praticando no laboratório

O [laboratório do episódio 10](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/10-materialized-views) contém:

```text
episodios/10-materialized-views/
|-- 01-tabelas.sql
|-- 02-dados.sql
|-- 03-consultas.sql
`-- README.md
```

Depois de preparar o PostgreSQL com Docker Compose conforme o [README do repositório](https://github.com/dirleiflsilva/sql-da-semana-postgresql), abra o `psql` na raiz do projeto:

```bash
docker compose exec postgres \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d sql_da_semana
```

Ajuste usuário e banco se personalizou o `.env`. Dentro do `psql`, execute na ordem:

```psql
\i /sql-da-semana/10-materialized-views/01-tabelas.sql
\i /sql-da-semana/10-materialized-views/02-dados.sql
\i /sql-da-semana/10-materialized-views/03-consultas.sql
```

O primeiro arquivo remove e recria somente o schema `sql_semana_10`; o segundo carrega os seis pedidos iniciais; o terceiro percorre a consulta direta, a criação da materialized view, a defasagem, os dois modos de refresh e a consulta do índice no catálogo.

**Para repetir o laboratório, execute os três arquivos desde o início.** Repetir somente a carga causa conflito de chave primária; repetir somente as consultas causa conflito nos nomes da materialized view e do índice.

## Validação registrada

O [README do episódio](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/main/episodios/10-materialized-views/README.md#validação-realizada) registra a execução em 26/09/2026 no **PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1)**, com `psql -X -v ON_ERROR_STOP=1`.

A sequência completa foi executada duas vezes. A validação confirmou os cinco grupos iniciais, a defasagem depois da alteração dos pedidos, o grupo atualizado com três aprovados e total de `400.00`, a existência do índice `UNIQUE` e o sucesso do `REFRESH MATERIALIZED VIEW CONCURRENTLY`. A comparação dos dumps também não encontrou alterações nos schemas dos episódios anteriores, desconsiderando os tokens aleatórios de proteção do `pg_dump`.

## Conclusão

Materialized views trocam atualização imediata por leituras de um resultado previamente calculado. No cenário dos pedidos, o painel deixa de refazer a agregação em cada acesso, mas passa a depender de uma política explícita de refresh.

O ponto principal não é somente criar o objeto. É definir a defasagem aceitável, validar o custo da atualização e tornar visível quando o indicador foi renovado pela última vez.

## Referências

- [PostgreSQL 16: Materialized Views](https://www.postgresql.org/docs/16/rules-materializedviews.html)
- [PostgreSQL 16: CREATE MATERIALIZED VIEW](https://www.postgresql.org/docs/16/sql-creatematerializedview.html)
- [PostgreSQL 16: REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html)
