---
title: "SQL da Semana #13 — Datas em campos de texto: calendário de faturamento e períodos sem movimento"
date: 2026-10-23
draft: false
toc: true
slug: "sql-da-semana-13-datas-texto-calendario-faturamento"
description: "Normalize datas armazenadas como texto no PostgreSQL, separe valores vazios e inválidos e monte um calendário de faturamento que preserve dias sem movimento."
tags:
  - postgresql
  - sql
  - datas
  - generate-series
  - qualidade-de-dados
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 13
---

Sistemas legados e integrações nem sempre entregam datas em uma coluna do tipo `date`. É comum encontrar um campo de texto com oito caracteres no formato `AAAAMMDD`, além de valores vazios e conteúdos que parecem datas, mas não existem no calendário.

Converter tudo diretamente com `::date` torna a consulta frágil: basta uma linha inválida para interromper o relatório inteiro. Ignorar o problema também não resolve. Se os valores ruins desaparecerem silenciosamente, o total exibido pode parecer correto sem representar toda a carga recebida.

Neste episódio, vamos normalizar um conjunto sintético de datas textuais, separar ausências de erros e construir um calendário de faturamento que preserve inclusive os dias sem movimento.

> O [laboratório reproduzível do episódio 13](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/13-datas-texto-calendario) contém os scripts de criação, carga, consultas e validação automatizada apresentados neste artigo.

## O cenário

O exemplo representa dados importados para uma base própria de integração. Não há leitura nem escrita em tabelas de ERP.

```sql
CREATE SCHEMA sql_semana_13;

CREATE TABLE sql_semana_13.faturamento_importado (
    movimento_id integer PRIMARY KEY,
    data_emissao  text,
    valor         numeric(12, 2) NOT NULL
);

INSERT INTO sql_semana_13.faturamento_importado
    (movimento_id, data_emissao, valor)
VALUES
    (1, '20261001', 120.00),
    (2, '20261003',  80.00),
    (3, '20261003',  45.50),
    (4, '20261007', 200.00),
    (5, '',           30.00),
    (6, '        ',   25.00),
    (7, '20260230',   60.00),
    (8, '2026-10-05', 70.00),
    (9, NULL,         15.00);
```

As quatro primeiras linhas possuem datas válidas no formato esperado. As demais representam situações diferentes:

- texto vazio ou preenchido apenas com espaços;
- `NULL`;
- oito dígitos que não formam uma data real;
- uma data válida em outro formato.

Essa distinção é útil. Ausência de informação e conteúdo inválido podem exigir tratamentos diferentes na origem e no monitoramento da integração.

## Por que não converter diretamente

Uma expressão como esta pressupõe que todas as linhas são válidas:

```sql
SELECT data_emissao::date
FROM sql_semana_13.faturamento_importado;
```

Ao encontrar um conteúdo incompatível, o PostgreSQL gera erro e encerra o comando. Adicionar apenas um filtro por comprimento também não basta: `20260230` possui oito caracteres, mas 30 de fevereiro não existe.

`to_date()` tampouco deve ser usado sozinho como validador. A função foi projetada para interpretar uma máscara e pode normalizar determinadas entradas em vez de rejeitá-las segundo a regra estrita esperada pela integração.

O primeiro passo é declarar o contrato do dado: neste exemplo, uma data aceitável precisa conter exatamente oito dígitos no formato `AAAAMMDD` e representar um dia existente.

## Normalizando sem interromper a consulta

Vamos preparar o texto em etapas. Primeiro, espaços e strings vazias são convertidos em `NULL`. Depois, somente oito dígitos são reorganizados para o formato ISO `AAAA-MM-DD`.

