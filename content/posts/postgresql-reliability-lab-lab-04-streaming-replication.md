---
title: "PostgreSQL Reliability Lab - Lab 04: Streaming Replication no PostgreSQL"
date: 2026-09-14
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-04-streaming-replication"
description: "Construindo e validando uma réplica física por streaming no PostgreSQL Reliability Lab, com observação de WAL, atraso e limitações operacionais."
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

O [Lab 04 já está disponível no GitHub](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/04-replication). Ele mantém uma réplica física do PostgreSQL atualizada por streaming e permite observar o que acontece quando ela fica temporariamente indisponível.

Depois de exercitar [backup, restore e PITR no Lab 03](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/), o próximo passo é acompanhar alterações continuamente. A replicação envia registros de WAL (Write-Ahead Log, o registro de alterações do PostgreSQL) do servidor principal, ou primary, à réplica, que os reproduz sobre uma cópia física do cluster.

Este artigo acompanha o [Lab 04 do PostgreSQL Reliability Lab](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/04-replication), com os testes e resultados documentados no repositório.

## Uma topologia independente

O ambiente usa PostgreSQL 16 e reaproveita o modelo de e-commerce, as roles, os schemas e a carga dos Labs 02/03. Seus volumes são próprios: os outros laboratórios não precisam estar ligados.

| Serviço | Acesso pelo host | Papel |
|---|---|---|
| `primary` | `127.0.0.1:5437` | Aceita leitura e escrita |
| `replica` | `127.0.0.1:5438` | Hot standby, somente leitura |

Essas são as portas padrão, configuráveis pelo `.env`. O Compose usa uma rede própria e os volumes `primary_data` e `replica_data`.

A replicação é assíncrona: o commit no primary não espera a réplica. Isso permite que o primary continue escrevendo durante uma interrupção dela, mas também admite leituras desatualizadas. Se o primary falhar e a réplica for promovida, commits cujo WAL ainda não chegou a ela podem ser perdidos. WAL já recebido e disponível localmente é aplicado antes de concluir a promoção; atraso de replay, por si só, não significa perda desses commits.

## Subindo o laboratório

Com Docker Compose e Bash disponíveis, execute a partir da raiz do repositório `postgresql-reliability-lab`:

```bash
cd labs/04-replication
cp -n .env.example .env
```

Edite o `.env` e substitua as três senhas de exemplo antes de iniciar. As credenciais são aplicadas na criação inicial do volume; editar o arquivo não troca a senha de uma role já existente.

```bash
docker compose up -d --wait --wait-timeout 150
bash scripts/check.sh
bash scripts/status.sh
```

O healthcheck verifica disponibilidade e, na réplica, recuperação. A validação funcional fica com `check.sh`: uma réplica pode aceitar consultas mesmo sem receber novas alterações do primary.

## Como a réplica é criada

O script `start-replica.sh` faz o bootstrap, a criação inicial da réplica, com `pg_basebackup` somente quando ainda não existe um cluster no volume. A opção `--write-recovery-conf`, equivalente a `-R`, grava a configuração de recuperação e cria `standby.signal`.

O backup é preparado em um diretório temporário no mesmo volume e só é colocado no local definitivo após terminar. Em reinicializações, os dados existentes são reutilizados. Se o volume contém um cluster sem `standby.signal`, o script recusa a inicialização para evitar que ele suba como outro primary.

A role de replicação é `replicator`, com autenticação SCRAM. A senha fica em um passfile de modo `0600`, recriado em `/tmp` no contêiner, e não em `primary_conninfo`.

Os parâmetros publicados no Compose incluem:

```conf
wal_level = replica
max_wal_senders = 5
max_replication_slots = 5
max_slot_wal_keep_size = 1GB
hot_standby = on
```

São escolhas deste laboratório. O slot físico `lab04_replica` é criado no primary e usado tanto pelo backup base quanto pelo streaming, protegendo o intervalo entre essas etapas.

## Conferindo os dois lados

Abra uma sessão no primary:

```bash
docker compose exec primary psql -U postgres -d appdb
```

Ajuste usuário e banco se alterou o `.env`. Consulte:

```sql
SELECT pg_is_in_recovery();

SELECT application_name, state, sync_state, replay_lsn
FROM pg_stat_replication;

SELECT slot_name, active, wal_status
FROM pg_replication_slots;
```

O primary deve estar fora de recuperação. A conexão da réplica deve aparecer em `streaming`, com `sync_state` igual a `async`, e o slot deve estar ativo.

Na réplica:

```bash
docker compose exec replica psql -U postgres -d appdb
```

