---
title: "PostgreSQL Reliability Lab"
date: 2026-04-26
draft: false
description: "Laboratório prático para evoluir confiabilidade operacional em PostgreSQL, do baseline a cenários avançados."
summary: "Projeto autoral focado em DBRE com PostgreSQL: reprodução de ambiente, validações e roadmap de confiabilidade."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/postgresql-reliability-lab"
post_links:
  - label: "Post técnico (Lab 01)"
    url: "/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/"
  - label: "Post técnico (Lab 02)"
    url: "/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/"
stack:
  - PostgreSQL
  - Docker
  - Docker Compose
  - Bash
  - SQL
highlights:
  - "Base reproduzível com Docker Compose, persistência e healthcheck"
  - "Roles, schemas e privilégios separados por responsabilidade"
  - "Modelo de e-commerce com carga e validação automatizadas"
tags: ["postgresql", "dbre", "reliability", "labs", "devops"]
categories: ["Projetos & Labs"]
---

## Objetivo

Criar e evoluir um laboratório prático de confiabilidade para PostgreSQL, com foco em operação, padronização e testes de cenários reais.

Os posts vinculados apresentam o **Lab 01 (Foundation)** e o **Lab 02 (Database Initialization)**. Juntos, eles entregam uma instância reproduzível e uma base realista para os próximos cenários de confiabilidade.

## Links

- Repositório: [postgresql-reliability-lab](https://github.com/dirleiflsilva/postgresql-reliability-lab)
- Deep dive técnico (Lab 01): [PostgreSQL Reliability Lab - Lab 01: Ambiente confiável com Docker](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/)
- Deep dive técnico (Lab 02): [PostgreSQL Reliability Lab - Lab 02: Inicialização de banco de dados](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/)

## Estado atual

- Foundation pronta com Docker
- Inicialização ordenada de roles, extensões, schemas e tabelas
- Modelo de e-commerce com massa de dados reproduzível
- Validação automatizada do estado operacional e dos dados

## Próximas fases

- Lab 03: backup lógico, backup físico, WAL archiving e recuperação point-in-time
- Lab 04: streaming replication com primary e replica
- Lab 05: alta disponibilidade e failover automático
- Labs seguintes: observabilidade, performance e pipeline de dados
