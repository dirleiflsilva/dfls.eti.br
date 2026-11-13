---
title: "SQL da Semana #16 — Recursive CTE: explorando uma estrutura de produtos"
date: 2026-11-13
draft: false
toc: true
slug: "sql-da-semana-16-recursive-cte-estrutura-produtos"
description: "Explore uma estrutura de produtos com WITH RECURSIVE no PostgreSQL, calcule quantidades por caminho e detecte ciclos antes de consolidar os componentes."
tags:
  - postgresql
  - sql
  - recursive-cte
  - estrutura-de-produtos
  - hierarquia
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 16
---

Um kit contém módulos e peças. Cada módulo também possui componentes, e uma mesma peça pode aparecer diretamente no kit e dentro de um módulo. Como descobrir tudo que será necessário para montar uma unidade do produto final?

Um `JOIN` encontra os componentes do primeiro nível. Acrescentar outro `JOIN` alcança o segundo, mas exige conhecer antecipadamente a profundidade da estrutura.

Com `WITH RECURSIVE`, podemos partir de um produto e repetir a busca enquanto houver componentes a explorar. Neste episódio, vamos preservar cada caminho, multiplicar suas quantidades e identificar uma referência circular introduzida na massa de teste.

> O exemplo usa tabelas próprias e dados sintéticos de uma base de estudos. Não reproduz o cadastro de estruturas, as revisões nem as regras de produção do Protheus. Os resultados foram reproduzidos no PostgreSQL 16.14, com 18 verificações automatizadas aprovadas em 13/11/2026.

## O contrato da estrutura

