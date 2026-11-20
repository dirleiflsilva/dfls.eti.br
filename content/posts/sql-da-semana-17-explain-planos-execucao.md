---
title: "SQL da Semana #17 — EXPLAIN: começando a ler planos de execução"
date: 2026-11-20
draft: false
toc: true
slug: "sql-da-semana-17-explain-planos-execucao"
description: "Comece a ler planos de execução no PostgreSQL: diferencie custos e tempos, compare linhas estimadas e reais e investigue filtros, buffers e índices."
tags:
  - postgresql
  - sql
  - explain
  - performance
  - indices
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 17
---

Uma consulta retorna os pedidos pendentes. O resultado está correto, mas o tempo de resposta cresce junto com a tabela. Antes de criar um índice, precisamos entender quanto trabalho o PostgreSQL faz para encontrar essas linhas.

O `EXPLAIN` mostra o plano escolhido pelo otimizador: como acessar os dados e quais operações aplicar até produzir o resultado. Aprender a ler esse plano ajuda a transformar uma suspeita de lentidão em perguntas que podemos investigar.

Neste episódio, vamos preparar pedidos sintéticos, observar uma consulta seletiva e comparar o plano antes e depois de um índice. O objetivo é começar por alguns sinais: acesso à tabela, filtros, estimativas de linhas e trabalho observado na execução.

> O [laboratório reproduzível do episódio 17](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao) contém os scripts e os [planos observados](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao/planos-observados.txt) apresentados neste artigo. A validação foi registrada em 15/11/2026 no PostgreSQL 16.14. Os números descrevem aquela execução e podem variar no seu ambiente.

## Preparando o cenário

O exemplo usa uma tabela própria em uma base de estudos, sem acesso a tabelas de ERP. Execute todos os blocos SQL na mesma conexão com um banco PostgreSQL 16 de laboratório.

Vamos abrir uma transação para que, ao final, o `ROLLBACK` desfaça a criação do schema, da tabela e do índice. O nome `sql_semana_17` precisa estar livre nesse banco.

```sql
BEGIN;

CREATE SCHEMA sql_semana_17;

CREATE TABLE sql_semana_17.pedidos (
    pedido_id   integer PRIMARY KEY,
    situacao    text NOT NULL,
    valor_total numeric(12, 2) NOT NULL
);

INSERT INTO sql_semana_17.pedidos
    (pedido_id, situacao, valor_total)
SELECT
    n,
    CASE
        WHEN n % 1000 = 0 THEN 'pendente'
        ELSE 'aprovado'
    END,
    (10 + n % 500)::numeric(12, 2)
FROM generate_series(1, 100000) AS g(n);

ANALYZE sql_semana_17.pedidos;
```

A carga define 100 mil pedidos, dos quais 100 estão pendentes. Podemos conferir essa distribuição:

```sql
SELECT situacao, count(*) AS quantidade
FROM sql_semana_17.pedidos
GROUP BY situacao
ORDER BY situacao;
```

Resultado esperado pela regra de geração:

| Situação | Quantidade |
|---|---:|
| aprovado | 99900 |
| pendente | 100 |

