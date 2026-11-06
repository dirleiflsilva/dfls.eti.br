---
title: "SQL da Semana #15 — Exclusão lógica e filial: consultas sobre um modelo inspirado no Protheus"
date: 2026-11-06
draft: false
toc: true
slug: "sql-da-semana-15-exclusao-logica-filial-modelo-protheus"
description: "Veja como exclusão lógica, chaves por filial e cadastros compartilhados afetam joins e totais no PostgreSQL, usando um modelo sintético inspirado no Protheus."
tags:
  - postgresql
  - sql
  - protheus
  - exclusao-logica
  - filial
  - joins
  - sql-da-semana
topics:
  - PostgreSQL e SQL
  - Protheus e AdvPL
series:
  - SQL da Semana
series_order: 15
---

Uma consulta pode executar sem erro e produzir um total incorreto. Em um modelo com exclusão lógica e separação por filial, isso acontece quando ela soma itens desconsiderados pela aplicação ou combina documentos de filiais diferentes.

Até aqui, a série explorou recursos do SQL. Neste episódio, o foco está no contrato dos dados: **quais registros participam da consulta e quais campos identificam um relacionamento?**

Vamos usar cabeçalhos, itens e um cadastro compartilhado para mostrar como essas decisões mudam o resultado de um relatório.

> Este exemplo usa dados sintéticos e estruturas próprias no PostgreSQL. Ele não reproduz o dicionário completo nem as regras de negócio do Protheus.

> O [laboratório reproduzível do episódio 15](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/15-exclusao-logica-filial) contém os scripts de criação, carga, consultas, exercício e validação automatizada. A [versão de referência](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/55c0f403dc871fc39e4337e9e796eaaa8b8ed71b/episodios/15-exclusao-logica-filial) registra duas execuções completas no PostgreSQL 16.14, com 22 verificações aprovadas em 02/11/2026.

## O contrato do exemplo

No [artigo sobre PostgreSQL no Protheus](/posts/postgresql-no-protheus-arquitetura-possibilidades-limitacoes/), separamos o banco transacional do ERP de uma base própria de integração. Aqui usamos uma base própria apenas para estudar a semântica das consultas.

Adotaremos estas regras:

| Estrutura | Escopo | Identificação de negócio |
|---|---|---|
| Cabeçalhos | Exclusivos por filial | filial + número |
| Itens | Exclusivos por filial | filial + número + item |
| Produtos | Compartilhados entre as duas filiais do exemplo | filial de cadastro em branco + código |

O campo `d_e_l_e_t_` recebe um espaço (`' '`) para registros ativos e um asterisco (`'*'`) para excluídos logicamente. O marcador não remove fisicamente a linha; a consulta precisa declarar se ela participa do resultado.

O campo `r_e_c_n_o_` será apenas um identificador técnico de cada linha. Ele não relaciona cabeçalhos e itens nem informa quando um registro foi alterado.

Também assumimos um único contexto de empresa. Duas filiais com os códigos `01` e `02` são suficientes para o experimento; esses tamanhos e essa organização não são um contrato para ambientes reais.

## Preparando a massa sintética

Execute a preparação em um banco de estudos. O schema próprio mantém os objetos do episódio identificados e precisa ainda não existir para executar o bloco abaixo.

