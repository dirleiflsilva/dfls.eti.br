---
title: "SQL da Semana #09 — JSONB: consultando eventos e metadados de documentos fiscais"
date: 2026-09-25
draft: false
toc: true
slug: "sql-da-semana-09-jsonb-postgresql"
description: "Consulte metadados e eventos com JSONB no PostgreSQL: extração de campos, filtros por conteúdo, arrays, valores nulos e índices."
tags:
  - postgresql
  - sql
  - jsonb
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 9
---

Uma integração que recebe documentos fiscais costuma registrar mais do que o documento: origem da importação, tentativas de processamento e eventos recebidos ao longo do caminho.

Parte desses dados tem estrutura estável. Outra parte varia conforme a origem ou a etapa do processamento. Neste episódio, vamos consultar essa segunda parte com `jsonb`, mantendo a identificação do documento em colunas relacionais.

> O [laboratório do episódio 09](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/09-jsonb) já está disponível no GitHub, com os cinco documentos e as consultas deste artigo. Execute os scripts para observar as diferenças entre chave ausente, JSON `null` e array vazio.

## O cenário

Queremos responder às seguintes perguntas: de onde veio cada documento, quais estão autorizados, quais receberam um evento de cancelamento, quais possuem a chave `protocolo` e quais contêm um valor não nulo nessa chave.

O exemplo representa uma base própria de integração, com dados inteiramente sintéticos. Os identificadores não são chaves fiscais válidas e o JSON não reproduz um leiaute oficial. Não há acesso ou escrita em tabelas do Protheus.

A proposta é armazenar metadados derivados para consulta. O armazenamento do XML original e a implementação de regras fiscais ficam fora deste exercício.

## Tabela e dados para o laboratório

Execute os blocos na ordem apresentada, em uma base de estudos. O schema separa os objetos deste episódio:

```sql
CREATE SCHEMA sql_semana_09;

CREATE TABLE sql_semana_09.documentos (
    documento_id integer PRIMARY KEY,
    referencia   text NOT NULL UNIQUE,
    metadados    jsonb NOT NULL,
    CHECK (jsonb_typeof(metadados) = 'object')
);

INSERT INTO sql_semana_09.documentos
    (documento_id, referencia, metadados)
VALUES
    (1, 'DOC-001', '{
        "origem": "api",
        "situacao": "autorizado",
        "emitente": {"uf": "SP"},
        "protocolo": "PROTO-001",
        "eventos": [{"tipo": "autorizacao", "sequencia": 1}]
    }'),
    (2, 'DOC-002', '{
        "origem": "arquivo",
        "situacao": "cancelado",
        "emitente": {"uf": "RJ"},
        "protocolo": "PROTO-002",
        "eventos": [
            {"tipo": "autorizacao", "sequencia": 1},
            {"tipo": "cancelamento", "sequencia": 2}
        ]
    }'),
    (3, 'DOC-003', '{
        "origem": "api",
        "situacao": "pendente",
        "emitente": {"uf": "MG"},
        "eventos": []
    }'),
    (4, 'DOC-004', '{
        "origem": "api",
        "situacao": "autorizado",
        "emitente": {"uf": "SP"},
        "protocolo": null,
        "eventos": null
    }'),
    (5, 'DOC-005', '{
        "origem": "arquivo",
        "situacao": "pendente"
    }');
```

O primeiro documento tem um evento; o segundo tem dois. Os demais representam array vazio, `null` JSON e chave ausente. Essa diferença fará parte das consultas.

O `CHECK` exige um objeto na raiz, mas não valida seus campos internos. O comando de criação pressupõe que o schema ainda não existe; o script `01-tabelas.sql` do laboratório remove e recria `sql_semana_09`. Reserve esse schema ao episódio, sem dependências externas, pois a remoção usa `CASCADE`.

## Extraindo campos e caminhos

```sql
SELECT
    documento_id,
    metadados -> 'emitente' AS emitente,
    metadados ->> 'origem' AS origem,
    metadados #>> '{emitente,uf}' AS uf
FROM sql_semana_09.documentos
ORDER BY documento_id;
```