O comando `ANALYZE` coleta estatísticas que ajudam o otimizador a estimar a distribuição dos valores. Ele é diferente da opção `ANALYZE` do `EXPLAIN`, que usaremos para executar e observar uma consulta. Veja a [documentação de ANALYZE](https://www.postgresql.org/docs/16/sql-analyze.html).

## Primeiro, observar sem executar a consulta

```sql
EXPLAIN
SELECT pedido_id, valor_total
FROM sql_semana_17.pedidos
WHERE situacao = 'pendente'
ORDER BY pedido_id;
```

Sem a opção `ANALYZE`, o comando mostra o plano estimado, sem executar esse `SELECT`. O [plano registrado no laboratório](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao/planos-observados.txt) foi:

```text
Sort  (cost=1890.32..1890.57 rows=100 width=9)
  Sort Key: pedido_id
  ->  Seq Scan on pedidos  (cost=0.00..1887.00 rows=100 width=9)
        Filter: (situacao = 'pendente'::text)
```

Nesse desenho, a leitura sequencial da tabela aplica o filtro e entrega os pedidos pendentes ao nó de ordenação. O `Sort` organiza essas linhas por `pedido_id`.

O plano é uma árvore. A indentação mostra quem fornece linhas a quem. Para esse exemplo simples, acompanhar o fluxo do filho para o pai ajuda: leitura e filtro, depois ordenação. A execução pode pedir linhas sob demanda; essa leitura da árvore não significa que todo plano execute cada etapa inteira em uma sequência rígida.

## O que os números estimados dizem

Na linha do `Seq Scan` registrado:

```text
cost=0.00..1887.00 rows=100 width=9
```

Os campos representam:

| Campo | Leitura |
|---|---|
| Primeiro valor de `cost` | Custo estimado até começar a entregar linhas |
| Segundo valor de `cost` | Custo estimado para entregar todas as linhas do nó |
| `rows` | Quantidade estimada de linhas que o nó entrega |
| `width` | Largura média estimada de cada linha de saída, em bytes |

**Custo não é tempo em milissegundos.** É uma unidade do modelo usado pelo otimizador para comparar alternativas. O custo de um nó pai já incorpora o trabalho dos filhos; somar todos os custos do plano conta trabalho mais de uma vez.

Também há uma diferença entre visitar linhas e entregar linhas. No exemplo, `rows=100` representa a saída estimada após o filtro, embora a leitura sequencial precise examinar a tabela inteira. A [documentação sobre leitura de EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html) detalha esses campos.

## Depois, medir uma execução

Agora vamos executar o mesmo `SELECT` e pedir informações adicionais:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT pedido_id, valor_total
FROM sql_semana_17.pedidos
WHERE situacao = 'pendente'
ORDER BY pedido_id;
```

**Com `ANALYZE`, a consulta é executada.** Isso também vale para comandos de escrita e para efeitos de funções chamadas pela consulta. Neste exercício, usamos um `SELECT` simples em dados de laboratório.

Na primeira execução, o trecho do nó de leitura foi:

```text
Seq Scan on pedidos  (cost=0.00..1887.00 rows=100 width=9)
                     (actual time=0.087..5.755 rows=100 loops=1)
  Filter: (situacao = 'pendente'::text)
  Rows Removed by Filter: 99900
  Buffers: shared hit=637
```

Os campos `actual` descrevem o que aconteceu nessa execução. Os dois tempos estão em milissegundos: até a primeira linha e até a conclusão do nó. Compare `rows` estimadas e reais para avaliar a cardinalidade prevista.

Quando um nó executa várias vezes, tempos e linhas são médias por execução. Por exemplo, `rows=10 loops=100` representa aproximadamente mil linhas entregues no conjunto das execuções. Os tempos de pais e filhos também se sobrepõem; somá-los não produz a duração da consulta.

Neste exemplo com `loops=1`, as 99.900 linhas removidas pelo filtro ajudam a explicar o trabalho feito para entregar apenas 100. Isso sugere investigar uma alternativa de acesso para esse predicado.

Uma diferença grande entre linhas estimadas e reais leva a outra pergunta: **o otimizador está trabalhando com uma estimativa adequada?** Estatísticas desatualizadas, distribuição desigual e correlação entre colunas podem afetá-la. O ponto de partida é conferir os dados e as [estatísticas usadas pelo planner](https://www.postgresql.org/docs/16/planner-stats.html).

Mesmo logo após um `ANALYZE`, as estimativas podem variar: a coleta usa uma amostra dos dados quando a tabela é grande o suficiente. Na reprodução de 20/11/2026, por exemplo, o plano estimou 87 pendentes e entregou os mesmos 100 pedidos. Uma diferença assim, isoladamente, não demonstra estatísticas desatualizadas nem exige corrigir o plano.

## O que observar nos buffers

No trecho anterior, `shared hit=637` indica acessos a blocos encontrados no cache compartilhado do PostgreSQL. Se aparecer `shared read`, houve leitura de blocos para esse cache; isso, sozinho, não prova acesso ao disco físico, porque o sistema operacional também pode manter dados em cache.

Buffers representam acessos a blocos, não uma contagem de linhas nem necessariamente de blocos distintos. Os valores do nó pai incluem os filhos. Compare planos sem somar esses totais repetidamente.

Uma segunda execução pode encontrar mais dados em cache e terminar mais rápido. Registre essa condição ao comparar resultados. O comando ainda adiciona instrumentação, e o `Execution Time` não representa a latência completa percebida pelo cliente ao receber todas as linhas. As opções de coleta estão descritas na [referência de EXPLAIN](https://www.postgresql.org/docs/16/sql-explain.html).

## Testando um índice para o filtro

A hipótese é simples: localizar os poucos pedidos pendentes pode exigir menos trabalho do que percorrer todos os pedidos.

```sql
CREATE INDEX pedidos_situacao_idx
    ON sql_semana_17.pedidos (situacao);

EXPLAIN (ANALYZE, BUFFERS)
SELECT pedido_id, valor_total
FROM sql_semana_17.pedidos
WHERE situacao = 'pendente'
ORDER BY pedido_id;
```

No laboratório, a primeira execução depois da criação do índice produziu este plano. O trecho omite as estatísticas de planejamento:

```text
Sort  (cost=14.64..14.89 rows=100 width=9) (actual time=0.154..0.158 rows=100 loops=1)
  Sort Key: pedido_id
  Sort Method: quicksort  Memory: 28kB
  Buffers: shared hit=100 read=2
  ->  Index Scan using pedidos_situacao_idx on pedidos  (cost=0.29..11.32 rows=100 width=9) (actual time=0.019..0.144 rows=100 loops=1)
        Index Cond: (situacao = 'pendente'::text)
        Buffers: shared hit=100 read=2
Execution Time: 0.168 ms
```

O `Index Scan` usou a condição de situação para localizar os pedidos e acessou a tabela para recuperar as colunas solicitadas. O `Sort` continuou presente: o índice somente em `situacao` não garante a ordem por `pedido_id`.

Em outro ambiente, o otimizador também pode combinar `Bitmap Index Scan` e `Bitmap Heap Scan`. Nesse caminho, um bitmap identifica as localizações a visitar na tabela. Essa alternativa não foi a escolhida no registro deste episódio.

Observe também a diferença entre `Index Cond`, usado na busca pelo índice, e `Filter`, aplicado às linhas obtidas pelo nó. Ter um índice no plano não significa que todos os predicados foram resolvidos por ele.

O índice criou uma alternativa, mas sua escolha depende dos dados, das estatísticas e dos custos configurados. **O plano obtido no seu ambiente é a evidência que deve ser analisada.** A documentação sobre [verificação do uso de índices](https://www.postgresql.org/docs/16/indexes-examine.html) reforça a necessidade de experimentar com volume e distribuição representativos.

Para comparar, registre:

| Pergunta | O que conferir antes e depois |
|---|---|
| A consulta continua correta? | Mesmos 100 pedidos e mesma ordenação |
| A estimativa está próxima da execução? | `rows` estimadas e reais nos nós relevantes |
| Como as linhas são encontradas? | Tipo de acesso, `Index Cond` e filtros restantes |
| O trabalho mudou? | Buffers e linhas descartadas |
| Em que condição o tempo foi medido? | Cache, repetições e `Execution Time` |

Uma execução isolada pode sugerir uma hipótese; não demonstra um ganho estável. A própria criação do índice lê a tabela e interfere no estado do cache. Para comparar tempos, preserve as condições e repita as medições antes de atribuir a diferença ao índice.

## Quando quase toda a tabela atende ao filtro

Com o índice ainda presente, investigue o outro valor de situação:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT pedido_id, valor_total
FROM sql_semana_17.pedidos
WHERE situacao = 'aprovado'
ORDER BY pedido_id;
```

Agora o filtro aceita 99.900 das 100 mil linhas. No registro, o PostgreSQL escolheu o índice da chave primária para entregar a ordem solicitada:

```text
Index Scan using pedidos_pkey on pedidos  (cost=0.29..3494.29 rows=99900 width=9) (actual time=0.007..17.291 rows=99900 loops=1)
  Filter: (situacao = 'aprovado'::text)
  Rows Removed by Filter: 100
  Buffers: shared hit=912
Execution Time: 20.105 ms
```

O filtro por situação foi aplicado às linhas obtidas pelo acesso ordenado pela chave primária. O índice de `situacao` estava disponível, mas não foi escolhido. Uma leitura sequencial também pode fazer sentido quando quase toda a tabela é necessária. Neste registro, o otimizador preferiu o acesso pela chave primária, que já entrega a ordem do `ORDER BY` e evita uma ordenação adicional.

Não existe uma regra universal de porcentagem a partir da qual o índice deixa de valer a pena. Tamanho da tabela, distribuição física, cache e colunas retornadas participam da decisão. Nesta massa, os poucos pendentes foram espalhados deliberadamente entre os demais pedidos; concentrá-los fisicamente poderia mudar o acesso às páginas.

O exercício é explicar a escolha observada. Forçar um tipo de acesso logo no início pode esconder justamente o comportamento que estamos tentando compreender.

## Experimentando filtro e ordenação no mesmo índice

O arquivo `04-exercicio.sql` propõe testar um índice em `(situacao, pedido_id)`. A hipótese é que, fixando a situação, o índice também possa entregar os pedidos na ordem solicitada.

O laboratório usa um savepoint para retirar temporariamente o índice simples, criar o composto e executar a consulta. Ao final do desafio, restaura o estado anterior. No registro, apareceu:

```text
Index Scan using pedidos_situacao_pedido_idx on pedidos  (cost=0.42..171.89 rows=100 width=9) (actual time=0.025..0.126 rows=100 loops=1)
  Index Cond: (situacao = 'pendente'::text)
  Buffers: shared hit=100 read=4
Execution Time: 0.170 ms
```

O `Sort` desapareceu. Ainda assim, o tempo registrado não foi menor que o da primeira execução com o índice simples: `0.170 ms` contra `0.168 ms`. São execuções isoladas, com estados de cache diferentes. A evidência confirma a mudança na árvore e a preservação do resultado; não estabelece uma vantagem estável de tempo.

## Reproduzindo o laboratório

Se você executou os blocos SQL do artigo, encerre a transação antes de começar o roteiro completo:

```sql
ROLLBACK;
```

Os [arquivos do episódio 17](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao) dividem o roteiro em cinco etapas:

| Arquivo | Finalidade |
|---|---|
| `01-tabelas.sql` | Abre a transação e cria schema e tabela |
| `02-dados.sql` | Carrega dados, coleta estatísticas e mostra a distribuição |
| `03-consultas.sql` | Observa os planos antes e depois do índice simples |
| `04-exercicio.sql` | Testa o índice composto e restaura o índice simples |
| `05-validacao.sql` | Valida os resultados, executa `ROLLBACK` e verifica a remoção do schema |

Prepare o Compose conforme o [README do laboratório](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao/README.md). Na raiz do repositório, abra o `psql`:

```bash
docker compose exec postgres \
  psql -X -v ON_ERROR_STOP=1 -P pager=off -U postgres -d sql_da_semana
```

Ajuste usuário e banco se personalizou o `.env`. Dentro do `psql`, execute:

```psql
\i /sql-da-semana/17-explain-planos-execucao/01-tabelas.sql
\i /sql-da-semana/17-explain-planos-execucao/02-dados.sql
\i /sql-da-semana/17-explain-planos-execucao/03-consultas.sql
\i /sql-da-semana/17-explain-planos-execucao/04-exercicio.sql
\i /sql-da-semana/17-explain-planos-execucao/05-validacao.sql
```

**Execute os cinco arquivos em ordem, na mesma conexão, sem `COMMIT` entre eles.** Não use `--single-transaction` nem envolva o roteiro em outra transação: os scripts já controlam esse ciclo. Os blocos SQL anteriores explicam o conteúdo do laboratório; para executar os arquivos completos, comece em uma conexão sem a transação desses exemplos aberta e com o schema livre.

O último arquivo desfaz schema, tabela, carga e índices. Se interromper a prática, execute `ROLLBACK` na mesma conexão antes de recomeçar desde o primeiro arquivo. O roteiro falha se o schema já existir e não remove objetos preexistentes.

## Validação e limites dos resultados

O [README publicado](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao/README.md) registra duas execuções completas em **15/11/2026**, ambas com código de saída zero, no **PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1)**.