```sql
CREATE SCHEMA sql_semana_15;

CREATE TABLE sql_semana_15.pedidos (
    r_e_c_n_o_ bigint PRIMARY KEY,
    filial text NOT NULL CHECK (filial IN ('01', '02')),
    numero text NOT NULL,
    d_e_l_e_t_ text NOT NULL CHECK (d_e_l_e_t_ IN (' ', '*')),
    UNIQUE (filial, numero)
);

CREATE TABLE sql_semana_15.itens (
    r_e_c_n_o_ bigint PRIMARY KEY,
    filial text NOT NULL CHECK (filial IN ('01', '02')),
    numero text NOT NULL,
    item text NOT NULL,
    produto text NOT NULL,
    valor numeric(12, 2) NOT NULL,
    d_e_l_e_t_ text NOT NULL CHECK (d_e_l_e_t_ IN (' ', '*')),
    UNIQUE (filial, numero, item)
);

CREATE TABLE sql_semana_15.produtos (
    r_e_c_n_o_ bigint PRIMARY KEY,
    filial text NOT NULL CHECK (filial = '  '),
    codigo text NOT NULL,
    descricao text NOT NULL,
    d_e_l_e_t_ text NOT NULL CHECK (d_e_l_e_t_ IN (' ', '*')),
    UNIQUE (filial, codigo)
);

INSERT INTO sql_semana_15.pedidos VALUES
    (1, '01', '100', ' '),
    (2, '02', '100', ' '),
    (3, '01', '101', '*'),
    (4, '01', '102', ' '),
    (5, '01', '103', ' ');

INSERT INTO sql_semana_15.itens VALUES
    (11, '01', '100', '01', 'P01', 100.00, ' '),
    (12, '01', '100', '02', 'P02',  50.00, '*'),
    (13, '02', '100', '01', 'P01', 900.00, ' '),
    (14, '01', '101', '01', 'P01', 300.00, ' '),
    (15, '01', '103', '01', 'P01',  70.00, '*');

INSERT INTO sql_semana_15.produtos VALUES
    (21, '  ', 'P01', 'Produto A', ' '),
    (22, '  ', 'P02', 'Produto B', ' ');
```

Usamos `text` para deixar explícito o conteúdo armazenado. Nessa massa, `' '`, `''` e `NULL` são valores distintos. O marcador de ativo contém exatamente um espaço; a filial compartilhada dos produtos contém dois. Não substitua um pelo outro apenas porque ambos parecem vazios na tela.

Essas constraints simplificam o exercício. Elas não reproduzem a composição dos índices físicos do ERP nem o tratamento de chaves de registros excluídos.

## Exclusão lógica precisa ser considerada em cada tabela

Vamos listar os itens ativos de pedidos ativos da filial `01`:

```sql
SELECT p.filial, p.numero, i.item, i.produto, i.valor
FROM sql_semana_15.pedidos AS p
JOIN sql_semana_15.itens AS i
  ON i.filial = p.filial
 AND i.numero = p.numero
 AND i.d_e_l_e_t_ = ' '
WHERE p.filial = '01'
  AND p.d_e_l_e_t_ = ' '
ORDER BY p.numero, i.item;
```

Resultado esperado:

| Filial | Pedido | Item | Produto | Valor |
|---|---|---|---|---:|
| 01 | 100 | 01 | P01 | 100.00 |

O filtro do cabeçalho não filtra automaticamente os itens. Se retirarmos apenas `i.d_e_l_e_t_ = ' '`, a listagem também trará os itens excluídos dos pedidos `100` e `103`. Ao somar os valores por pedido, obteremos `150.00` para o `100` e `70.00` para o `103`.

Se mantivermos o filtro dos itens, mas retirarmos o filtro de exclusão do cabeçalho, o pedido `101` aparecerá com `300.00`. Seu item está ativo na massa, mas o cabeçalho está excluído.

A pergunta de negócio é sobre pedidos ativos com itens ativos. Cada alias tem uma condição própria para cumprir essa regra.

## Filtrar a filial do cabeçalho não completa o join

Esta consulta parece próxima da anterior, mas omite a filial no relacionamento:

```sql
-- Exemplo incorreto para o contrato deste modelo.
SELECT p.filial, p.numero, sum(i.valor) AS total
FROM sql_semana_15.pedidos AS p
JOIN sql_semana_15.itens AS i
  ON i.numero = p.numero
 AND i.d_e_l_e_t_ = ' '
WHERE p.filial = '01'
  AND p.d_e_l_e_t_ = ' '
GROUP BY p.filial, p.numero;
```

O pedido `100` da filial `01` encontra o item de `100.00` da própria filial e o item de `900.00` da filial `02`. O total esperado dessa consulta incorreta é `1000.00`.

