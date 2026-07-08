---
title: "Protheus Docker Lab"
date: 2026-07-08
draft: false
description: "Laboratório Protheus com Docker Compose, PostgreSQL, DBAccess, AppServer e License Server para estudo de ambientes reproduzíveis."
summary: "Projeto autoral para estudar Protheus em Docker com configuração versionada, automação operacional e práticas iniciais de DevOps."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/protheus-docker-lab"
post_links:
  - label: "Post técnico"
    url: "/posts/construindo-um-laboratorio-protheus-com-docker/"
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
categories: ["Projetos/Labs"]
---

## Objetivo

Criar um laboratório Protheus reproduzível para estudo e desenvolvimento, usando Docker Compose para organizar License Server, PostgreSQL, DBAccess e AppServer.

O foco do projeto é reduzir setup manual, versionar configuração de ambiente e registrar decisões operacionais que normalmente ficam dispersas durante a montagem de um ambiente Protheus.

## Links

- Repositório: [protheus-docker-lab](https://github.com/dirleiflsilva/protheus-docker-lab)
- Post técnico: [Construindo um laboratório Protheus com Docker](/posts/construindo-um-laboratorio-protheus-com-docker/)

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

- Organização avançada do projeto e boas práticas com Docker Compose
- Automação com scripts adicionais e Makefile
- Evolução do gerenciamento de configuração com `.env`
- Persistência, backup e restore do PostgreSQL
- Atualização controlada das imagens Protheus
- Integração com GitHub Actions