```sql
WITH preparados AS (
    SELECT
        movimento_id,
        NULLIF(btrim(data_emissao), '') AS data_original,
        valor
    FROM sql_semana_13.faturamento_importado
),
candidatos AS (
    SELECT
        movimento_id,
        data_original,
        valor,
        CASE
            WHEN data_original ~ '^[0-9]{8}$' THEN
                substr(data_original, 1, 4) || '-' ||
                substr(data_original, 5, 2) || '-' ||
                substr(data_original, 7, 2)
        END AS data_iso
    FROM preparados
),
validados AS (
    SELECT
        movimento_id,
        data_original,
        valor,
        data_iso,
        data_iso IS NOT NULL
            AND pg_input_is_valid(data_iso, 'date') AS data_valida
    FROM candidatos
)
SELECT
    movimento_id,
    data_original,
    CASE
        WHEN data_valida THEN data_iso::date
    END AS data_normalizada,
    valor
FROM validados
ORDER BY movimento_id;
```

`pg_input_is_valid()` verifica se o texto pode ser convertido para o tipo informado sem lançar o erro que uma conversão direta produziria. A expressão regular confirma o formato; a validação do tipo confirma o calendário.

O `CASE` só executa o cast nas linhas aprovadas. O resultado esperado para os movimentos válidos é:

| Movimento | Texto original | Data normalizada | Valor |
|---:|---|---|---:|
| 1 | 20261001 | 2026-10-01 | 120.00 |
| 2 | 20261003 | 2026-10-03 | 80.00 |
| 3 | 20261003 | 2026-10-03 | 45.50 |
| 4 | 20261007 | 2026-10-07 | 200.00 |

As demais linhas recebem `NULL` em `data_normalizada`, mas continuam disponíveis para diagnóstico.

## Separando ausência de data e conteúdo inválido

Antes de produzir o relatório, vale medir a qualidade da entrada:

```sql
WITH preparados AS (
    SELECT
        movimento_id,
        NULLIF(btrim(data_emissao), '') AS data_original
    FROM sql_semana_13.faturamento_importado
),
candidatos AS (
    SELECT
        movimento_id,
        data_original,
        CASE
            WHEN data_original ~ '^[0-9]{8}$' THEN
                substr(data_original, 1, 4) || '-' ||
                substr(data_original, 5, 2) || '-' ||
                substr(data_original, 7, 2)
        END AS data_iso
    FROM preparados
),
classificados AS (
    SELECT
        movimento_id,
        CASE
            WHEN data_original IS NULL THEN 'ausente'
            WHEN data_iso IS NULL THEN 'formato_invalido'
            WHEN NOT pg_input_is_valid(data_iso, 'date') THEN 'data_invalida'
            ELSE 'valida'
        END AS situacao
    FROM candidatos
)
SELECT situacao, count(*) AS quantidade
FROM classificados
GROUP BY situacao
ORDER BY situacao;
```

Resultado esperado:

| Situação | Quantidade |
|---|---:|
| ausente | 3 |
| data_invalida | 1 |
| formato_invalido | 1 |
| valida | 4 |

O valor `2026-10-05` é uma data reconhecível para uma pessoa, mas viola o contrato `AAAAMMDD` desta carga. Aceitá-lo automaticamente esconderia uma mudança no formato da origem. Se mais de um formato for realmente permitido, cada um deve ter uma regra explícita e testada.

## Agregando somente datas aprovadas

Agora podemos converter as datas válidas e agregar o faturamento diário:

```sql
WITH preparados AS (
    SELECT
        movimento_id,
        NULLIF(btrim(data_emissao), '') AS data_original,
        valor
    FROM sql_semana_13.faturamento_importado
),
candidatos AS (
    SELECT
        movimento_id,
        valor,
        CASE
            WHEN data_original ~ '^[0-9]{8}$' THEN
                substr(data_original, 1, 4) || '-' ||
                substr(data_original, 5, 2) || '-' ||
                substr(data_original, 7, 2)
        END AS data_iso
    FROM preparados
),
movimentos_validos AS (
    SELECT
        movimento_id,
        data_iso::date AS dia,
        valor
    FROM candidatos
    WHERE pg_input_is_valid(data_iso, 'date')
)
SELECT
    dia,
    count(*) AS movimentos,
    sum(valor) AS total
FROM movimentos_validos
GROUP BY dia
ORDER BY dia;
```