`->` mantém o resultado como JSONB; `->>` devolve texto. Para um caminho aninhado, `#>>` extrai texto diretamente. A consulta deve produzir cinco linhas, com UF `SP`, `RJ`, `MG`, `SP` e SQL `NULL`, nessa ordem. A chave `emitente` não existe no último documento.

Essas regras de extração estão na [documentação de funções e operadores JSON do PostgreSQL 16](https://www.postgresql.org/docs/16/functions-json.html).

## Filtrando pelo conteúdo

Para selecionar os documentos autorizados recebidos pela API:

```sql
SELECT documento_id, referencia
FROM sql_semana_09.documentos
WHERE metadados @> '{"origem":"api","situacao":"autorizado"}'::jsonb
ORDER BY documento_id;
```

Resultado esperado: documentos `1` e `4`. O operador `@>` verifica contenção; o documento pode possuir outros campos além dos informados no filtro.

Também podemos procurar um objeto dentro do array de eventos:

```sql
SELECT documento_id, referencia
FROM sql_semana_09.documentos
WHERE metadados @> '{"eventos":[{"tipo":"cancelamento"}]}'::jsonb
ORDER BY documento_id;
```

Somente o documento `2` deve aparecer. A consulta procura a presença do evento, sem assumir que ele ocupa uma posição fixa no array ou que determina, por si só, a situação atual do documento.

## Chave ausente e null não são a mesma coisa

```sql
SELECT
    documento_id,
    metadados ? 'protocolo' AS possui_chave,
    metadados -> 'protocolo' = 'null'::jsonb AS valor_json_null,
    metadados ->> 'protocolo' IS NULL AS texto_sql_null
FROM sql_semana_09.documentos
ORDER BY documento_id;
```

Resultado esperado:

| documento_id | possui_chave | valor_json_null | texto_sql_null |
|---|---|---|---|
| 1 | true | false | false |
| 2 | true | false | false |
| 3 | false | SQL NULL | true |
| 4 | true | true | true |
| 5 | false | SQL NULL | true |

O operador `?` verifica a existência da chave no nível consultado. Extrair texto não distingue chave ausente de valor JSON `null`: ambos viram SQL `NULL`. Por isso, verificar somente `->> 'protocolo' IS NULL` não informa se o campo foi enviado.

## Transformando eventos em linhas

No [episódio sobre LATERAL](/posts/sql-da-semana-07-lateral-postgresql/), vimos como expandir dados de cada linha. Aqui, cada documento pode gerar várias linhas de eventos:

```sql
SELECT
    d.documento_id,
    e.posicao,
    e.evento ->> 'tipo' AS tipo,
    (e.evento ->> 'sequencia')::integer AS sequencia
FROM sql_semana_09.documentos AS d
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(d.metadados -> 'eventos') = 'array'
            THEN d.metadados -> 'eventos'
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS e(evento, posicao)
ORDER BY d.documento_id, e.posicao;
```

O resultado esperado tem três linhas: autorização do documento `1`, autorização do documento `2` e cancelamento do documento `2`.

A expressão `CASE` entrega um array à função mesmo quando o campo está ausente ou contém `null`. Neste exercício, qualquer valor que não seja array é tratado como coleção vazia. Em uma integração, um tipo inesperado também pode exigir registro de erro ou rejeição na entrada.

`WITH ORDINALITY` numera os elementos a partir de 1. A posição no array não substitui uma data de ocorrência nem uma regra de ordenação dos eventos. O cast de `sequencia` pressupõe os números inteiros da massa proposta; valores externos precisam de validação antes da conversão.

Para preservar documentos sem eventos, substitua `CROSS JOIN LATERAL` por `LEFT JOIN LATERAL` e acrescente `ON true` após `AS e(evento, posicao)`. A saída deverá ter seis linhas, incluindo os documentos `3`, `4` e `5` com colunas do evento em SQL `NULL`.

## Um primeiro índice para investigar

```sql
CREATE INDEX documentos_metadados_gin_idx
    ON sql_semana_09.documentos USING gin (metadados);

ANALYZE sql_semana_09.documentos;

EXPLAIN (ANALYZE, BUFFERS)
SELECT documento_id
FROM sql_semana_09.documentos
WHERE metadados @> '{"eventos":[{"tipo":"cancelamento"}]}'::jsonb;
```

O índice GIN com a classe padrão de JSONB suporta os filtros de contenção apresentados e o operador de existência de chave. Isso não significa que atenderá qualquer expressão sobre o JSON: um filtro como `metadados ->> 'origem' = 'api'` não usa automaticamente esse mesmo caminho de acesso.

Com cinco documentos, uma leitura sequencial é uma escolha plausível. Esta massa serve para conferir resultados. Uma comparação de desempenho exigirá outra carga, com volume e distribuição documentados, além de planos antes e depois do índice. As opções de indexação estão na [documentação de JSONB do PostgreSQL 16](https://www.postgresql.org/docs/16/datatype-json.html#JSON-INDEXING).

## O que deve continuar relacional?

Neste modelo, `documento_id` e `referencia` permanecem em colunas com restrições explícitas. Se situação, origem ou outros atributos passarem a exigir validação rígida, relacionamentos ou consultas recorrentes, vale rever sua permanência no JSON.

O exercício usa uma lista pequena de eventos dentro do documento para demonstrar consultas. Um histórico crescente, com identidade própria e atualizações concorrentes, merece avaliar uma tabela de eventos relacionada ao documento.

## Praticando no laboratório

O [laboratório do episódio 09](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/09-jsonb) contém os arquivos:

```text
episodios/09-jsonb/
|-- 01-tabelas.sql
|-- 02-dados.sql
|-- 03-consultas.sql
`-- README.md
```

O primeiro script recria o schema e a tabela; o segundo insere os cinco documentos sintéticos; o terceiro executa as consultas de extração, contenção, nulidade, expansão com as duas junções e investigação do índice.

Depois de preparar o PostgreSQL com Docker Compose conforme o [README do repositório](https://github.com/dirleiflsilva/sql-da-semana-postgresql), abra o `psql` na raiz do projeto:

```bash
docker compose exec postgres \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d sql_da_semana
```

Ajuste usuário e banco se personalizou o `.env`. Dentro do `psql`, execute na ordem:

```psql
\pset null 'SQL NULL'
\i /sql-da-semana/09-jsonb/01-tabelas.sql
\i /sql-da-semana/09-jsonb/02-dados.sql
\i /sql-da-semana/09-jsonb/03-consultas.sql
```

O comando `\pset` torna os valores SQL `NULL` visíveis na saída; os booleanos aparecem como `t` e `f`. Em DBeaver ou pgAdmin, abra os três arquivos SQL e execute-os na mesma ordem, sem os comandos exclusivos do `psql` iniciados por `\`.

**Para repetir o laboratório, execute os três arquivos desde o início.** O primeiro remove os dados e objetos de `sql_semana_09` com `CASCADE`. Repetir somente a carga causa conflito de chave primária; repetir somente as consultas causa conflito no nome do índice já criado.

## Validação registrada

O [README do episódio](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/be16ecb3c2c81183d4263af64af2dcc4be9dbf1c/episodios/09-jsonb/README.md#validação-realizada) registra a execução em 12/09/2026 no **PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1)**, com `ON_ERROR_STOP=1` e repetição da sequência completa.

Os resultados registrados correspondem aos exemplos deste artigo: cinco documentos, IDs `1` e `4` no filtro por origem e situação, ID `2` no filtro de cancelamento, a tabela de nulidade do protocolo e três/seis linhas nas junções. O plano observado foi `Seq Scan`, com um documento retornado. Esse plano descreve a execução com a massa pequena, sem demonstrar ganho de desempenho pelo índice.

## Conclusão

JSONB permite consultar atributos variáveis junto com dados relacionais. Neste cenário, a extração recupera campos, a contenção encontra documentos e a expansão transforma eventos em linhas.

O cuidado principal é definir o significado dos dados: chave ausente, valor nulo e coleção vazia representam situações diferentes. O laboratório permite observar essas diferenças com uma massa pequena antes de avançar para uma investigação de desempenho.

## Referências

- [PostgreSQL 16: funções e operadores JSON](https://www.postgresql.org/docs/16/functions-json.html)
- [PostgreSQL 16: tipos JSON e indexação de JSONB](https://www.postgresql.org/docs/16/datatype-json.html)