O `WHERE` restringiu `p.filial`. Nada nessa condição impediu que `i` trouxesse linhas de outra filial.

Para esse relacionamento, a chave é `(filial, numero)`. Usar `DISTINCT` não recupera a associação correta entre cabeçalho e item. A correção é incluir `i.filial = p.filial` no `ON`.

## Cadastro compartilhado tem outro escopo

Agora queremos buscar a descrição do produto. Como os produtos são compartilhados, sua filial de cadastro está em branco no contrato deste exemplo.

```sql
WITH contexto AS (
    SELECT '01'::text AS filial_movimento,
           '  '::text AS filial_produto
)
SELECT
    p.filial,
    p.numero,
    i.item,
    i.produto,
    pr.descricao,
    i.valor
FROM contexto AS c
JOIN sql_semana_15.pedidos AS p
  ON p.filial = c.filial_movimento
 AND p.d_e_l_e_t_ = ' '
JOIN sql_semana_15.itens AS i
  ON i.filial = p.filial
 AND i.numero = p.numero
 AND i.d_e_l_e_t_ = ' '
LEFT JOIN sql_semana_15.produtos AS pr
  ON pr.filial = c.filial_produto
 AND pr.codigo = i.produto
 AND pr.d_e_l_e_t_ = ' '
ORDER BY p.numero, i.item;
```

A linha esperada é o item `01` do pedido `100`, com descrição `Produto A` e valor `100.00`.

Se usarmos `pr.filial = p.filial`, a descrição ficará `NULL`: os dois campos representam escopos diferentes. Com `INNER JOIN`, a linha inteira desapareceria.

O `LEFT JOIN` foi escolhido para preservar o item quando o cadastro ativo não for encontrado. Nesse caso, a descrição ausente deve ser investigada; ela não comprova sozinha que o produto nunca existiu.

