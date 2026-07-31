---
title: "PostgreSQL Reliability Lab - Lab 03: Backup não basta — restore, WAL archiving e PITR"
date: 2026-08-10
draft: true
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

> **Rascunho condicionado ao gate técnico:** o Lab 03 ainda precisa ser implementado, testado, documentado e publicado no repositório. Comandos, nomes de serviços, tempos e evidências abaixo devem ser conferidos no ambiente definitivo antes da publicação.

No [Lab 02 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/), criamos uma base reproduzível com roles, schemas, extensões, tabelas relacionadas e dados suficientes para exercitar cenários operacionais.

Essa base tornou possível fazer uma pergunta mais importante do que "temos backup?":

> Conseguimos restaurar o banco e recuperar os dados até o ponto necessário depois de uma falha?

Um arquivo de backup que nunca foi restaurado é apenas uma expectativa. Confiabilidade exige procedimento, evidência e conhecimento dos limites de recuperação.

Esse é o objetivo do Lab 03.

## Objetivo

O laboratório deve demonstrar quatro capacidades:

- gerar e restaurar um backup lógico;
- gerar e restaurar uma cópia física do cluster;
- arquivar continuamente os segmentos de WAL;
- recuperar o banco até um instante anterior a uma falha simulada.

O resultado não será apenas um conjunto de comandos. O lab deverá produzir validações que respondam:

- o backup terminou com sucesso?
- o arquivo está legível?
- o restore inicia em uma instância limpa?
- as roles e os objetos esperados foram recuperados?
- o ponto de recuperação foi respeitado?
- quanto tempo cada etapa levou no ambiente do lab?

## Backup e recuperação não são a mesma coisa

Backup é a cópia usada como insumo. Recuperação é a capacidade de reconstruir um estado utilizável dentro dos objetivos definidos.

Duas medidas ajudam a deixar isso concreto:

- **RPO**, ou Recovery Point Objective: quanto dado podemos admitir perder;
- **RTO**, ou Recovery Time Objective: quanto tempo podemos levar para restabelecer o serviço.

Um `pg_dump` gerado uma vez por dia pode ser suficiente para um ambiente que aceita perder quase 24 horas de alterações. Ele não atende sozinho um sistema cujo RPO é de poucos minutos.

No lab, as medições não representarão um SLA de produção. Elas servirão para exercitar o processo e tornar seus custos observáveis.

## Estrutura prevista

> **TODO após implementação:** substituir a árvore abaixo pela estrutura efetivamente publicada.

```text
labs/03-backup-restore/
|-- .env.example
|-- docker-compose.yml
|-- config/
|   `-- postgresql.conf
|-- scripts/
|   |-- backup-logical.sh
|   |-- restore-logical.sh
|   |-- backup-physical.sh
|   |-- restore-pitr.sh
|   `-- check.sh
|-- backups/
|-- wal-archive/
`-- README.md
```

Os artefatos volumosos e dados locais devem permanecer fora do Git. O repositório deve conter scripts, configurações de exemplo e instruções suficientes para reproduzir o cenário.

## Parte 1: backup lógico

O backup lógico representa os objetos do banco por meio de comandos e dados que podem ser restaurados pelo PostgreSQL.

Uma execução em formato custom pode seguir esta linha:

```bash
pg_dump \
  --format=custom \
  --file=/backups/appdb.dump \
  --dbname=appdb
```

O formato custom permite usar `pg_restore`, selecionar objetos e restaurar em paralelo quando o cenário comporta essa opção.

Antes do restore, podemos inspecionar o conteúdo:

```bash
pg_restore --list /backups/appdb.dump
```

O restore deve acontecer em um banco limpo, não sobre a mesma instância que produziu o arquivo:

```bash
createdb appdb_restore

pg_restore \
  --exit-on-error \
  --dbname=appdb_restore \
  /backups/appdb.dump
```

> **TODO técnico:** decidir e documentar como objetos globais, especialmente roles, serão tratados. `pg_dump` cobre um banco; roles e tablespaces exigem estratégia complementar, como `pg_dumpall --globals-only`.

### Validação prevista

O `check.sh` deve comparar pelo menos:

- schemas existentes;
- quantidade e estrutura das tabelas;
- contagens de registros do modelo de e-commerce;
- constraints e índices essenciais;
- execução de consultas de referência.

```sql
SELECT 'app.customers' AS table_name, count(*) FROM app.customers
UNION ALL
SELECT 'app.orders', count(*) FROM app.orders
UNION ALL
SELECT 'app.order_items', count(*) FROM app.order_items
ORDER BY table_name;
```

> **TODO de evidência:** inserir a saída real da validação e o tempo medido de backup e restore.

## Parte 2: backup físico

Uma cópia física representa os arquivos do cluster PostgreSQL. Ao contrário do backup lógico, ela está ligada à arquitetura e à versão principal do servidor.

O PostgreSQL fornece `pg_basebackup` para criar um backup base de um cluster em execução:

```bash
pg_basebackup \
  --host=postgres \
  --username=backup_user \
  --pgdata=/backups/base \
  --format=plain \
  --wal-method=stream \
  --progress
