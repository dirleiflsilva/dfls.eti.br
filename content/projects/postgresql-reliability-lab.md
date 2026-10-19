---
title: "PostgreSQL Reliability Lab"
date: 2026-04-26
weight: 10
lastmod: 2026-10-19
draft: false
description: "Laboratório prático de confiabilidade em PostgreSQL, com Docker, recuperação, alta disponibilidade e observabilidade validada."
summary: "Projeto autoral de DBRE com PostgreSQL: ambiente reproduzível, recuperação, alta disponibilidade, métricas, logs e alertas validados."
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
  - label: "Post técnico (Lab 05)"
    url: "/posts/postgresql-reliability-lab-lab-05-failover-automatico/"
  - label: "Post técnico (Lab 06)"
    url: "/posts/postgresql-reliability-lab-lab-06-observabilidade/"
stack:
  - PostgreSQL
  - Docker
  - Docker Compose
  - Bash
  - SQL
  - Patroni
  - etcd
  - HAProxy
  - Prometheus
  - Grafana
  - Loki
highlights:
  - "Base reproduzível com Docker Compose, persistência e healthcheck"
  - "Roles, schemas e privilégios separados por responsabilidade"
  - "Backups lógico e físico restaurados em ambientes isolados"
  - "WAL archiving e PITR validados com simulação de incidente"
  - "Replicação assíncrona com leitura em standby e teste de reconexão"
  - "Failover automático com Patroni, etcd e HAProxy"
  - "Métricas, logs estruturados, dashboard e regras de alerta validados ponta a ponta"
tags: ["postgresql", "dbre", "reliability", "labs", "devops"]
categories: ["Projetos & Labs"]
---

## Objetivo

Criar e evoluir um laboratório prático de confiabilidade para PostgreSQL, com foco em operação, padronização e testes de cenários reais.

Os posts vinculados apresentam o **Lab 01 (Foundation)**, o **Lab 02 (Database Initialization)**, o **Lab 03 (Backup & Restore)**, o **Lab 04 (Streaming Replication)**, o **Lab 05 (Automatic Failover)** e o **Lab 06 (Observability)**. O projeto cobre a criação do ambiente, recuperação point-in-time, replicação física, failover automático e observabilidade com métricas e logs estruturados.

## Links

- Repositório: [postgresql-reliability-lab](https://github.com/dirleiflsilva/postgresql-reliability-lab)
- Deep dive técnico (Lab 01): [PostgreSQL Reliability Lab - Lab 01: Ambiente confiável com Docker](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/)
- Deep dive técnico (Lab 02): [PostgreSQL Reliability Lab - Lab 02: Inicialização de banco de dados](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/)
- Deep dive técnico (Lab 03): [Backup não basta — restore, WAL archiving e PITR](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/)
- Implementação (Lab 03): [Backup lógico, backup físico, WAL archiving e PITR](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/03-backup-restore)
- Deep dive técnico (Lab 04): [Streaming Replication no PostgreSQL](/posts/postgresql-reliability-lab-lab-04-streaming-replication/)
- Implementação (Lab 04): [Replicação física assíncrona e teste de reconexão](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/04-replication)
- Deep dive técnico (Lab 05): [Failover automático com Patroni, etcd e HAProxy](/posts/postgresql-reliability-lab-lab-05-failover-automatico/)
- Implementação (Lab 05): [Failover automático e reintegração do antigo líder](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/488cc77/labs/05-failover)
- Deep dive técnico (Lab 06): [Observabilidade com Prometheus, Grafana e Loki](/posts/postgresql-reliability-lab-lab-06-observabilidade/)
- Implementação (Lab 06): [Métricas, logs, dashboards e regras de alerta](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/594ed7b/labs/06-observability)

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
- Failover automático com retomada da escrita pelo mesmo endpoint
- Reintegração do antigo líder como réplica por meio de `pg_rewind`
- Métricas dos dois nós PostgreSQL e do Patroni coletadas pelo Prometheus
- Logs JSON do PostgreSQL ingeridos e consultados no Loki
- Dashboard do Grafana e regras de alerta provisionados automaticamente
- Caminho de telemetria validado ponta a ponta com evidência identificável

## Próximas fases

- Labs seguintes: performance e pipeline de dados