Essa agregação retorna somente os três dias que possuem dados válidos. Os dias 2, 4, 5 e 6 de outubro não aparecem, embora pertençam ao intervalo do relatório.

## Incluindo períodos sem movimento

Para representar todos os dias, criamos primeiro o calendário e o usamos como lado esquerdo de um `LEFT JOIN`:

```sql
WITH preparados AS (
    SELECT
        movimento_id,
        NULLIF(btrim(data_emissao), '') AS data_original,
        valor
    FROM sql_semana_13.faturamento_importado
),
candidatos AS (
    SELECT
        movimento_id,
        valor,
        CASE
            WHEN data_original ~ '^[0-9]{8}$' THEN
                substr(data_original, 1, 4) || '-' ||
                substr(data_original, 5, 2) || '-' ||
                substr(data_original, 7, 2)
        END AS data_iso
    FROM preparados
),
movimentos_validos AS (
    SELECT
        movimento_id,
        data_iso::date AS dia,
        valor
    FROM candidatos
    WHERE pg_input_is_valid(data_iso, 'date')
),
faturamento_diario AS (
    SELECT
        dia,
        count(*) AS movimentos,
        sum(valor) AS total
    FROM movimentos_validos
    GROUP BY dia
),
calendario AS (
    SELECT dia::date
    FROM generate_series(
        DATE '2026-10-01',
        DATE '2026-10-07',
        INTERVAL '1 day'
    ) AS serie(dia)
)
SELECT
    c.dia,
    coalesce(f.movimentos, 0) AS movimentos,
    coalesce(f.total, 0.00::numeric) AS total
FROM calendario AS c
LEFT JOIN faturamento_diario AS f USING (dia)
ORDER BY c.dia;
```

Resultado esperado:

| Dia | Movimentos | Total |
|---|---:|---:|
| 2026-10-01 | 1 | 120.00 |
| 2026-10-02 | 0 | 0.00 |
| 2026-10-03 | 2 | 125.50 |
| 2026-10-04 | 0 | 0.00 |
| 2026-10-05 | 0 | 0.00 |
| 2026-10-06 | 0 | 0.00 |
| 2026-10-07 | 1 | 200.00 |

O calendário define o domínio do relatório. O `LEFT JOIN` preserva cada dia desse domínio, e `coalesce()` substitui por zero as métricas ausentes.

Observe que o movimento com texto `2026-10-05` não foi contado no dia 5. Ele não representa um período sem movimento confirmado; representa uma linha rejeitada pelo contrato da carga. Por isso, o relatório financeiro e o indicador de qualidade devem ser analisados juntos.

## Zero, ausência e erro não são a mesma coisa

O resultado `0.00` em um dia informa que nenhum movimento **válido** foi associado àquela data. Ele não prova que a origem não enviou registros problemáticos.

Uma rotina de importação pode manter pelo menos dois resultados:

- a visão normalizada usada pelos relatórios;
- uma área de rejeições com o valor original e o motivo da rejeição.

Também é importante conciliar os valores:

```sql
SELECT
    count(*) AS linhas_recebidas,
    sum(valor) AS valor_recebido
FROM sql_semana_13.faturamento_importado;
```

No conjunto de exemplo, foram recebidas nove linhas, somando `645.50`. O calendário contém quatro movimentos válidos, que somam `445.50`. A diferença de `200.00` pertence às cinco linhas sem data utilizável; ela não deve desaparecer sem explicação.

## Melhorar o modelo continua sendo a solução principal

Se a aplicação controla o schema, datas devem ser armazenadas como `date` ou, quando representam instantes, como um tipo de timestamp escolhido segundo a regra de fuso. O tipo correto impede estados inválidos e elimina conversões repetidas nas consultas.

Em integrações nas quais o texto bruto precisa ser preservado, uma camada de staging pode guardar a entrada original. O processo de transformação valida esse conteúdo e grava uma coluna tipada em uma tabela curada, registrando separadamente as rejeições.