Na revisão de **20/11/2026**, os cinco scripts desse mesmo commit foram executados novamente, sem alterações, em um contêiner isolado com a mesma versão do PostgreSQL. O roteiro terminou com código de saída **0**, preservou resultados e ordenação e confirmou a remoção do schema após o `ROLLBACK`. Os caminhos de acesso e os buffers do nó raiz coincidiram com o registro publicado; estimativas e tempos variaram. Os planos e números transcritos neste artigo continuam sendo os do registro de 15/11.

A validação compara a massa completa nas duas direções com `EXCEPT ALL`, confere distribuição, valores e ordem dos pendentes antes e depois dos índices, verifica a restauração do desafio e examina `Actual Rows` e `Actual Loops` no plano JSON. Também confirma a ausência do schema após o `ROLLBACK`. Nenhum teste exige um tipo de nó específico ou um limite de tempo.

O registro documenta ainda um teste de falha: alterar o valor do pedido 1000 para `11.00` fez a validação rejeitar a massa divergente, com código de saída **3**. Esse teste também foi reproduzido em 20/11, com o mesmo erro esperado. Após o encerramento da conexão, uma nova conexão confirmou a ausência do schema: a alteração e os objetos haviam sido revertidos.

Os buffers do nó raiz ajudam a comparar o trabalho observado:

