---
title: "Investigando performance no PostgreSQL"
date: 2026-11-02
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-07-performance"
description: "Investigando consultas no PostgreSQL com EXPLAIN, pg_stat_statements e pgbench: índices, filtros por data e evidências de antes e depois no Lab 07."
tags:
  - postgresql
  - performance
  - sql
  - indices
  - explain
  - pg-stat-statements
  - pgbench
  - dbre
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
series:
  - PostgreSQL Reliability Lab
series_order: 7
---

No [Lab 06 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-06-observabilidade/), acrescentei métricas, logs e dashboards ao cluster. Com a coleta validada, a próxima etapa foi investigar o trabalho executado pelas consultas.

> Como demonstrar que uma alteração melhora uma consulta, preserva o resultado e compensa o custo que acrescenta ao banco?

O [Lab 07 está disponível no GitHub](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/5fd5efb/labs/07-performance). Ele compara consultas antes e depois de alterações em índices e filtros, usando dados reproduzíveis, planos de execução, estatísticas e carga com `pgbench`.

Na validação publicada, o filtro diário passou de uma mediana de **12,157 ms para 0,150 ms**, e o índice parcial reduziu o trabalho da consulta de pedidos pendentes. Já o índice composto de histórico não apresentou benefício relevante no perfil testado.

Esse último resultado ajuda a definir o propósito do experimento: testar uma hipótese também pode levar à decisão de não manter um índice.

## A massa de dados faz parte da investigação

Os primeiros labs usavam 100 clientes e 500 pedidos. Essa base atendia aos testes de inicialização, recuperação e replicação, mas deixava pouco trabalho para comparar alternativas de acesso aos dados.

O Lab 07 oferece dois perfis:

| Perfil | Clientes | Pedidos |
|---|---:|---:|
| `small` | 10.000 | 100.000 |
| `standard` | 100.000 | 1.000.000 |

A validação publicada utilizou somente `small`. Os pedidos têm uma distribuição controlada: 80% pagos, 10% pendentes e 10% cancelados. Além disso, 60% dos pedidos pertencem aos primeiros 10% dos clientes.

Essa concentração permite comparar o histórico de um cliente com mais pedidos ao de outro com menos registros. Ainda assim, trata-se de uma massa didática de e-commerce, com correlações entre campos. Ela não representa um workload Protheus validado nem reproduz estatisticamente o tráfego de uma aplicação real.

A geração usa semente, fórmulas inteiras e data de referência fixa. No registro publicado, a semente foi `42` e a referência, `2026-11-01T00:00:00+00:00`. Isso permite reconstruir os dados sem depender do instante da execução.

Após a carga, o gerador valida os registros, executa `ANALYZE` e espera a réplica alcançar o WAL gerado. Só então marca o dataset como pronto para os experimentos.

## Um ambiente próprio para o Lab 07

O laboratório mantém a arquitetura de PostgreSQL 16 com Patroni, etcd, HAProxy e a stack de observabilidade do Lab 06. Seus 13 containers, rede e volumes pertencem ao projeto Compose `pgrl-lab07`.

Os dados dos labs anteriores não são reutilizados. O bootstrap cria a estrutura sem clientes ou pedidos; a geração da massa é uma etapa explícita.

Com Linux, Docker Compose, Bash e Python 3 disponíveis:

```bash
git clone https://github.com/dirleiflsilva/postgresql-reliability-lab.git
cd postgresql-reliability-lab/labs/07-performance
cp .env.example .env
```

Substitua as senhas de exemplo no `.env`. Em seguida:

```bash
mkdir -p evidence/runs
docker compose config --quiet
docker compose build
docker compose up -d --wait --wait-timeout 300
bash scripts/check.sh
bash scripts/generate_data.sh small
bash scripts/check.sh
```

O primeiro check valida o ambiente vazio. O segundo verifica também a massa carregada. A geração rejeita uma segunda carga sobre dados existentes, evitando alterar silenciosamente o conjunto usado na comparação.

O endpoint PostgreSQL via HAProxy fica, por padrão, em `127.0.0.1:5441`. Grafana, Prometheus e Loki usam respectivamente as portas `3001`, `9091` e `3101`, também em loopback. O ambiente precisa de recursos para os 13 containers; o Compose não impõe limites de CPU ou memória.

## Três fontes de evidência

A investigação combina ferramentas que respondem a perguntas diferentes:

| Ferramenta | Pergunta principal |
|---|---|
| `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)` | Como a consulta foi executada e quanto trabalho apareceu no plano? |
| `pg_stat_statements` | Que atividade acumulada foi registrada durante a janela? |
| `pgbench` com scripts próprios | Que latências e throughput foram observados com clientes concorrentes? |

