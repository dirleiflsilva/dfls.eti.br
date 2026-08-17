---
title: "PostgreSQL Reliability Lab - Lab 03: Backup não basta — restore, WAL archiving e PITR"
date: 2026-08-17
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-03-backup-restore-pitr"
description: "Evoluindo o PostgreSQL Reliability Lab com backup lógico, backup físico, WAL archiving, restore validado e recuperação point-in-time."
tags:
  - postgresql
  - backup
  - restore
  - wal
  - pitr
  - dbre
  - docker
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
series:
  - PostgreSQL Reliability Lab
series_order: 3
---

No [Lab 02 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/), criamos uma base reproduzível com roles, schemas, extensões, tabelas relacionadas e dados suficientes para exercitar cenários operacionais.

Essa base tornou possível fazer uma pergunta mais importante do que "temos backup?":

> Conseguimos restaurar o banco e recuperar os dados até o ponto necessário depois de uma falha?

Um arquivo de backup que nunca foi restaurado é apenas uma expectativa. Confiabilidade exige procedimento, evidência e conhecimento dos limites de recuperação.

Esse é o objetivo do [Lab 03: Backup & Restore](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/03-backup-restore).

## Objetivo

O laboratório demonstra quatro capacidades:

- gerar e restaurar um backup lógico;
- gerar e restaurar uma cópia física do cluster;
- arquivar continuamente os segmentos de WAL;
- recuperar o banco até um instante anterior a uma falha simulada.

O resultado não é apenas um conjunto de comandos. Os scripts produzem validações que respondem:

- o backup terminou com sucesso?
- o arquivo está legível?
- o restore inicia em uma instância limpa?
- as roles, os objetos, os privilégios e os dados esperados foram recuperados?
- o ponto de recuperação foi respeitado?
- o mesmo procedimento pode ser repetido sem aceitar artefatos incompletos?

## Backup e recuperação não são a mesma coisa

Backup é a cópia usada como insumo. Recuperação é a capacidade de reconstruir um estado utilizável dentro dos objetivos definidos.

Duas medidas ajudam a deixar isso concreto:

- **RPO**, ou Recovery Point Objective: quanto dado podemos admitir perder;
- **RTO**, ou Recovery Time Objective: quanto tempo podemos levar para restabelecer o serviço.

Um `pg_dump` gerado uma vez por dia pode ser suficiente para um ambiente que aceita perder quase 24 horas de alterações. Ele não atende sozinho um sistema cujo RPO é de poucos minutos. O artigo [Backup lógico vs. backup físico no PostgreSQL](/posts/backup-logico-vs-backup-fisico-postgresql/) detalha as diferenças e os usos das duas abordagens.

Neste lab, o foco é provar a correção e a repetibilidade do processo. Os scripts ainda não instrumentam duração, tamanho ou consumo de recursos; portanto, os resultados não devem ser interpretados como RTO ou benchmark de produção.

## Estrutura implementada

```text
labs/03-backup-restore/
├── .env.example
├── docker-compose.yml
├── init/
│   ├── 01_roles.sh
│   ├── 02_extensions.sql
│   ├── 03_schemas.sql
│   ├── 04_tables.sql
│   ├── 05_seed_procedures.sql
│   └── 06_load_sample_data.sql
├── scripts/
│   ├── _common.sh
│   ├── archive_wal.sh
│   ├── backup_logical.sh
│   ├── restore_logical.sh
│   ├── backup_physical.sh
│   ├── restore_physical.sh
│   ├── pitr_demo.sh
│   ├── check.sh
│   ├── test_repetition.sh
│   ├── validate_restored_db.sql
│   └── orders_fingerprint.sql
├── backups/
└── wal_archive/
```

Os dumps, backups físicos e segmentos de WAL são gerados localmente e permanecem fora do Git. O repositório contém somente a configuração, os scripts e as instruções necessárias para reproduzir o cenário.

## Preparando o ambiente

O Lab 03 usa PostgreSQL 16 e publica a instância principal na porta `5434`, evitando conflito com os labs anteriores. Depois de clonar o repositório, a preparação começa no diretório do lab:

```bash
cd labs/03-backup-restore
cp .env.example .env
```

As senhas de `postgres` e `backup_user` devem ser substituídas no `.env`. A role de backup recebe o atributo `REPLICATION` durante a primeira inicialização, mas sua credencial não fica fixa nos arquivos versionados.

Os bind mounts precisam permitir que o usuário do PostgreSQL no container grave os artefatos:

```bash
mkdir -p wal_archive backups/logical backups/physical
chmod 1733 wal_archive backups/logical backups/physical
docker compose up -d
chmod +x scripts/*.sh
./scripts/check.sh
```

