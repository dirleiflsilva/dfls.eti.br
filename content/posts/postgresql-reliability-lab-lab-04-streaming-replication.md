---
title: "PostgreSQL Reliability Lab - Lab 04: Streaming Replication no PostgreSQL"
date: 2026-08-31
draft: true
toc: true
slug: "postgresql-reliability-lab-lab-04-streaming-replication"
description: "Construindo e validando uma replica física por streaming no PostgreSQL Reliability Lab, com observação de WAL, atraso e limitações operacionais."
tags:
  - postgresql
  - streaming-replication
  - replicação
  - wal
  - dbre
  - docker
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
series:
  - PostgreSQL Reliability Lab
series_order: 4
---

> **Rascunho condicionado ao gate técnico:** o Lab 04 ainda está planejado. Topologia, configurações, comandos, métricas e conclusões devem ser substituídos pelas evidências da implementação validada antes da publicação.

Nos labs anteriores, construímos uma base PostgreSQL reproduzível, criamos um conjunto de dados realista e exercitamos backup, restore e recuperação usando WAL.

O passo seguinte é manter outra instância atualizada continuamente.

No PostgreSQL, a replicação física por streaming envia registros de WAL do servidor primário para uma ou mais replicas. Essas replicas reproduzem as alterações sobre uma cópia binária do cluster.

O Lab 04 deve transformar esse conceito em uma topologia executável e observável.

## Objetivo

O laboratório deverá:

- iniciar um primary e uma replica com Docker Compose;
- criar uma role dedicada à replicação;
- produzir a replica a partir de um backup base consistente;
- transmitir e aplicar WAL continuamente;
- validar a chegada de novas transações;
- medir o atraso observado;
- interromper e reiniciar a replica sem reconstruí-la desnecessariamente;
- documentar o que replicação não resolve sozinha.

Este lab não implementará failover automático. Promoção, eleição de primary, reconfiguração de clientes e prevenção de *split brain* pertencem ao Lab 05.

## Topologia prevista

> **TODO após implementação:** atualizar nomes, volumes, rede e portas conforme o Compose publicado.

```text
aplicação de teste
        |
        v
  PostgreSQL primary
        |
        | WAL streaming
        v
  PostgreSQL replica
```

O primary aceita escritas. A replica permanece em recuperação contínua e, quando `hot_standby` estiver habilitado, pode atender consultas somente leitura compatíveis com esse modo.

## Replicação não substitui backup

Uma exclusão acidental confirmada no primary também será reproduzida na replica. Corrupção lógica e comandos incorretos não deixam de existir porque mantemos uma segunda instância.

Por isso, o Lab 04 depende conceitualmente do Lab 03:

- backup e PITR protegem pontos recuperáveis no tempo;
- replicação mantém outra instância próxima do estado atual;
- alta disponibilidade exige ainda coordenação e failover.

Essas capacidades se complementam.

## Configuração do primary

O primary precisa produzir WAL suficiente para replicação e aceitar conexões do processo receptor.

Uma configuração inicial pode incluir:

```conf
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
wal_keep_size = 256MB
```

Os valores definitivos devem ser tratados como parâmetros de laboratório, não recomendações universais de produção.

A role de replicação pode ser criada assim:

```sql
CREATE ROLE replicator
WITH LOGIN REPLICATION PASSWORD 'senha-do-lab';
```

Em um ambiente real, a senha não deve ficar em scripts versionados. O `pg_hba.conf` também precisa restringir origem, banco de replicação e método de autenticação:

```conf
host replication replicator REDE_DA_REPLICA scram-sha-256
```

> **TODO técnico:** registrar a rede exata usada no Compose e validar que a regra não concede acesso mais amplo do que o necessário.

## Criando a replica

A replica física precisa começar de uma cópia consistente do primary. `pg_basebackup` pode criar essa base e escrever a configuração de standby:

```bash
pg_basebackup \
  --host=primary \
  --username=replicator \
  --pgdata="$PGDATA" \
  --wal-method=stream \
  --write-recovery-conf \
  --progress
```

Depois que a instância inicia com `standby.signal`, o processo `walreceiver` conecta ao primary, recebe WAL e o aplica.

> **TODO técnico:** documentar se o bootstrap ocorrerá em script separado, container temporário ou entrypoint idempotente. O fluxo precisa distinguir primeiro uso de reinicializações normais.

## Validando os dois lados

No primary, `pg_stat_replication` mostra conexões de replicação:

```sql
SELECT
    application_name,
    client_addr,
    state,
    sync_state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn
FROM pg_stat_replication;
```

Na replica, podemos confirmar o modo de recuperação:

