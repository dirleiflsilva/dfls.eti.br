---
title: "PostgreSQL Reliability Lab"
date: 2026-04-26
weight: 10
lastmod: 2026-09-14
draft: false
description: "Laboratório prático de confiabilidade em PostgreSQL, com Docker, backup, restore, PITR e replicação física por streaming."
summary: "Projeto autoral de DBRE com PostgreSQL: ambiente reproduzível, recuperação de dados testada e replicação assíncrona validada."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/postgresql-reliability-lab"
post_links:
  - label: "Post técnico (Lab 01)"
    url: "/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/"
  - label: "Post técnico (Lab 02)"
    url: "/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/"
  - label: "Post técnico (Lab 03)"
    url: "/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/"
  - label: "Post técnico (Lab 04)"
    url: "/posts/postgresql-reliability-lab-lab-04-streaming-replication/"
stack:
  - PostgreSQL
  - Docker
  - Docker Compose
  - Bash
  - SQL
highlights:
  - "Base reproduzível com Docker Compose, persistência e healthcheck"
  - "Roles, schemas e privilégios separados por responsabilidade"
  - "Backups lógico e físico restaurados em ambientes isolados"
  - "WAL archiving e PITR validados com simulação de incidente"
  - "Replicação assíncrona com leitura em standby e teste de reconexão"
tags: ["postgresql", "dbre", "reliability", "labs", "devops"]
categories: ["Projetos & Labs"]
---

## Objetivo

Criar e evoluir um laboratório prático de confiabilidade para PostgreSQL, com foco em operação, padronização e testes de cenários reais.

Os posts vinculados apresentam o **Lab 01 (Foundation)**, o **Lab 02 (Database Initialization)**, o **Lab 03 (Backup & Restore)** e o **Lab 04 (Streaming Replication)**. O projeto cobre a criação do ambiente, backup, restore, recuperação point-in-time e replicação física assíncrona, com validação da propagação de escritas e da retomada após uma interrupção da réplica.

## Links

- Repositório: [postgresql-reliability-lab](https://github.com/dirleiflsilva/postgresql-reliability-lab)
- Deep dive técnico (Lab 01): [PostgreSQL Reliability Lab - Lab 01: Ambiente confiável com Docker](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/)
- Deep dive técnico (Lab 02): [PostgreSQL Reliability Lab - Lab 02: Inicialização de banco de dados](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/)
- Deep dive técnico (Lab 03): [Backup não basta — restore, WAL archiving e PITR](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/)
- Implementação (Lab 03): [Backup lógico, backup físico, WAL archiving e PITR](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/03-backup-restore)
- Deep dive técnico (Lab 04): [Streaming Replication no PostgreSQL](/posts/postgresql-reliability-lab-lab-04-streaming-replication/)
- Implementação (Lab 04): [Replicação física assíncrona e teste de reconexão](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/04-replication)

## Estado atual

- Foundation pronta com Docker
- Inicialização ordenada de roles, extensões, schemas e tabelas
- Modelo de e-commerce com massa de dados reproduzível
- Validação automatizada do estado operacional e dos dados
- Backup lógico restaurado em banco separado
- Backup físico restaurado em container isolado
- WAL archiving validado com publicação atômica dos segmentos
- PITR validado por timestamp anterior a um incidente simulado
- Teste destrutivo de repetição com rejeição de backups parciais
- Réplica física por streaming com slot de replicação e leitura em hot standby
- Propagação de escritas e rejeição de escrita na réplica verificadas
- Retomada da replicação após interrupção validada, com acompanhamento de WAL

## Próximas fases

- Lab 05: alta disponibilidade e failover automático
- Labs seguintes: observabilidade, performance e pipeline de dados