Para consultas frequentes, não é uma boa estratégia repetir a normalização em cada relatório. Além do custo, pequenas diferenças entre expressões podem produzir classificações incompatíveis. Centralize a regra em uma etapa de ingestão, view ou função bem testada, conforme o desenho do sistema.

## Cuidados antes de levar a consulta para produção

- confirme o formato documentado pela origem;
- trate espaços, `NULL` e conteúdo inválido como estados explícitos;
- não use uma expressão regular como única validação de calendário;
- não faça cast antes de validar;
- preserve o valor bruto para auditoria e diagnóstico;
- monitore quantidade e valor das linhas rejeitadas;
- gere somente o intervalo necessário no calendário;
- avalie feriados, dias úteis e fuso quando fizerem parte da regra de negócio.

Uma série diária de datas não é um calendário empresarial. Se o relatório depende de dias úteis, fechamentos ou feriados locais, use uma dimensão de calendário com esses atributos em vez de inferi-los apenas com `generate_series()`.

## Pratique no laboratório

O [laboratório do episódio 13](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/13-datas-texto-calendario) usa os mesmos nove movimentos sintéticos do artigo. Além das consultas, o arquivo `04-validacao.sql` confere a classificação individual, as contagens por situação, a conciliação dos valores e cada linha do calendário.

Depois de preparar o PostgreSQL com Docker Compose conforme o [README do repositório](https://github.com/dirleiflsilva/sql-da-semana-postgresql), abra o `psql` na raiz do projeto:

```bash
docker compose exec postgres \
  psql -X -v ON_ERROR_STOP=1 -U postgres -d sql_da_semana
```

Execute os quatro arquivos na ordem:

```psql
\i /sql-da-semana/13-datas-texto-calendario/01-tabelas.sql
\i /sql-da-semana/13-datas-texto-calendario/02-dados.sql
\i /sql-da-semana/13-datas-texto-calendario/03-consultas.sql
\i /sql-da-semana/13-datas-texto-calendario/04-validacao.sql
```

O primeiro script remove com `CASCADE` e recria somente o schema `sql_semana_13`. Para repetir o laboratório com segurança, execute novamente os quatro arquivos desde o primeiro; repetir apenas a carga causa conflito de chave primária.

O roteiro foi executado duas vezes, desde a recriação do schema, em **PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1), 64-bit**, usando a imagem `postgres:16`, `psql -X` e `ON_ERROR_STOP=1`. Nas duas execuções, a validação terminou com sucesso e confirmou:

- nove linhas recebidas, no valor de `645.50`;
- quatro movimentos válidos, no valor de `445.50`;
- cinco linhas sem data utilizável, no valor de `200.00`;
- as quatro contagens por situação;
- os sete dias e os totais do calendário.

## Conclusão

Datas em campos de texto exigem duas decisões separadas: validar a qualidade da entrada e transformar somente o que cumpre o contrato.

No exemplo, `NULLIF()` e `btrim()` identificam ausências, a expressão regular verifica a estrutura `AAAAMMDD`, `pg_input_is_valid()` confirma que o dia existe e o cast acontece apenas depois dessas etapas. As linhas rejeitadas permanecem mensuráveis.

Com os movimentos válidos tipados, `generate_series()` cria o intervalo do relatório e o `LEFT JOIN` mantém os dias sem faturamento. O zero passa a ter um significado controlado: ausência de movimento válido naquele dia, não ausência de problemas na carga.

O melhor resultado não é apenas uma consulta que termina sem erro. É um relatório cujo total pode ser conciliado e cuja perda de dados, quando existir, fica visível.

## Referências

- [PostgreSQL 16 — funções de informação de entrada](https://www.postgresql.org/docs/16/functions-info.html#FUNCTIONS-INFO-VALIDITY)
- [PostgreSQL 16 — tipos de data e hora](https://www.postgresql.org/docs/16/datatype-datetime.html)
- [PostgreSQL 16 — funções de formatação de data e hora](https://www.postgresql.org/docs/16/functions-formatting.html)
- [PostgreSQL 16 — funções que retornam conjuntos](https://www.postgresql.org/docs/16/functions-srf.html)