`EXPLAIN ANALYZE` executa e instrumenta a consulta. Seus tempos descrevem a execução no servidor e incluem o custo da instrumentação. Os custos estimados do planner, por sua vez, não são tempos em milissegundos. Essas distinções são detalhadas na [documentação de EXPLAIN do PostgreSQL 16](https://www.postgresql.org/docs/16/using-explain.html).

O `pgbench` mede pela perspectiva do cliente, incluindo a comunicação. O lab usa arquivos SQL próprios, sem inicializar as tabelas do benchmark padrão. O modo de consulta é `simple`, com parâmetros fixos; planos genéricos de prepared statements ficam fora deste experimento. A [documentação do pgbench](https://www.postgresql.org/docs/16/pgbench.html) descreve o uso de scripts customizados.

Já o `pg_stat_statements` reúne contadores e estatísticas agregadas. Ele ajuda a observar chamadas, tempo acumulado e buffers, mas não fornece as amostras individuais necessárias para calcular p95. No lab, os percentis de latência do cliente vêm dos logs por transação do `pgbench`. Os campos agregados da extensão estão descritos na [documentação de pg_stat_statements](https://www.postgresql.org/docs/16/pgstatstatements.html).

## Quatro casos, com hipóteses explícitas

O benchmark compara quatro casos:

| Caso | Hipótese testada |
|---|---|
| `history_hot` | Um índice composto pode ajudar a buscar os últimos pedidos do cliente 1 |
| `history_cold` | O mesmo índice pode ter outro efeito para o último cliente da massa |
| `pending` | Um índice parcial pode ajudar a selecionar os primeiros pedidos pendentes |
| `daily` | Um intervalo sobre o timestamp pode aproveitar melhor o índice de data existente |

O baseline já possui chaves primárias, unicidade e índices individuais de cliente e data. A comparação parte dessa estrutura, em vez de remover todos os índices para produzir um cenário artificialmente ruim.

Os candidatos acrescentados são:

```sql
CREATE INDEX perf_orders_history
    ON app.orders (customer_id, ordered_at DESC, order_id DESC);

CREATE INDEX perf_orders_pending
    ON app.orders (ordered_at, order_id)
    WHERE status = 'pending';
```

O primeiro combina o filtro por cliente com a ordenação do histórico. O segundo contém somente os pedidos pendentes e segue a ordem usada pela consulta. O benchmark não força o planner a escolher nenhum deles.

### O filtro diário

A consulta original calcula a receita paga de um dia aplicando uma conversão à coluna:

```sql
SELECT coalesce(sum(total_amount), 0) AS revenue
FROM app.orders
WHERE status = 'paid'
  AND ordered_at::date = DATE '2026-10-31';
```

A alternativa expressa o mesmo período como intervalo semiaberto:

```sql
SELECT coalesce(sum(total_amount), 0) AS revenue
FROM app.orders
WHERE status = 'paid'
  AND ordered_at >= TIMESTAMPTZ '2026-10-31 00:00:00+00'
  AND ordered_at <  TIMESTAMPTZ '2026-11-01 00:00:00+00';
```

Assim, o filtro delimita diretamente os valores da coluna indexada. O início entra no intervalo e a meia-noite do dia seguinte fica de fora, sem precisar escolher um horário final com precisão fracionária.

As sessões do experimento usam UTC. Isso importa porque converter um `timestamptz` para `date` depende do fuso da sessão. Para um relatório de negócio em outro fuso, os limites precisam representar o dia desejado nesse fuso; copiar os valores UTC sem conferir essa regra pode mudar o resultado.

## Comparar desempenho exige preservar o resultado

Uma reescrita só pode ser considerada candidata à otimização depois de preservar o resultado esperado.

O benchmark compara as consultas com `EXCEPT ALL` nas duas direções e verifica hashes das saídas entre fases e rodadas. A ordenação inclui `order_id` como desempate nas consultas com `LIMIT`, tornando explícito quais registros devem ser retornados.

As leituras são executadas com `app_user`, diretamente no líder identificado. Isso mantém a medição concentrada no mesmo membro e evita dividir as estatísticas entre nós. Uma troca de líder detectada invalida a execução. A criação dos índices e a espera pela réplica ficam fora da janela medida.

Também há aquecimento e alternância da ordem das fases: uma rodada executa baseline antes da versão otimizada; a seguinte inverte essa ordem. Isso reduz o viés de executar sempre uma alternativa primeiro, embora não elimine toda a variabilidade do ambiente.

## O que a validação publicada mostrou

O [registro de 02/11/2026](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/evidence/validation.md) documenta uma execução local com PostgreSQL 16.15, 12 processadores lógicos e aproximadamente 62 GiB de RAM disponíveis no host, sem quotas nos containers.

A execução curta foi:

```bash
bash scripts/benchmark.sh \
  --seconds 3 --warmup-seconds 2 --rounds 2 --clients 1 4 --writes
```

Foram duas rodadas, com 30 planos instrumentados por fase em cada rodada, totalizando 60 amostras por fase para cada caso. Cada conjunto de planos teve cinco execuções prévias de aquecimento. As janelas medidas pelo `pgbench` duraram três segundos, após dois segundos de aquecimento, com um e quatro clientes.

As medianas dos tempos instrumentados no servidor foram:

| Caso | Baseline | Otimizado | Buffers compartilhados encontrados em cache, mediana |
|---|---:|---:|---:|
| Histórico do cliente 1 | 0,059 ms | 0,062 ms | 62 → 62 |
| Histórico do último cliente | 0,018 ms | 0,018 ms | 6 → 6 |
| Pedidos pendentes | 0,285 ms | 0,045 ms | 1.017 → 102 |
| Receita diária | 12,157 ms | 0,150 ms | 1.042 → 61 |

Os números da tabela são de `EXPLAIN ANALYZE`, não latências do cliente. A mediana de blocos lidos foi zero nessas janelas: os resultados descrevem uma condição de cache aquecido.

O filtro diário e o índice parcial reduziram tanto o tempo observado quanto os acessos a buffers. Essa combinação oferece uma evidência mais útil do que olhar apenas para milissegundos: houve redução do trabalho registrado na execução.

Já o índice composto de histórico não trouxe benefício relevante. Mesmo com concentração de pedidos, o conjunto por cliente ainda era pequeno nesse perfil. O resultado não justifica manter esse índice apenas com base na carga testada, nem permite concluir que ele seria inútil com outra distribuição ou volume.

As comparações de resultado foram equivalentes, não houve falhas nas transações medidas pelo `pgbench` e os 16 deltas de estatísticas foram considerados válidos, sem reinicialização das estatísticas ou remoção de registros por falta de espaço nas janelas.

## Índices também entram na conta da escrita

Para observar o outro lado da decisão, o lab cria duas cópias equivalentes dos pedidos. Uma mantém os índices de baseline; a outra recebe os dois índices candidatos.

Cada cópia passa por 1.000 atualizações de data, com um cliente e a mesma semente. Os pedidos originais são preservados. O registro publicado apresenta:

| Fase | Mediana de latência do cliente | TPS | WAL do cluster na janela | Tabela + índices |
|---|---:|---:|---:|---:|
| Baseline | 1,921 ms | 512,44 | 500.224 bytes | 18.874.368 bytes |
| Com os dois índices | 1,993 ms | 490,60 | 587.832 bytes | 23.289.856 bytes |

A cópia com os índices ocupou mais espaço e a janela registrou mais WAL. A diferença de throughput foi pequena nessa amostra.

Essa comparação é exploratória: a ordem de escrita foi fixa, sem aquecimento, e o WAL inclui atividade do cluster inteiro. Além disso, os dois índices foram acrescentados juntos. O teste não isola o custo de cada índice nem permite atribuir toda a diferença observada a eles.

Ainda assim, o resultado reforça uma pergunta necessária antes de manter uma estrutura adicional: o ganho das consultas que a utilizam compensa o espaço e a manutenção durante as escritas?

## Evidências para continuar investigando

Cada benchmark cria um diretório em `evidence/runs/`, com consultas, planos JSON, hashes de resultados, snapshots e deltas de estatísticas, logs do `pgbench`, metadados e relatório.

Os artefatos completos ficam no host e são ignorados pelo Git. O arquivo versionado `evidence/validation.md` registra os parâmetros, resultados e limites da execução publicada. Quem reproduzir o laboratório gera seus próprios arquivos e pode reconstruir o relatório com:

```bash
python3 scripts/report.py evidence/runs/<diretorio-do-benchmark>
```

Os timestamps ajudam a localizar a janela no Grafana e relacioná-la a transações, conexões, lag e logs. O registro de recursos contém uma amostra de `docker stats`, sem representar uma medição contínua de CPU e memória.

A configuração padrão disponível no lab usa três rodadas, 60 segundos medidos por configuração e concorrência de um, quatro e oito clientes. O README orienta reservar pelo menos 90 minutos para o experimento completo. Essa execução mais longa e o perfil `standard` não fazem parte da validação publicada.

## O que fica deste experimento

O Lab 07 valida um caminho de investigação: construir uma massa conhecida, registrar um baseline, mudar uma variável, conferir o resultado e medir novamente.

Na carga pequena, o índice parcial e a reescrita do filtro diário reduziram o trabalho observado. O índice composto de histórico não apresentou ganho relevante. A comparação de escrita mostrou que estruturas adicionais também ocupam espaço e precisam entrar na avaliação.

A validação curta não estabelece capacidade sustentada, SLO, comportamento de cache frio ou desempenho sob failover. Ela fornece um ponto de partida reproduzível para formular a próxima hipótese e testar condições mais próximas da aplicação de interesse.

Investigar performance passa por esse ciclo: entender o acesso aos dados, medir em condições conhecidas e manter somente as mudanças sustentadas pelas evidências.

## Referências

- [Lab 07: implementação e roteiro](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/5fd5efb/labs/07-performance)
- [Lab 07: registro de validação](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/evidence/validation.md)
- [PostgreSQL 16: Using EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html)
- [PostgreSQL 16: pg_stat_statements](https://www.postgresql.org/docs/16/pgstatstatements.html)
- [PostgreSQL 16: pgbench](https://www.postgresql.org/docs/16/pgbench.html)
