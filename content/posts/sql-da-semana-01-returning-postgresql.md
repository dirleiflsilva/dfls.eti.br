---
title: "SQL da Semana #01 — RETURNING: obtendo dados sem fazer uma nova consulta"
date: 2026-07-15
lastmod: 2026-08-20
draft: false
toc: true
slug: "sql-da-semana-01-returning-postgresql"
description: "Aprenda a usar RETURNING no PostgreSQL para obter os dados inseridos, alterados ou removidos sem executar uma consulta adicional."
tags:
  - postgresql
  - sql
  - returning
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 1
---

Ao inserir um registro no PostgreSQL, é comum precisar do identificador
gerado pelo banco para continuar o processamento. Uma solução possível é
executar o `INSERT` e, em seguida, fazer outra consulta.

O PostgreSQL oferece uma alternativa mais direta: a cláusula `RETURNING`.

## O problema

Considere uma tabela que armazena tarefas de processamento:

```sql
CREATE TABLE jobs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    file_path text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);
```

Depois de criar um job, a aplicação precisa conhecer o `id`, o estado
inicial e a data atribuída pelo banco.

Sem `RETURNING`, seria necessário inserir o registro e executar uma nova
consulta. Além do trabalho adicional, tentar localizar o registro por
valores como `file_path` pode produzir resultados ambíguos quando existem
operações concorrentes.

## A solução

Podemos solicitar os valores diretamente no mesmo comando:

```sql
INSERT INTO jobs (file_path)
VALUES ('/media/entrevista.mp4')
RETURNING id, file_path, status, created_at;
```

Resultado:

```text
 id | file_path                | status  | created_at
----+--------------------------+---------+------------------------
 42 | /media/entrevista.mp4    | pending | 2026-07-15 10:00:00-03
```

## Como funciona

`RETURNING` devolve os valores produzidos pelo próprio comando. Isso inclui
colunas informadas pela aplicação e valores definidos pelo banco, como:

- identificadores gerados automaticamente;
- valores padrão;
- datas criadas com `now()`;
- valores modificados por triggers.

A cláusula também pode ser utilizada com `UPDATE`:

```sql
UPDATE jobs
SET status = 'processing'
WHERE id = 42
RETURNING id, status;
```

E com `DELETE`, para informar quais dados foram removidos:

```sql
DELETE FROM jobs
WHERE id = 42
RETURNING id, file_path;
```

Embora `RETURNING *` seja válido, informar apenas as colunas necessárias
torna o contrato da consulta mais claro e evita transferir dados que a
aplicação não utilizará.

## Ganho obtido

- elimina uma consulta adicional;
- devolve exatamente os valores gravados pelo PostgreSQL;
- simplifica o código da aplicação;
- evita tentativas frágeis de localizar novamente o registro inserido;
- funciona em operações de inserção, atualização e exclusão.

## Quando utilizar

Use `RETURNING` quando a aplicação precisar dos dados afetados por um
`INSERT`, `UPDATE` ou `DELETE`, principalmente identificadores, valores
padrão e informações calculadas pelo banco.

Evite retornar todas as colunas sem necessidade. Em alterações de muitos
registros, o resultado também pode ser grande; retorne somente os dados que
serão realmente consumidos.

## Pratique no laboratório

O [laboratório do episódio 01](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/01-returning) fornece uma tabela `jobs` com três tarefas para testar `INSERT`, `UPDATE` e `DELETE` com `RETURNING`.

Depois de preparar o PostgreSQL conforme o [README do repositório](https://github.com/dirleiflsilva/sql-da-semana-postgresql), execute no `psql`:

```text
\i /sql-da-semana/01-returning/01-tabelas.sql
\i /sql-da-semana/01-returning/02-dados.sql
\i /sql-da-semana/01-returning/03-consultas.sql
```

O exercício mostra o identificador gerado no `INSERT`, os novos valores do `UPDATE`, a linha removida pelo `DELETE` e o estado final das tarefas.

## Referências

- [PostgreSQL — Returning Data from Modified Rows](https://www.postgresql.org/docs/current/dml-returning.html)
- [PostgreSQL — INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- [PostgreSQL — UPDATE](https://www.postgresql.org/docs/current/sql-update.html)
- [PostgreSQL — DELETE](https://www.postgresql.org/docs/current/sql-delete.html)
