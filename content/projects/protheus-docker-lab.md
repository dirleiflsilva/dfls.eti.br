---
title: "Protheus Docker Lab"
date: 2026-07-08
lastmod: 2026-08-18
draft: false
description: "Laboratório Protheus com Docker Compose, PostgreSQL, DBAccess, AppServer e License Server para estudo de ambientes reproduzíveis."
summary: "Projeto autoral para estudar Protheus em Docker com configuração versionada, automação operacional e práticas iniciais de DevOps."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/protheus-docker-lab"
post_links:
  - label: "Post técnico (Parte 1)"
    url: "/posts/construindo-um-laboratorio-protheus-com-docker/"
  - label: "Post técnico (Parte 2)"
    url: "/posts/organizando-laboratorio-protheus-docker-compose/"
stack:
  - Protheus
  - Docker
  - Docker Compose
  - PostgreSQL
  - DBAccess
  - Bash
highlights:
  - "Ambiente Protheus reproduzível com Docker Compose"
  - "DBAccess e ODBC gerados por script para evitar configuração manual frágil"
  - "Validação operacional antes da subida do laboratório"
tags: ["protheus", "docker", "devops", "postgresql", "labs"]
categories: ["Projetos & Labs"]
---

## Objetivo

Criar um laboratório Protheus reproduzível para estudo e desenvolvimento, usando Docker Compose para organizar License Server, PostgreSQL, DBAccess e AppServer.

O foco do projeto é reduzir setup manual, versionar configuração de ambiente e registrar decisões operacionais que normalmente ficam dispersas durante a montagem de um ambiente Protheus.

## Links

- Repositório: [protheus-docker-lab](https://github.com/dirleiflsilva/protheus-docker-lab)
- Post técnico: [Construindo um laboratório Protheus com Docker](/posts/construindo-um-laboratorio-protheus-com-docker/)
- Parte 2: [Organizando um laboratório Protheus: boas práticas com Docker Compose](/posts/organizando-laboratorio-protheus-docker-compose/)

## Estado atual

- Ambiente base validado em Docker Compose
- Serviços `license`, `postgres-iniciado`, `dbaccess-postgres` e `appserver` documentados
- Geração automatizada de `dbaccess.ini`, `odbc.ini` e `odbcinst.ini`
- Script de validação para arquivos obrigatórios antes da subida
- WebApp e porta TCP do AppServer parametrizados via `.env`

## Decisões de engenharia

- Manter artefatos Protheus fora do Git, incluindo RPO e arquivos de `systemload`
- Versionar apenas modelos, scripts e documentação operacional
- Gerar a configuração efetiva do DBAccess com `dbaccesscfg`
- Usar healthcheck no PostgreSQL antes da inicialização do DBAccess
- Manter o primeiro lab com escopo controlado, sem REST, CI/CD ou observabilidade

## Próximas fases

O roadmap editorial foi organizado em cinco partes:

1. Ambiente Protheus com Docker — validado e publicado
2. Organização do projeto e boas práticas com Docker Compose — validado
3. Automação e configuração local — planejado
4. Dados e manutenção do ambiente — planejado
5. Validação DevOps e limites do laboratório — planejado

Serviços REST, observabilidade centralizada, pipelines corporativos e integração com fontes AdvPL/TL++ ficam reservados para laboratórios futuros, mantendo este primeiro ambiente simples e estável.
