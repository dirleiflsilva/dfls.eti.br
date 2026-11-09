---
title: "Autovacuum e crescimento de tabelas em um workload inspirado no Protheus"
date: 2026-11-09
draft: false
toc: true
slug: "autovacuum-crescimento-tabelas-workload-inspirado-protheus"
description: "Duas execuções com 100 mil movimentos sintéticos mostram exclusão lógica e autovacuum no PostgreSQL: espaço reutilizável não garante estabilidade do heap."
tags:
  - postgresql
  - protheus
  - autovacuum
  - vacuum
  - mvcc
  - armazenamento
topics:
  - PostgreSQL e SQL
  - Protheus e AdvPL
  - DevOps e Confiabilidade
---

Uma tabela recebe atualizações durante o dia, alguns registros passam a ser considerados excluídos pela aplicação e o espaço em disco continua crescendo. O autovacuum aparece nas estatísticas, mas o arquivo não diminui. Isso significa que a manutenção falhou?

Para responder, precisamos separar três coisas: **o registro que a aplicação considera ativo, a versão de linha que o PostgreSQL ainda precisa preservar e o espaço que já pode ser reutilizado**.

No [SQL da Semana #15](/posts/sql-da-semana-15-exclusao-logica-filial-modelo-protheus/), usamos filial e exclusão lógica para discutir a correção das consultas. Agora, um experimento complementar do PostgreSQL Reliability Lab observa o armazenamento durante ciclos de escrita e manutenção.

Em duas execuções com os mesmos parâmetros, o autovacuum foi observado e os **10 mil registros excluídos logicamente permaneceram armazenados**. Em 08/11, a rodada seguinte de atualizações manteve o heap em **68,35 MiB**. Na revalidação de 09/11, ele voltou a crescer no último ciclo. A manutenção disponibiliza espaço para reutilização, mas não garante que novas rajadas caibam no arquivo existente.

> A [implementação e o roteiro](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/19f7908/experiments/autovacuum-protheus-like) e o [registro das validações de 08 e 09/11/2026](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/19f7908/experiments/autovacuum-protheus-like/evidence/validation.md) estão publicados no commit `19f7908`, com snapshots e metadados de referência versionados. Os dados são sintéticos e não reproduzem o dicionário, o DBAccess ou as transações do Protheus. O experimento não constitui benchmark do ERP.

## Exclusão lógica continua sendo uma linha viva

O modelo mantém a convenção didática do episódio 15: `d_e_l_e_t_ = ' '` representa um registro ativo e `d_e_l_e_t_ = '*'`, um registro excluído logicamente.

Na configuração validada, a exclusão dos últimos 10 mil movimentos ocorre assim, dentro de uma transação própria:

```sql
UPDATE avexp.movements
SET d_e_l_e_t_ = '*',
    revisao = revisao + 1
WHERE r_e_c_n_o_ > 90000
  AND d_e_l_e_t_ = ' ';
```

O comando muda o estado de negócio, mas mantém a linha na tabela. A versão atual, com `'*'`, continua viva para o banco. O autovacuum não interpreta esse campo como uma ordem de remoção.

O PostgreSQL usa MVCC para controlar a visibilidade dos dados entre transações. A atualização produz uma nova versão da linha; a anterior pode precisar ser preservada enquanto ainda for visível a outra transação. Esse mecanismo é descrito na [introdução ao MVCC](https://www.postgresql.org/docs/16/mvcc-intro.html).

Quando a versão antiga deixa de ser necessária, seu espaço pode ser recuperado. A versão atual marcada com `'*'` permanece. Portanto, uma tabela pode acumular registros excluídos pela aplicação mesmo com a manutenção funcionando.

| Situação | O que representa |
|---|---|
| Linha atual com marcador ativo | Registro disponível para as consultas de negócio do exemplo |
| Linha atual com marcador de exclusão | Registro retido, embora omitido dessas consultas |
| Versão antiga ainda visível a uma transação | Histórico que o banco ainda precisa preservar |
| Versão morta removível | Espaço que a manutenção pode recuperar para reutilização |

Uma política de retenção e expurgo resolve outra questão. No ERP real, ela depende das regras da aplicação; o exemplo trabalha exclusivamente em um banco próprio de estudos.

## Um complemento do Reliability Lab

O experimento fica em `experiments/autovacuum-protheus-like/` e reutiliza os serviços do [Lab 07 de performance](/posts/postgresql-reliability-lab-lab-07-performance/). Ele acrescenta uma investigação de manutenção sem abrir um novo lab numerado.

O runner cria o banco exclusivo `autovacuum_protheus_like`, com os objetos no schema `avexp`. Não modifica configurações globais nem os dados dos benchmarks existentes. O acesso administrativo ocorre diretamente no líder identificado, e o fluxo compartilha o lock local das operações do Lab 07.

A tabela `avexp.movements` contém identificador técnico, filial, documento, valor, revisão, indicador lógico e conteúdo textual. O campo `d_e_l_e_t_` é `char(1)`. O identificador `r_e_c_n_o_` seleciona subconjuntos de forma determinística; ele não informa quando ocorreu uma alteração.

A carga validada usa:

| Parâmetro | Valor |
|---|---:|
| Registros iniciais | 100.000 |
| Filiais sintéticas | 10 |
| Conteúdo por registro | 256 bytes ASCII |
| Movimentos atualizados por ciclo | 20.000 |
| Ciclos antes da observação | 5 |
| Registros excluídos logicamente | 10.000 |
| Ciclos após manutenção observada | 5 |

Os dados são gerados por fórmulas e texto determinísticos. Durante todo o fluxo, permanecem a chave primária, o índice de filial/documento e o índice do marcador de exclusão.

## Como reproduzir

São necessários Linux, Python 3 padrão, Docker Compose e a stack do Lab 07 configurada, incluindo seu `.env`. O [README do experimento](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/19f7908/experiments/autovacuum-protheus-like/README.md) detalha os pré-requisitos e as proteções de execução.

Na raiz do repositório, com o ambiente preparado:

```bash
docker compose --project-directory labs/07-performance up -d --wait --wait-timeout 300
python3 experiments/autovacuum-protheus-like/run.py
```

Uma segunda execução é recusada para evitar recarga silenciosa. Para reconstruir explicitamente **somente o schema do experimento**, descartando seus movimentos sintéticos anteriores, a validação utilizou:

```bash
python3 experiments/autovacuum-protheus-like/run.py --rebuild \
  --rows 100000 --payload-bytes 256 --update-rows 20000 \
  --delete-rows 10000 --cycles 5 --poll-seconds 5 --timeout 240
```

O fluxo começa com carga, `ANALYZE` e baseline. Em cada ciclo, os primeiros 20 mil movimentos recebem valor acrescido de `1,25` e revisão incrementada, com commit separado. Depois, os últimos 10 mil são marcados como excluídos logicamente.

A observação automática exige incremento de `autovacuum_count` e `last_autovacuum` estritamente posterior tanto ao timestamp do snapshot de exclusão lógica quanto ao valor anterior, quando existente. Esse critério foi reforçado na revisão de 09/11 para evitar aceitar uma manutenção anterior ao marco cujas estatísticas aparecessem com atraso. Somente após essa confirmação são executados os cinco ciclos de investigação de reutilização.

O critério é conservador: uma manutenção concluída antes daquele snapshot pode não satisfazê-lo. Timeout fica registrado como **inconclusivo**, sem executar a fase de reutilização. O código de saída, sozinho, não substitui a leitura do resultado no relatório.

## Configuração experimental explícita

A execução ocorreu no PostgreSQL **16.15**, na stack `pgrl-lab07`. O autovacuum global e `track_counts` estavam habilitados, com `autovacuum_naptime = 60 s` e três workers máximos.

Para tornar a observação viável nesse recorte, a tabela usa opções fixas:

```sql
autovacuum_enabled = true
autovacuum_vacuum_threshold = 50
autovacuum_vacuum_scale_factor = 0.02
autovacuum_analyze_threshold = 50
autovacuum_analyze_scale_factor = 0.02
```

Essas opções pertencem à definição da tabela. Não são recomendações para produção nem resultado de uma comparação de tuning.

No PostgreSQL 16, o gatilho por atualizações e exclusões combina limiar fixo e fator de escala sobre `reltuples`. Com estimativa de 100 mil linhas, as opções acima produzem o limiar ilustrativo `50 + 0,02 × 100.000 = 2.050`. Ultrapassar o limiar torna a tabela candidata; a execução ainda depende da programação e disponibilidade dos workers. Há também gatilhos por inserções e prevenção de wraparound, descritos na [documentação do autovacuum](https://www.postgresql.org/docs/16/routine-vacuuming.html#AUTOVACUUM).

## O que foi medido

Cada fase registra contagens exatas, tamanhos, estimativas de versões vivas e mortas, contadores de escrita, manutenção e configurações. A coleta separa:

```sql
SELECT
    pg_relation_size('avexp.movements'::regclass) AS heap_bytes,
    pg_table_size('avexp.movements'::regclass) AS tabela_bytes,
    pg_indexes_size('avexp.movements'::regclass) AS indices_bytes,
    pg_total_relation_size('avexp.movements'::regclass) AS total_bytes;
```

`pg_relation_size` mede aqui o fork principal do heap. `pg_table_size` inclui estruturas auxiliares e TOAST; o total acrescenta os índices. As diferenças estão nas [funções de tamanho do PostgreSQL](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADMIN-DBSIZE).

`n_live_tup` e `n_dead_tup` são estimativas, sujeitas a atraso de publicação. O runner usa conexões novas e `stats_fetch_consistency = none`, compara deltas e verifica mudanças de líder, reinício, timeline e resets. A detecção é amostrada e não cobre qualquer evento possível entre duas verificações. A [documentação das estatísticas cumulativas](https://www.postgresql.org/docs/16/monitoring-stats.html) explica o comportamento dos contadores e estimativas.

A validação lógica confere todas as linhas: identificador, filial, documento, conteúdo, valor, revisão e indicador. Não houve divergências nos 26 snapshots da execução de 08/11 nem nos 32 da reexecução de 09/11.

## O que as execuções mostraram

### Referência de 08/11: heap estável após a manutenção

O fluxo registrado em **08/11/2026, das 16:54:08 às 16:55:47, horário de Brasília**, durou aproximadamente 99 segundos. O líder permaneceu `pg1`, sem mudanças de identidade ou quedas nos contadores comparados.

A tabela resume os marcos. Tamanhos estão em MiB, arredondados a duas casas; o registro publicado preserva os bytes exatos.

| Marco | Heap (MiB) | Índices (MiB) | Total (MiB) | Versões mortas estimadas | Autovacuum acumulado |
|---|---:|---:|---:|---:|---:|
| Baseline | 32,55 | 9,43 | 42,02 | 0 | 0 |
| Após cinco ciclos | 65,10 | 10,65 | 75,80 | 99.992 | 0 |
| Após exclusão lógica | 68,35 | 11,01 | 79,41 | 109.992 | 0 |
| Manutenção automática observada | 68,35 | 11,01 | 79,41 | 0 | 1 |
| Após cinco ciclos de reutilização | 68,35 | 12,27 | 80,67 | 99.840 | 1 |

A confirmação automática veio cerca de **15 segundos após o snapshot de exclusão lógica**. O contador passou de zero para um, com novo `last_autovacuum`. Nenhuma coleta capturou progresso em andamento: a evidência veio dos contadores e do timestamp da manutenção concluída.

Os registros retidos permaneceram em **100 mil**, sendo **90 mil ativos e 10 mil excluídos logicamente** após a marcação. Ao final, foram registrados 210 mil updates e nenhum delete físico. A soma das revisões passou de zero para 110 mil após a primeira rodada e exclusão lógica, e para 210 mil após a segunda rodada.

### Na referência, o heap ficou estável, mas o total cresceu

A queda da estimativa de versões mortas para zero, seguida de mais 100 mil atualizações sem expansão do heap, é compatível com reutilização de espaço. Isso não exige que o arquivo volte ao tamanho inicial.

Já os índices passaram de 11,01 para 12,27 MiB na segunda rodada. O total terminou em 80,67 MiB. Portanto, a estabilidade do heap não demonstra estabilização de todo o armazenamento.

Não houve medição direta de espaço livre ou bloat em bytes. Limpeza durante acessos às páginas e atualizações HOT também podem contribuir; o contador final registrou 200 updates HOT. O experimento não isola a contribuição de cada mecanismo.

A estimativa final de 99.840 versões mortas foi coletada após a nova rodada de escrita. O fluxo não esperou uma segunda manutenção automática para encerrar, por isso esse valor não contradiz a manutenção observada anteriormente.

### Revalidação de 09/11: o heap voltou a crescer

Com o runner revisado e os mesmos parâmetros de carga, a nova execução ocorreu em **09/11/2026, das 19:11:41 às 19:13:59, horário de Brasília**, e durou aproximadamente 138 segundos. Os [snapshots completos](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/19f7908/experiments/autovacuum-protheus-like/evidence/reference-20261109/snapshots.json) e os [metadados](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/19f7908/experiments/autovacuum-protheus-like/evidence/reference-20261109/metadata.json) permitem conferir os valores em bytes.

| Marco | Heap (MiB) | Índices (MiB) | Total (MiB) | Versões mortas estimadas | Autovacuum acumulado |
|---|---:|---:|---:|---:|---:|
| Baseline | 32,55 | 9,43 | 42,02 | 0 | 0 |
| Após cinco ciclos | 60,16 | 10,70 | 70,91 | 0 | 1 |
| Após exclusão lógica | 60,16 | 11,05 | 71,27 | 10.000 | 1 |
| Manutenção automática observada | 60,16 | 11,08 | 71,29 | 0 | 2 |
| Após cinco ciclos de reutilização | 65,05 | 11,62 | 76,72 | 99.808 | 2 |

Um autovacuum já havia ocorrido durante os ciclos iniciais. Após o snapshot de exclusão lógica, às 19:12:27, o contador passou de um para dois, com `last_autovacuum` às 19:13:19. A confirmação veio no poll das 19:13:20, cerca de 53 segundos após aquele snapshot. Não houve intervenção manual nessa execução.

O heap permaneceu em **63.086.592 bytes (60,16 MiB)** nos quatro primeiros ciclos de repetição e passou a **68.206.592 bytes (65,05 MiB)** no quinto. Os índices e o total também cresceram nessa fase. As contagens permaneceram em 100 mil registros retidos, 90 mil ativos e 10 mil excluídos logicamente; a soma final das revisões foi novamente 210 mil.

Essa variação limita a interpretação da primeira execução: **heap estável foi um resultado daquele ensaio, não uma garantia dos parâmetros usados**. A manutenção foi observada nas duas execuções, mas a segunda rodada de escrita teve evolução física diferente. Sem medir diretamente o espaço livre ou isolar pruning e HOT, não é possível atribuir cada diferença a um mecanismo específico.

## Manutenção manual é uma evidência separada

O experimento oferece, opcionalmente:

```bash
python3 experiments/autovacuum-protheus-like/run.py --manual-vacuum
```

Esse comando executa `VACUUM (VERBOSE, ANALYZE)` em outra pasta de evidências. Na revalidação de 09/11, ele foi ensaiado após um teste separado de timeout com 100 linhas. Um autovacuum já havia ocorrido nesse dataset; o comando manual incrementou `vacuum_count` em um, manteve `autovacuum_count` em um e preservou contagens e valores.

O runner recuperou os parâmetros efetivos desse dataset, embora a invocação usasse os defaults de 100 mil linhas. Os metadados preservam `manual_vacuum=true`, registram o dataset em `parameters` e guardam os argumentos da invocação em `requested_parameters`. Essa intervenção não faz parte das execuções de 100 mil linhas nem comprova manutenção automática posterior ao marco de observação.

O `VACUUM` comum recupera espaço para reutilização e pode devolver páginas vazias no final da tabela, sem compactar todo o arquivo. `VACUUM FULL` reescreve a tabela, exige espaço adicional e bloqueio exclusivo. Ele não foi executado neste experimento. A [referência de VACUUM](https://www.postgresql.org/docs/16/sql-vacuum.html) detalha essas diferenças.

## O alcance desta evidência

Na execução de 08/11, os cinco ciclos iniciais tiveram durações entre 0,873 e 0,942 segundo; os de reutilização, entre 0,876 e 0,945 segundo. Esses tempos incluem Docker, `psql` e verificações de líder. Não representam latência SQL isolada nem comprovam equivalência de desempenho entre fases.

As amostras de recursos são pontuais e compartilhadas com a stack. Na referência de 08/11, Prometheus respondeu, mas os exporters existentes se conectam a `appdb`: não foi demonstrada cobertura das métricas de tabela do novo banco. Loki retornou entradas filtradas pelo banco, sem mensagens de autovacuum. O limiar de logging estava em dez minutos, compatível com a ausência de logs de uma manutenção curta.

Cada execução salva parâmetros, hashes dos scripts, snapshots JSON, relatório e coletas em `evidence/runs/`, ignorado pelo Git. O documento versionado registra os resultados e as limitações, com snapshots e metadados de referência das duas datas. Os metadados de 09/11 incluem também o hash do runner compartilhado do Lab 07; os hashes das fontes executadas correspondem aos arquivos revisados.

Na revisão de 09/11, passaram cinco testes do experimento e cinco do Lab 07, além da compilação Python e de `git diff --check`. O teste separado com 100 linhas, dois ciclos e `--timeout 0` terminou com saída zero e resultado explicitamente inconclusivo, sem executar a fase de reutilização. A validação também passou com sobreposição dos subconjuntos de atualização e exclusão lógica. Tentativas concorrente e sem `--rebuild` foram recusadas, preservando o dataset. Failover real e resets injetados continuam sem ensaio na stack; a cobertura desses casos permanece unitária.

Esta é uma observação de rajadas de escrita com manutenção posterior. Ela não mede concorrência real de ERP, transações longas ou capacidade de acompanhar carga sustentada. Também não estabelece um fator de escala ideal.

As duas execuções ajudam a interpretar um cenário concreto: registros excluídos pela aplicação continuaram retidos e a manutenção automática foi observada. As novas escritas mantiveram o heap estável em uma execução e voltaram a expandi-lo na outra, enquanto os índices cresceram em ambas. Investigar cada componente permite avaliar o autovacuum com mais precisão do que esperar apenas que o arquivo diminua.

## Referências

- [Experimento: implementação e roteiro](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/19f7908/experiments/autovacuum-protheus-like)
- [Experimento: validações de 08 e 09/11/2026](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/19f7908/experiments/autovacuum-protheus-like/evidence/validation.md)
- [PostgreSQL 16: manutenção e autovacuum](https://www.postgresql.org/docs/16/routine-vacuuming.html)
- [PostgreSQL 16: estatísticas cumulativas](https://www.postgresql.org/docs/16/monitoring-stats.html)
- [PostgreSQL 16: VACUUM](https://www.postgresql.org/docs/16/sql-vacuum.html)
