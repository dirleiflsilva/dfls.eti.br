---
title: "Backup Lógico vs Backup Físico no PostgreSQL: Entenda as Diferenças"
date: 2026-03-30
draft: false
toc: true
slug: "backup-logico-vs-backup-fisico-postgresql"
description: "Entenda as diferenças entre backup lógico e backup físico no PostgreSQL, quando usar cada um e como montar uma estratégia profissional de backup."
tags:
  - postgresql
  - backup
  - database
  - dba
  - engenharia de dados
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
---

## O ponto de partida

Quando começamos a trabalhar com backup no PostgreSQL, a primeira ferramenta que aparece é o `pg_dump`.

Mas rapidamente surge uma dúvida importante:

> Isso é suficiente para produção?

A resposta está diretamente ligada a entender a diferença entre **backup lógico** e **backup físico**. Essas duas abordagens não competem entre si: elas resolvem problemas distintos, e uma estratégia madura usa as duas.

---

## Uma analogia simples

Antes de entrar nos detalhes técnicos, uma analogia ajuda a situar a diferença:

- **Backup lógico** é como exportar uma planilha como CSV: você tem os dados, pode abrir em qualquer lugar, mas perdeu a estrutura original do arquivo.
- **Backup físico** é como copiar o arquivo `.xlsx` diretamente: tudo fica exatamente como estava.

| Tipo   | Analogia                          |
| ------ | --------------------------------- |
| Lógico | Exportar um Excel como CSV        |
| Físico | Copiar o arquivo `.xlsx` original |

---

## Backup Lógico

O backup lógico é baseado na **estrutura lógica do banco**: tabelas, schemas e dados exportados em SQL ou em um formato binário interpretável. As ferramentas principais são `pg_dump` e `pg_dumpall`.

```bash
pg_dump -d meu_banco -F c -f backup.dump
```

```bash
pg_dump -d meu_banco > backup.sql
```

### Pontos fortes

A principal vantagem é a **portabilidade**: é possível restaurar em versões diferentes do PostgreSQL, selecionar apenas tabelas específicas e até versionar o backup junto com o código. É a escolha natural para migrações, exportações pontuais e integrações.

### Limitações

O processo é mais lento, tanto no backup quanto no restore, e os arquivos podem crescer bastante. Mas a limitação mais importante é que **não há suporte a PITR** (Point-In-Time Recovery). Para um ambiente de produção crítico que precisa se recuperar de uma falha em um momento exato, isso é um problema sério.

---

## Backup Físico

O backup físico copia os **arquivos reais do PostgreSQL**: datafiles, WAL (Write-Ahead Log) e toda a estrutura interna do cluster. A ferramenta nativa é o `pg_basebackup`, mas soluções como pgBackRest e Barman são amplamente usadas em ambientes profissionais. Snapshots de volume (LVM, ZFS, cloud) também se enquadram nessa categoria.

```bash
pg_basebackup -D /backup/base -Fp -Xs -P
```

### Pontos fortes

O restore é **muito mais rápido** — você está copiando arquivos de volta, não executando milhares de INSERTs. Mais importante: combinado com arquivamento de WAL, o backup físico habilita o **PITR**, permitindo recuperar o banco em um ponto exato no tempo. É o que viabiliza alta disponibilidade e Disaster Recovery de verdade.

### Limitações

A contrapartida é menor flexibilidade: não é portável entre versões maiores do PostgreSQL, não permite restaurar uma tabela isolada e consome mais espaço. A configuração também é mais complexa, especialmente quando envolve arquivamento contínuo de WAL.

---

## Comparação direta

| Critério      | Backup Lógico | Backup Físico     |
| ------------- | ------------- | ----------------- |
| Nível         | SQL / objetos | Arquivos binários |
| Ferramenta    | pg_dump       | pg_basebackup     |
| Restore       | Mais lento    | Muito rápido      |
| PITR          | ❌             | ✅                 |
| Portabilidade | Alta          | Baixa             |
| Granularidade | Alta          | Baixa             |
| Uso em HA     | ❌             | ✅                 |

---

## Como montar uma estratégia profissional

Backup lógico **não substitui** backup físico — e vice-versa. Eles resolvem problemas diferentes, e a estratégia madura combina os dois:

- **Backup físico diário** com `pg_basebackup` ou pgBackRest para recuperação rápida e suporte a PITR.
- **Arquivamento de WAL** com `archive_mode = on` para viabilizar recuperação ponto-a-tempo.
- **Backup lógico complementar** com `pg_dump` semanal ou por tabela crítica para flexibilidade e portabilidade.

Três erros que aparecem com frequência em ambientes que não seguem essa lógica:

- usar apenas `pg_dump` em bases grandes que precisam de RTO baixo
- não configurar arquivamento de WAL, perdendo a capacidade de PITR
- nunca testar o restore — que é o único jeito de saber se o backup realmente funciona

---

## Conclusão

Backup lógico entrega flexibilidade: você migra, exporta e seleciona partes específicas. Backup físico entrega velocidade e confiabilidade: restauração rápida, PITR e suporte real a alta disponibilidade.

Em produção, a pergunta não é qual dos dois usar. É garantir que os dois estejam configurados, testados e funcionando.

---

## Referências

- https://www.postgresql.org/docs/current/backup.html
- https://www.postgresql.org/docs/current/app-pgdump.html
- https://www.postgresql.org/docs/18/app-pgrestore.html
- https://www.postgresql.org/docs/current/app-pgbasebackup.html
- https://www.postgresql.org/docs/current/continuous-archiving.html
- https://www.postgresql.org/docs/current/runtime-config-wal.html
- https://pgbackrest.org/user-guide.html
- https://pgbarman.org/documentation/

---