No [episódio #05](/posts/sql-da-semana-05-cte-postgresql/), usamos CTEs para organizar consultas. Agora, uma CTE fará referência ao próprio resultado para percorrer os relacionamentos entre produtos.

Vamos adotar estas regras:

- cada relacionamento informa quanto de um componente é necessário para uma unidade do produto pai;
- as quantidades usam a mesma unidade de contagem do respectivo componente;
- uma peça pode participar de mais de um caminho;
- um produto sem componentes cadastrados é considerado uma folha;
- a estrutura válida não pode retornar a um produto já encontrado no mesmo caminho.

O modelo não considera filial, vigência, revisão, perdas ou conversão de unidades. Esses dados alterariam tanto as chaves quanto o cálculo em um cenário real.

## Preparando os dados

Execute em um banco de estudos, com o schema `sql_semana_16` ainda inexistente:

```sql
CREATE SCHEMA sql_semana_16;

CREATE TABLE sql_semana_16.produtos (
    codigo text PRIMARY KEY,
    descricao text NOT NULL
);

CREATE TABLE sql_semana_16.estrutura (
    produto_pai text NOT NULL REFERENCES sql_semana_16.produtos (codigo),
    componente text NOT NULL REFERENCES sql_semana_16.produtos (codigo),
    quantidade numeric NOT NULL CHECK (quantidade > 0),
    PRIMARY KEY (produto_pai, componente),
    CHECK (produto_pai <> componente)
);

INSERT INTO sql_semana_16.produtos VALUES
    ('KIT', 'Kit de montagem'),
    ('MOD', 'Módulo montado'),
    ('P01', 'Parafuso'),
    ('P02', 'Arruela');

INSERT INTO sql_semana_16.estrutura VALUES
    ('KIT', 'MOD', 2),
    ('KIT', 'P01', 4),
    ('MOD', 'P01', 3),
    ('MOD', 'P02', 6);
```

Para montar um kit, precisamos de dois módulos e quatro parafusos avulsos. Cada módulo exige três parafusos e seis arruelas.

As chaves estrangeiras garantem que os produtos existem. O `CHECK` impede uma ligação direta como `KIT → KIT`, mas não impede um ciclo com vários relacionamentos. Precisaremos tratar essa possibilidade durante a navegação.

## Percorrendo os níveis com WITH RECURSIVE

Vamos incluir o próprio produto inicial, com quantidade um e nível zero:

```sql
WITH RECURSIVE explosao (produto, nivel, quantidade_acumulada) AS (
    -- Ponto de partida: uma unidade do kit.
    SELECT codigo, 0, 1::numeric
    FROM sql_semana_16.produtos
    WHERE codigo = 'KIT'

    UNION ALL

    -- Expande os componentes encontrados na etapa anterior.
    SELECT
        e.componente,
        x.nivel + 1,
        x.quantidade_acumulada * e.quantidade
    FROM explosao AS x
    JOIN sql_semana_16.estrutura AS e
      ON e.produto_pai = x.produto
)
CYCLE produto SET ciclo USING caminho
SELECT
    produto,
    nivel,
    quantidade_acumulada,
    ciclo,
    caminho
FROM explosao
ORDER BY caminho;
```

O termo inicial encontra o `KIT`. O termo recursivo usa os produtos da etapa anterior como pais da próxima busca. Para cada relacionamento, a quantidade acumulada é multiplicada pela quantidade local.

A avaliação continua até que uma etapa não produza novas linhas. Embora a sintaxe seja recursiva, o PostgreSQL executa esse processo de forma iterativa, conforme a [documentação de consultas recursivas](https://www.postgresql.org/docs/16/queries-with.html#QUERIES-WITH-RECURSIVE).

Resultado observado, com o caminho representado por setas para facilitar a leitura:

| Produto | Nível | Quantidade acumulada | Ciclo | Caminho |
|---|---:|---:|---|---|
| KIT | 0 | 1 | false | KIT |
| MOD | 1 | 2 | false | KIT → MOD |
| P01 | 2 | 6 | false | KIT → MOD → P01 |
| P02 | 2 | 12 | false | KIT → MOD → P02 |
| P01 | 1 | 4 | false | KIT → P01 |

Na saída do PostgreSQL, `caminho` é um array de registros gerado por `CYCLE`. A coluna ajuda a inspecionar o percurso e a ordenar a apresentação. O `ORDER BY` final não determina a ordem interna de execução da recursão.

## A mesma peça pode aparecer mais de uma vez

O parafuso `P01` aparece em dois caminhos válidos:

- diretamente no kit: quatro unidades;
- dentro dos módulos: dois módulos multiplicados por três parafusos, totalizando seis unidades.

A necessidade total é de dez parafusos. Eliminar a repetição pelo código do produto antes de somar perderia uma dessas contribuições.

Por isso, usamos `UNION ALL`: queremos preservar os caminhos. Trocar por `UNION` também não é uma proteção geral contra ciclos. Como nível e quantidade podem mudar a cada passagem, as linhas não serão necessariamente iguais e a eliminação de duplicatas pode não interromper a recursão.

O ciclo é uma repetição **dentro de um caminho**. Encontrar `P01` por outro ramo da estrutura é uma situação diferente e válida neste modelo.

## Consolidando somente as folhas

Para uma lista de componentes finais, vamos considerar folhas os produtos que não possuem componentes próprios. Execute novamente a mesma CTE, mantendo a cláusula `CYCLE`, e substitua apenas o `SELECT` final por:

```sql
SELECT
    x.produto,
    p.descricao,
    sum(x.quantidade_acumulada) AS quantidade_necessaria
FROM explosao AS x
JOIN sql_semana_16.produtos AS p
  ON p.codigo = x.produto
WHERE x.nivel > 0
  AND NOT x.ciclo
  AND NOT EXISTS (
      SELECT 1
      FROM explosao AS diagnostico
      WHERE diagnostico.ciclo
  )
  AND NOT EXISTS (
      SELECT 1
      FROM sql_semana_16.estrutura AS e
      WHERE e.produto_pai = x.produto
  )
GROUP BY x.produto, p.descricao
ORDER BY x.produto;
```

Resultado observado:

| Produto | Descrição | Quantidade necessária |
|---|---|---:|
| P01 | Parafuso | 10 |
| P02 | Arruela | 12 |

O módulo não aparece porque possui componentes próprios. Seus multiplicadores já participam das quantidades das folhas.

A primeira subconsulta com `NOT EXISTS` bloqueia a consolidação se qualquer caminho alcançável a partir do kit contiver um ciclo. Apenas descartar as linhas marcadas como cíclicas permitiria apresentar totais parciais como se fossem válidos.

Nesse contrato, ausência de linhas na consolidação exige diagnóstico: pode significar ciclo, produto inicial inexistente ou ausência de componentes abaixo da raiz. Uma aplicação deve distinguir esses estados antes de apresentar a lista ao usuário.

## Introduzindo e identificando um ciclo

A cláusula `CYCLE produto SET ciclo USING caminho` acrescenta as colunas `ciclo` e `caminho` ao resultado. Quando o produto se repete no percurso, a linha recebe a marca de ciclo e aquele ramo deixa de ser expandido. A [documentação de detecção de ciclos](https://www.postgresql.org/docs/16/queries-with.html#QUERIES-WITH-CYCLE) detalha esse comportamento.

Podemos observar isso sem manter a alteração na massa original. Na mesma sessão, abra uma transação e insira uma referência do componente para o kit:

```sql
BEGIN;

INSERT INTO sql_semana_16.estrutura VALUES ('P02', 'KIT', 1);
```

Antes de encerrar a transação, execute a CTE completa novamente. Ela deve mostrar seis linhas, incluindo este fechamento de caminho:

| Produto | Nível | Quantidade acumulada | Ciclo | Caminho |
|---|---:|---:|---|---|
| KIT | 3 | 12 | true | KIT → MOD → P02 → KIT |

Para listar somente os problemas, substitua o `SELECT` final da CTE por:

```sql
SELECT produto, nivel, quantidade_acumulada, caminho
FROM explosao
WHERE ciclo
ORDER BY caminho;
```

Ainda dentro da transação, a consulta de consolidação deve retornar zero linhas. O caminho circular precisa ser corrigido antes de calcular uma necessidade válida.

Ao terminar a observação, desfaça a referência circular:

```sql
ROLLBACK;
```

As constraints aceitaram o ciclo indireto porque cada relacionamento isolado respeita as regras da tabela. `CYCLE` protege essa consulta contra a expansão infinita; ele não cria uma restrição de integridade para impedir a gravação.

## Limites da navegação

A proteção contra ciclos considera apenas os caminhos alcançados a partir da raiz escolhida. Consultar o `KIT` não valida automaticamente todas as estruturas cadastradas.

Além disso, uma estrutura sem ciclos pode ter muitos caminhos. A consulta preserva cada um para calcular as quantidades, e a combinação de profundidade e ramificações pode produzir um resultado intermediário grande.

Definir uma profundidade máxima pode ser útil para diagnóstico, mas cortar a expansão altera o resultado. Se a consulta parar antes das folhas, os totais deixam de representar a estrutura completa. Um limite operacional precisa vir acompanhado de uma indicação explícita de truncamento.

Esta massa pequena serve para conferir a semântica. Ela não permite concluir sobre tempo de execução, consumo de memória ou dimensionamento de uma estrutura real.

## Desafio

Depois do `ROLLBACK`, adicione uma necessidade direta de três arruelas ao kit:

```sql
INSERT INTO sql_semana_16.estrutura VALUES ('KIT', 'P02', 3);
```

Execute a expansão e a consolidação novamente. A expectativa é encontrar seis linhas na expansão, nenhuma marca de ciclo e estes totais nas folhas:

- `P01`: dez unidades;
- `P02`: quinze unidades, sendo doze pelos módulos e três diretamente pelo kit.

Depois, adapte o ponto de partida para três unidades do `KIT`. Os totais devem passar para trinta parafusos e quarenta e cinco arruelas. O número de caminhos permanece o mesmo; o que muda é o multiplicador inicial.

## Fechando a estrutura

Uma CTE recursiva permite explorar uma quantidade variável de níveis. Para calcular componentes, precisamos preservar os caminhos, multiplicar as quantidades em cada ligação e consolidar somente depois de verificar a estrutura.

Neste exemplo, o parafuso compartilhado por dois ramos participa duas vezes do cálculo. Já o retorno ao kit no mesmo caminho sinaliza um ciclo e bloqueia a lista final. Essa distinção é o que torna a navegação útil para explicar e conferir o resultado.

## Laboratório e validação

O [laboratório do episódio 16 no GitHub](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/16-recursive-cte-estrutura-produtos) reúne os scripts de criação das tabelas, carga, consultas, desafio com solução e validação automatizada. O README descreve a execução com Docker Compose e PostgreSQL 16.

O roteiro completo foi executado novamente em **13/11/2026**, no **PostgreSQL 16.14**, com interrupção no primeiro erro (`ON_ERROR_STOP=1`). A execução terminou com código **0** e **18 verificações aprovadas**, cobrindo caminhos completos, quantidades, ciclos, restauração dos dados, raiz inexistente e raiz sem componentes. Os resultados apresentados neste artigo foram confirmados nessa execução.

## Referências

- [PostgreSQL 16 — Consultas recursivas com WITH](https://www.postgresql.org/docs/16/queries-with.html#QUERIES-WITH-RECURSIVE)
- [PostgreSQL 16 — Ordenação da busca](https://www.postgresql.org/docs/16/queries-with.html#QUERIES-WITH-SEARCH)
- [PostgreSQL 16 — Detecção de ciclos](https://www.postgresql.org/docs/16/queries-with.html#QUERIES-WITH-CYCLE)