O modo `1733` é uma solução de compatibilidade para este ambiente local: permite escrita sem liberar a listagem do diretório e usa o sticky bit para restringir remoções. Em produção, o correto é usar storage dedicado, identidade controlada e permissões mais restritivas.

O `check.sh` não se limita ao `pg_isready`. Ele valida roles, schemas, extensões, massa de dados e parâmetros de WAL, força um `pg_switch_wal()` e aguarda o segmento aparecer no archive sem aumentar o contador de falhas do archiver.

## Parte 1: backup lógico

O backup lógico representa os objetos do banco por meio de comandos e dados que podem ser restaurados pelo PostgreSQL.

No lab, o fluxo foi encapsulado em dois scripts:

```bash
./scripts/backup_logical.sh
./scripts/restore_logical.sh
```

O primeiro script executa `pg_dump -Fc` e grava inicialmente um arquivo com sufixo `.partial`. O nome definitivo só aparece depois que o comando termina com sucesso. Assim, uma execução interrompida não se apresenta como um backup válido.

O formato custom permite inspecionar o catálogo com `pg_restore --list`, selecionar objetos e usar recursos específicos do `pg_restore`. É justamente a inspeção do catálogo que inicia o fluxo de recuperação.

O restore ocorre em `appdb_restore`, criado a partir de `template0`, e não sobre o banco que gerou o dump. Antes da restauração, o script verifica se as roles globais necessárias existem; depois, preserva proprietários e ACLs do banco original.

Essa decisão explicita um limite importante: `pg_dump` protege o banco `appdb`, mas não inclui roles nem tablespaces, que são objetos globais do cluster. Em uma migração para um cluster vazio, eles precisam ser criados antes do restore ou protegidos separadamente com `pg_dumpall --globals-only`.

### O que o restore lógico valida

Uma restauração bem-sucedida precisa verificar mais do que contagens. O arquivo `validate_restored_db.sql`, compartilhado pelos três cenários de recuperação, confere:

- tabelas e volume mínimo esperado;
- registros sentinela de clientes, produtos e pedidos;
- coerência entre total do pedido, itens e pagamento;
- chaves primárias, chaves estrangeiras e índices essenciais;
- ownership de schemas e tabelas;
- privilégios de `app_user` e `readonly`.

Contagens e um fingerprint determinístico de pedidos também são comparados com o banco atual. A diferença entre eles é informativa, não um erro automático: o banco de origem pode ter recebido novas transações depois que o snapshot foi criado.

## Parte 2: backup físico

Uma cópia física representa os arquivos do cluster PostgreSQL. Ao contrário do backup lógico, ela está ligada à arquitetura e à versão principal do servidor.

O PostgreSQL fornece `pg_basebackup` para criar uma cópia consistente de um cluster em execução. No lab, o comando é autenticado como `backup_user`, usa formato plain e inclui WAL por streaming:

```bash
./scripts/backup_physical.sh
./scripts/restore_physical.sh
```

Assim como no backup lógico, o diretório nasce com o sufixo `.partial` e só recebe o timestamp definitivo depois do sucesso.

Para validar o resultado, `restore_physical.sh` copia o backup para uma área de trabalho e sobe um container temporário `postgres:16` na porta `5435`. O backup original permanece intacto. O cluster restaurado precisa iniciar, responder ao `pg_isready` e passar pelas mesmas verificações estruturais e de integridade usadas no restore lógico.

Esse isolamento é essencial: iniciar novamente a própria origem não prova que o backup é recuperável.

## Parte 3: WAL archiving

O Write-Ahead Log registra mudanças antes que elas sejam consolidadas nos arquivos de dados. Ao preservar uma sequência contínua de segmentos de WAL a partir de um backup base, podemos reproduzir alterações posteriores.

A configuração do container habilita o arquivamento e delega a publicação dos segmentos a um script dedicado:

```conf
wal_level = replica
archive_mode = on
archive_command = '/usr/local/bin/archive_wal %p %f'
```

O `archive_wal.sh` evita uma fragilidade comum do exemplo baseado apenas em `cp`: ele publica cada arquivo por operação atômica, usa modo `0600`, aceita o reenvio se o conteúdo já arquivado for idêntico e recusa sobrescrever um arquivo de mesmo nome com conteúdo diferente.

O comando deve retornar sucesso somente quando o segmento estiver armazenado corretamente. Se o arquivamento falhar repetidamente, o diretório `pg_wal` pode crescer até consumir o espaço disponível.

```sql
SELECT
    archived_count,
    failed_count,
    last_archived_wal,
    last_archived_time,
    last_failed_wal,
    last_failed_time
FROM pg_stat_archiver;
```

O `check.sh` usa justamente `pg_stat_archiver` e a presença do arquivo no bind mount para provar que houve arquivamento real, não apenas configuração aparente.

