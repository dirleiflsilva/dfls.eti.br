---
title: "PostgreSQL Reliability Lab"
date: 2026-04-26
lastmod: 2026-08-17
draft: false
description: "Laboratório prático de confiabilidade operacional em PostgreSQL, com ambiente reproduzível, backup, restore, WAL archiving e PITR."
summary: "Projeto autoral de DBRE com PostgreSQL: ambiente reproduzível, validações automatizadas e recuperação de dados testada."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/postgresql-reliability-lab"
post_links:
  - label: "Post técnico (Lab 01)"
    url: "/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/"
  - label: "Post técnico (Lab 02)"
    url: "/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/"
  - label: "Post técnico (Lab 03)"
    url: "/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/"
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
tags: ["postgresql", "dbre", "reliability", "labs", "devops"]
categories: ["Projetos & Labs"]
---

## Objetivo

Criar e evoluir um laboratório prático de confiabilidade para PostgreSQL, com foco em operação, padronização e testes de cenários reais.

Os posts vinculados apresentam o **Lab 01 (Foundation)**, o **Lab 02 (Database Initialization)** e o **Lab 03 (Backup & Restore)**. O projeto agora cobre desde a criação do ambiente até backup, restore e recuperação point-in-time.

## Links

- Repositório: [postgresql-reliability-lab](https://github.com/dirleiflsilva/postgresql-reliability-lab)
- Deep dive técnico (Lab 01): [PostgreSQL Reliability Lab - Lab 01: Ambiente confiável com Docker](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/)
- Deep dive técnico (Lab 02): [PostgreSQL Reliability Lab - Lab 02: Inicialização de banco de dados](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/)
- Deep dive técnico (Lab 03): [Backup não basta — restore, WAL archiving e PITR](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/)
- Implementação (Lab 03): [Backup lógico, backup físico, WAL archiving e PITR](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/03-backup-restore)

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

## Próximas fases

- Lab 04: streaming replication com primary e replica
- Lab 05: alta disponibilidade e failover automático
- Labs seguintes: observabilidade, performance e pipeline de dados