A [documentação da TOTVS sobre compartilhamento](https://centraldeatendimento.totvs.com/hc/pt-br/articles/36493197448599-Cross-Segmentos-TOTVS-CRM-Automa%C3%A7%C3%A3o-de-For%C3%A7a-de-Vendas-SFA-WEB-Integra%C3%A7%C3%A3o-Verificar-Filiais-Empresas-Unidade-compartilhadas-no-Protheus) mostra que a configuração pode envolver empresa, unidade e filial. No ambiente real, o escopo precisa ser resolvido por tabela conforme o dicionário e o contexto da aplicação.

Por isso, `filial_produto` é um parâmetro explícito do nosso modelo, não uma regra para codificar dois espaços em qualquer consulta. Também não usamos `filial IN ('01', '  ')`: misturar escopos sem um contrato pode encontrar mais de um cadastro para o mesmo código e multiplicar as linhas.

## Preservando pedidos sem itens ativos

O relatório agora precisa mostrar todos os pedidos ativos da filial `01`, inclusive os que não possuem itens ativos:

```sql
SELECT
    p.filial,
    p.numero,
    count(i.r_e_c_n_o_) AS itens_ativos,
    coalesce(sum(i.valor), 0.00::numeric) AS total
FROM sql_semana_15.pedidos AS p
LEFT JOIN sql_semana_15.itens AS i
  ON i.filial = p.filial
 AND i.numero = p.numero
 AND i.d_e_l_e_t_ = ' '
WHERE p.filial = '01'
  AND p.d_e_l_e_t_ = ' '
GROUP BY p.filial, p.numero
ORDER BY p.numero;
```

Resultado esperado:

| Filial | Pedido | Itens ativos | Total |
|---|---|---:|---:|
| 01 | 100 | 1 | 100.00 |
| 01 | 102 | 0 | 0.00 |
| 01 | 103 | 0 | 0.00 |

O pedido `102` não tem itens. O `103` tem apenas um item excluído. Para esse relatório, ambos possuem zero itens ativos.

O filtro `i.d_e_l_e_t_ = ' '` fica no `ON` para definir quais itens podem corresponder a cada pedido. Se ele for movido para o `WHERE`, o pedido `102` será descartado porque a linha sem correspondência terá esse campo como `NULL`. O `103` também desaparecerá: seu item encontrará correspondência pela chave, mas será rejeitado pelo marcador `'*'`. O `WHERE` não cria outra linha para preservar o cabeçalho depois disso. A [documentação de joins do PostgreSQL](https://www.postgresql.org/docs/16/queries-table-expressions.html#QUERIES-JOIN) explica essa diferença entre restringir o relacionamento e filtrar o resultado de um outer join.

Usamos `count(i.r_e_c_n_o_)` porque essa coluna é não nula nas linhas reais dos itens. `count(*)` contaria também a linha preservada pelo `LEFT JOIN`, produzindo `1` para pedidos sem correspondência.

## O que conferir antes de adaptar a consulta

Uma consulta sobre dados reais exige confirmar:

- o contexto de empresa e o compartilhamento de cada tabela;
- a chave completa de cada relacionamento, incluindo loja, série ou outros componentes quando aplicáveis;
- o conteúdo e o tipo dos campos usados como marcadores;
- se o relatório deve preservar linhas sem cadastro ou sem movimentos ativos;
- as contagens e os totais antes e depois dos joins.

Essa massa pequena permite observar erros de resultado. Ela não sustenta conclusões sobre desempenho, índices, autovacuum ou capacidade de uma base real.

O filtro de filial também não substitui controles de acesso. Ele faz parte da semântica deste relatório; autorização continua sendo uma responsabilidade própria do sistema.

## Desafio

Adapte a última consulta para mostrar os pedidos ativos das duas filiais, mantendo a separação por `(filial, numero)`.

O resultado esperado inclui o pedido `100` da filial `02`, com um item ativo e total de `900.00`, além das três linhas da filial `01`. O total geral deve ser `1000.00`, distribuído entre quatro cabeçalhos ativos.

Depois, retire apenas `i.filial = p.filial` do `ON`, mantendo o agrupamento por `(p.filial, p.numero)`. Os dois pedidos `100` passarão a encontrar os mesmos dois itens ativos: cada um terá contagem `2` e total `1000.00`. Os pedidos `102` e `103` continuarão zerados. O total geral incorreto será `2000.00`.

A quantidade de cabeçalhos continuará sendo quatro. Por isso, conferir apenas o número de linhas do relatório não detecta essa regressão: é preciso comparar também as chaves, as contagens de itens e os valores de cada pedido.

## Conclusão

Exclusão lógica define quais linhas participam do relatório. A chave completa define como elas se relacionam. O compartilhamento define em qual escopo buscar cada cadastro.

No exemplo, essas regras evitaram somar itens excluídos, combinar pedidos de filiais diferentes e perder descrições de um cadastro compartilhado. O `LEFT JOIN`, com os filtros no lugar adequado, também preservou os pedidos sem itens ativos.

Antes de investigar o custo da consulta, precisamos conseguir explicar e conciliar o resultado que ela produz.

## Referências

- [TOTVS — Verificar filiais, empresas e unidades compartilhadas no Protheus](https://centraldeatendimento.totvs.com/hc/pt-br/articles/36493197448599-Cross-Segmentos-TOTVS-CRM-Automa%C3%A7%C3%A3o-de-For%C3%A7a-de-Vendas-SFA-WEB-Integra%C3%A7%C3%A3o-Verificar-Filiais-Empresas-Unidade-compartilhadas-no-Protheus)
- [TOTVS — Exemplos de consultas AdvPL/TL++ com filial e exclusão lógica](https://github.com/totvs/engpro-advpl-tlpp-skills/blob/main/skills/advpl-tlpp/query-builder/references/query-patterns-and-examples.md)
- [PostgreSQL 16 — Expressões de tabela e joins](https://www.postgresql.org/docs/16/queries-table-expressions.html)
- [PostgreSQL 16 — Funções de agregação](https://www.postgresql.org/docs/16/functions-aggregate.html)