## Parte 4: recuperação point-in-time

O cenário completo está em um único comando:

```bash
./scripts/pitr_demo.sh
```

O script cria um novo backup base e registra um timestamp de referência. Em seguida, simula o incidente dentro de uma única transação:

```sql
BEGIN;
DELETE FROM app.payments;
DELETE FROM app.order_items;
DELETE FROM app.orders;
COMMIT;
```

> **Atenção:** esse script apaga os pedidos, itens e pagamentos do ambiente principal do Lab 03. A destruição é intencional e deve ocorrer somente nessa base descartável.

Depois da exclusão, o fluxo força a troca do segmento e só avança quando o WAL do incidente aparece no archive. Uma cópia do backup base recebe a configuração de recuperação:

```conf
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = 'TIMESTAMP_ANTERIOR_AO_INCIDENTE'
recovery_target_action = 'promote'
```

A presença de `recovery.signal` faz o PostgreSQL iniciar em recuperação. O container temporário, publicado na porta `5436`, reproduz os WALs até o timestamp e promove o cluster restaurado.

Por fim, o script compara três estados de `app.orders`: antes do incidente, depois da exclusão na origem e depois do PITR. A contagem recuperada precisa coincidir com a original. O fingerprint de pedidos, itens e pagamentos também precisa ser idêntico, impedindo que uma contagem coincidente esconda conteúdo divergente.

## Repetibilidade também faz parte da evidência

Um procedimento pode funcionar uma vez e ainda ser frágil. Por isso, o lab inclui um teste end-to-end com confirmação explícita:

```bash
./scripts/test_repetition.sh --destructive
```

Ele recria o cluster e executa dois ciclos de PITR separados por um reset completo. Também confirma que arquivos `.partial` não são escolhidos como backups válidos e que o restore físico rejeita um timestamp malformado.

O reset precisa limpar o archive e os backups vinculados ao cluster descartado. WALs de clusters diferentes não podem compartilhar o mesmo diretório como se pertencessem a uma única sequência recuperável.

## Evidências da entrega

| Evidência | Implementação |
|---|---|
| Referência técnica | Commit [`c77a490`](https://github.com/dirleiflsilva/postgresql-reliability-lab/commit/c77a4903aa656729a1777e5d2f209f2c1991b632) |
| Backup lógico | Dump custom, inspeção de catálogo e restore em `appdb_restore` |
| Backup físico | Cluster iniciado e validado em container temporário |
| WAL archiving | Troca forçada, contador do archiver e arquivo no archive conferidos |
| PITR | Recuperação por timestamp anterior ao incidente e promoção automática |
| Integridade | Estrutura, sentinelas, constraints, índices, ownership, ACLs, totais e fingerprint |
| Repetibilidade | Dois ciclos de PITR, resets e rejeição de artefatos parciais ou entrada inválida |
| Medição de tempo | Não instrumentada nesta versão; não há afirmação de RTO |

## O que continua fora do escopo

Este é um laboratório local com mecanismos nativos do PostgreSQL. Ele não implementa:

- armazenamento off-site ou imutável;
- criptografia e rotação de chaves;
- política de retenção e expiração;
- agendamento periódico dos backups e testes de restore;
- alertas para falhas do archiver ou crescimento de `pg_wal`;
- paralelismo, compressão e ajuste para grandes volumes;
- ferramentas dedicadas, como pgBackRest ou Barman.

Essas ausências não invalidam o exercício. Elas delimitam o que foi provado: em um ambiente reproduzível e descartável, os backups lógico e físico podem ser restaurados, e o conjunto backup base mais WAL arquivado consegue recuperar o banco até antes de uma alteração destrutiva.

## O que este lab demonstra

O principal aprendizado não é decorar `pg_dump` ou `pg_basebackup`.

É entender que uma estratégia de recuperação conecta cópias consistentes, retenção de WAL, armazenamento protegido, automação, monitoramento, testes periódicos e objetivos de RPO e RTO.

Sem restore testado, não existe evidência suficiente de que o backup resolve o problema para o qual foi criado.

## Próximo passo

Depois de proteger e recuperar uma instância isolada, o Lab 04 usará os mesmos fundamentos de WAL para construir uma réplica por streaming.

O código, os scripts e as instruções completas estão no [diretório do Lab 03 no GitHub](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/03-backup-restore).

## Referências

- [PostgreSQL: backup e restore](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL: backup SQL](https://www.postgresql.org/docs/current/backup-dump.html)
- [PostgreSQL: backup base](https://www.postgresql.org/docs/current/continuous-archiving.html#BACKUP-BASE-BACKUP)
- [PostgreSQL: arquivamento contínuo e PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