```sql
SELECT pg_is_in_recovery();
```

E observar o processo receptor:

```sql
SELECT
    status,
    sender_host,
    sender_port,
    written_lsn,
    flushed_lsn,
    latest_end_lsn,
    latest_end_time
FROM pg_stat_wal_receiver;
```

> **TODO de evidência:** inserir as saídas reais das duas consultas sem expor segredos ou informações desnecessárias do ambiente.

## Teste funcional previsto

No primary, criaremos uma transação identificável:

```sql
INSERT INTO audit.events (event_type, payload)
VALUES (
    'replication_test',
    jsonb_build_object('created_at', clock_timestamp())
)
RETURNING event_id, created_at;
```

Na replica, consultaremos o mesmo identificador:

```sql
SELECT event_id, event_type, payload, created_at
FROM audit.events
WHERE event_id = ID_GERADO_NO_PRIMARY;
```

O teste automatizado deverá aguardar por um intervalo limitado e falhar de forma clara se a linha não chegar. Um `sleep` arbitrário não é uma validação robusta.

## Medindo atraso

Bytes de diferença entre posições de WAL ajudam a observar o estado da transmissão:

```sql
SELECT
    application_name,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;
```

Na replica, o tempo desde a última transação reproduzida pode ser observado quando existe atividade:

```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replay_delay;
```

Nenhuma dessas medidas deve ser interpretada isoladamente. Uma base sem novas escritas pode apresentar um intervalo temporal que não representa backlog, e diferença zero em um instante não garante disponibilidade futura.

## Replicação assíncrona e síncrona

Por padrão, o streaming costuma ser usado de forma assíncrona: o primary pode confirmar a transação antes que ela seja persistida ou aplicada na replica.

Isso reduz o acoplamento da escrita à latência da replica, mas deixa uma janela de perda de dados caso o primary falhe antes da transmissão.

Replicação síncrona pode exigir confirmação de standbys configurados antes do commit retornar. A escolha altera latência e disponibilidade e precisa estar conectada ao RPO.

> **Escopo do lab:** começar com replicação assíncrona e documentar o comportamento observado. Um teste síncrono só deve entrar se for implementado e medido.

## Replication slots

Um slot físico pode impedir que o primary remova WAL ainda necessário por uma replica desconectada.

Essa proteção tem um custo: se o consumidor não voltar ou o slot for abandonado, WAL pode se acumular e consumir disco.

> **TODO de decisão:** definir se o Lab 04 usará slot físico. Se usar, demonstrar sua criação, observação, limite e remoção segura.

## Cenários de falha a testar

- reiniciar somente a replica e confirmar que ela retoma o streaming;
- interromper a replica, gerar mudanças e observar sua recuperação;
- interromper temporariamente o primary e observar o estado da replica;
- tentar escrever na replica e registrar o erro esperado;
- acompanhar o crescimento de WAL durante uma interrupção controlada.

O objetivo não é apenas chegar ao estado `streaming`. É compreender o comportamento da topologia quando um de seus componentes deixa de responder.

## Evidências necessárias antes da publicação

| Evidência | Estado do rascunho |
|---|---|
| Commit ou tag do Lab 04 | Pendente |
| Primary e replica saudáveis no Compose | Pendente |
| `pg_stat_replication` em estado `streaming` | Pendente |
| `pg_is_in_recovery()` verdadeiro na replica | Pendente |
| Escrita no primary consultada na replica | Pendente |
| Atraso observado e interpretado | Pendente |
| Reinicialização da replica validada | Pendente |
| Limitações e falhas encontradas | Pendente |

## O que este lab não resolve

Ao final, teremos uma replica física, mas ainda não uma plataforma de alta disponibilidade completa.

Continuarão em aberto detectar a indisponibilidade do primary, decidir quando promover uma replica, redirecionar clientes, proteger a topologia contra dois primaries e reconstruir a antiga instância depois da promoção.

Esses problemas conduzem ao Lab 05, dedicado a failover e alta disponibilidade.

> **TODO:** inserir o link para `labs/04-replication` depois da publicação do gate técnico.

## Referências

- [PostgreSQL: log-shipping standby servers](https://www.postgresql.org/docs/current/warm-standby.html)
- [PostgreSQL: streaming replication](https://www.postgresql.org/docs/current/warm-standby.html#STREAMING-REPLICATION)
- [PostgreSQL: configurações do primary](https://www.postgresql.org/docs/current/runtime-config-replication.html#RUNTIME-CONFIG-REPLICATION-PRIMARY)
- [PostgreSQL: funções de controle de replicação](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-RECOVERY-CONTROL)