| Cenário | Acesso observado | Linhas de saída | Buffers |
|---|---|---:|---|
| Pendentes, antes do índice, primeira execução | `Sort → Seq Scan` | 100 | `shared hit=637` |
| Pendentes, índice simples, primeira execução | `Sort → Index Scan` | 100 | `shared hit=100 read=2` |
| Pendentes, índice simples, repetição | `Sort → Index Scan` | 100 | `shared hit=102` |
| Aprovados, índice simples presente | Chave primária com filtro | 99900 | `shared hit=912` |
| Pendentes, índice composto | `Index Scan` sem `Sort` | 100 | `shared hit=100 read=4` |

A carga, o `ANALYZE` e a criação dos índices já haviam visitado dados. Os resultados não representam cache frio, capacidade sustentada ou uma recomendação de índice para produção. O [registro completo](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao/planos-observados.txt) preserva parâmetros, planos, tempos e mensagens de validação para contextualizar a leitura.

## Um roteiro para as próximas leituras

Ao abrir um plano, comece pela pergunta da consulta e pelo volume que ela deveria devolver. Depois acompanhe os acessos às tabelas, os filtros e as operações que levam ao resultado.

Compare estimativas com linhas reais, observe repetições e procure onde há trabalho para produzir poucas linhas úteis. Só então formule uma mudança e compare novamente, preservando a correção do resultado.

No [Lab 07 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-07-performance/), essa investigação aparece em um fluxo maior, com consultas, índices e medições. Aqui, o primeiro passo é aprender a relacionar cada escolha do plano ao trabalho que ela exige.

## Referências

- [Laboratório do episódio 17: scripts e documentação](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao)
- [Planos observados e mensagens de validação](https://github.com/dirleiflsilva/sql-da-semana-postgresql/blob/2b9d078389dc2d22e8c9aa72392ef9ab8af3c0c8/episodios/17-explain-planos-execucao/planos-observados.txt)
- [PostgreSQL 16: Using EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html)
- [PostgreSQL 16: EXPLAIN — opções e interpretação](https://www.postgresql.org/docs/16/sql-explain.html)
- [PostgreSQL 16: Statistics Used by the Planner](https://www.postgresql.org/docs/16/planner-stats.html)
- [PostgreSQL 16: Examining Index Usage](https://www.postgresql.org/docs/16/indexes-examine.html)
- [PostgreSQL 16: ANALYZE](https://www.postgresql.org/docs/16/sql-analyze.html)