```

O Lab 02 já criou a role `backup_user`, mas seus privilégios, autenticação e acesso de rede precisam ser revistos no contexto deste lab.

> **TODO técnico:** registrar a configuração final de `pg_hba.conf`, os privilégios da role e a forma de fornecer o segredo sem publicá-lo.

## Parte 3: WAL archiving

O Write-Ahead Log registra mudanças antes que elas sejam consolidadas nos arquivos de dados. Ao preservar uma sequência contínua de segmentos de WAL a partir de um backup base, podemos reproduzir alterações posteriores.

A configuração exige, entre outros pontos, habilitar o arquivamento e definir como cada segmento será copiado:

```conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /wal-archive/%f && cp %p /wal-archive/%f'
```

Esse `archive_command` serve como exemplo de laboratório local. Uma estratégia real precisa considerar armazenamento durável, monitoramento, retenção, criptografia, permissões e falhas no destino.

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

> **TODO de evidência:** incluir a consulta executada no lab, a lista dos segmentos arquivados e a validação de que não existem falhas pendentes.

## Parte 4: recuperação point-in-time

Para testar PITR, precisamos de uma linha do tempo observável:

1. criar o backup base;
2. registrar um instante ou ponto de restauração;
3. executar transações válidas;
4. simular uma alteração destrutiva;
5. interromper a instância de origem;
6. restaurar o backup base em outro diretório;
7. configurar a leitura do arquivo de WAL;
8. recuperar até antes da alteração destrutiva;
9. validar os dados e encerrar o modo de recuperação.

Um ponto nomeado ajuda a tornar o exercício reproduzível:

```sql
SELECT pg_create_restore_point('antes_da_exclusao');
```

Depois, simulamos o incidente:

```sql
DELETE FROM app.orders
WHERE created_at < current_date;
```

> **Nunca execute um teste destrutivo em um ambiente real sem autorização, isolamento, proteção e plano de recuperação.** Neste lab, a falha deve ocorrer somente em dados descartáveis.

Na instância restaurada, os parâmetros de recuperação deverão apontar para o arquivo de WAL e para o alvo escolhido:

```conf
restore_command = 'cp /wal-archive/%f %p'
recovery_target_name = 'antes_da_exclusao'
recovery_target_action = 'promote'
```

A presença de `recovery.signal` solicita que o PostgreSQL inicie a recuperação a partir dos WALs disponíveis.

> **TODO técnico:** substituir este fluxo pela configuração e pelos comandos exatos testados na versão do PostgreSQL usada pelo lab.

## Evidências necessárias antes da publicação

| Evidência | Estado do rascunho |
|---|---|
| Commit ou tag do Lab 03 | Pendente |
| Backup lógico restaurado em banco limpo | Pendente |
| Backup físico iniciando em instância separada | Pendente |
| Segmentos de WAL arquivados sem falha | Pendente |
| Restore point anterior ao incidente alcançado | Pendente |
| Contagens e consultas de validação | Pendente |
| Tempos observados de backup e restore | Pendente |
| Limitações e falhas encontradas | Pendente |

## O que este lab deve demonstrar

O principal aprendizado não é decorar `pg_dump` ou `pg_basebackup`.

É entender que uma estratégia de recuperação conecta cópias consistentes, retenção de WAL, armazenamento protegido, automação, monitoramento, testes periódicos e objetivos de RPO e RTO.

Sem restore testado, não existe evidência suficiente de que o backup resolve o problema para o qual foi criado.

## Próximo passo

Depois de proteger e recuperar uma instância isolada, o Lab 04 usará os mesmos fundamentos de WAL para construir uma replica por streaming.

> **TODO:** inserir o link para `labs/03-backup-restore` depois da publicação do gate técnico.

## Referências

- [PostgreSQL: backup e restore](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL: backup SQL](https://www.postgresql.org/docs/current/backup-dump.html)
- [PostgreSQL: backup base](https://www.postgresql.org/docs/current/continuous-archiving.html#BACKUP-BASE-BACKUP)
- [PostgreSQL: arquivamento contínuo e PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)