```sql
SELECT pg_is_in_recovery();
SHOW transaction_read_only;
SELECT status, slot_name, latest_end_lsn FROM pg_stat_wal_receiver;
SELECT count(*) FROM app.orders;
```

Aqui esperamos recuperação verdadeira, `transaction_read_only` em `on` e o receptor de WAL em streaming. Essas consultas mostram o estado atual; o script de verificação também testa a propagação de uma escrita.

## Uma escrita precisa chegar ao outro lado

O `check.sh` verifica estrutura, integridade, proprietários dos objetos, privilégios e fingerprints (resumos usados para comparar os dados). Ele insere uma linha de teste, chamada sentinela, em `audit.replication_probe`, aguarda a aplicação do WAL até o LSN de referência e confere sua chegada à réplica. O LSN identifica uma posição no WAL.

A espera tem limite de 60 segundos. O script também verifica que uma tentativa de escrita na réplica falha com SQLSTATE `25006`, inclusive como superusuário. Ao final de uma execução bem-sucedida, exibe:

```text
ok: primary, réplica read-only, slot, streaming, dados e propagação validados.
```

Execute os testes sem escritas concorrentes nos dados de e-commerce, pois os fingerprints são calculados em consultas separadas. As sentinelas são removidas após sucesso; uma execução interrompida pode deixar uma linha de diagnóstico.

## Interrompendo e retomando a réplica

```bash
bash scripts/reconnect_demo.sh
```

Esse roteiro valida a base, para a réplica, grava uma sentinela no primary, reinicia a réplica e verifica se a alteração chegou. Também tenta religá-la quando ocorre uma falha no teste.

O exercício causa uma breve indisponibilidade de leitura na réplica. Seu objetivo é observar o primary continuando a escrever e o standby recuperando o trabalho pendente ao reconectar.

## Atraso e retenção de WAL

O `status.sh` apresenta posições de WAL, diferença em bytes e WAL retido pelo slot. Uma inspeção manual no primary pode usar:

```sql
SELECT
    application_name,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;
```

Essa diferença indica a distância em bytes entre o WAL atual do primary e a última posição de replay informada pela réplica; ela inclui alterações ainda em trânsito ou aguardando aplicação. Não é uma estimativa de tempo para a réplica alcançar o primary. Se a conexão estiver ausente, a consulta pode não retornar linhas, o que não significa atraso zero. Já o tempo desde a última transação reproduzida pode aumentar em uma base ociosa sem indicar alterações pendentes.

O slot evita que WAL necessário seja removido cedo demais, mas exige acompanhamento. `max_slot_wal_keep_size=1GB` limita a retenção pelo slot no checkpoint; não é um teto rígido para o uso de disco. Se a réplica ficar parada por tempo suficiente, pode perder o WAL de que precisa e exigir novo bootstrap.

## O que foi validado

O [registro de validação do Lab 04](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/62a7e781ea08087b46a801f63ea5a498a6a3b10e/labs/04-replication/README.md#validação) informa status concluído e confirmação manual em 12/09/2026.

O mesmo registro documenta, em 07/09/2026, configuração aceita pelo Compose, inicialização com volumes novos e ambos os serviços saudáveis, verificação de sintaxe dos scripts e execução bem-sucedida do roteiro de reconexão. A escrita feita durante a parada foi reproduzida após a retomada.

Para pausar e retomar o ambiente preservando os volumes:

```bash
docker compose stop
docker compose up -d --wait
bash scripts/check.sh
```

## Backup e failover continuam sendo responsabilidades separadas

Uma exclusão acidental confirmada no primary também chega à réplica. Backup e PITR continuam necessários para recuperar estados anteriores.

O laboratório tampouco promove a réplica automaticamente quando o primary para. Detectar falhas, decidir uma promoção, redirecionar clientes e impedir dois primaries exigem coordenação adicional. Esses temas ficam para o Lab 05.

O resultado desta etapa é uma topologia executável para estudar streaming assíncrono, leitura em standby, retenção de WAL e recuperação após uma interrupção.

## Referências

- [Lab 04: código e roteiro de execução](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/62a7e781ea08087b46a801f63ea5a498a6a3b10e/labs/04-replication)
- [PostgreSQL 16: streaming replication e hot standby](https://www.postgresql.org/docs/16/warm-standby.html)
- [PostgreSQL 16: pg_basebackup](https://www.postgresql.org/docs/16/app-pgbasebackup.html)
- [PostgreSQL 16: configuração de replicação](https://www.postgresql.org/docs/16/runtime-config-replication.html)
