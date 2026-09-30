---
title: "Protheus Docker Lab"
date: 2026-07-08
weight: 30
lastmod: 2026-09-30
draft: false
description: "Laboratório Protheus com Docker Compose, PostgreSQL, DBAccess, AppServer e License Server para estudo de ambientes reproduzíveis."
summary: "Projeto autoral para estudar Protheus em Docker com configuração versionada, automação operacional e práticas iniciais de DevOps."
project_status: "completed"
repo_url: "https://github.com/dirleiflsilva/protheus-docker-lab"
post_links:
  - label: "Post técnico (Parte 1)"
    url: "/posts/construindo-um-laboratorio-protheus-com-docker/"
  - label: "Post técnico (Parte 2)"
    url: "/posts/organizando-laboratorio-protheus-docker-compose/"
  - label: "Post técnico (Parte 3)"
    url: "/posts/automatizando-configuracao-local-protheus-docker-lab/"
  - label: "Post técnico (Parte 4)"
    url: "/posts/dados-manutencao-protheus-docker-lab/"
  - label: "Post técnico (Parte 5)"
    url: "/posts/validacao-devops-limites-protheus-docker-lab/"
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
  - "Backup do PostgreSQL e restauração validada em banco separado"
  - "Integração contínua para validar o Compose, a sintaxe Bash e os testes dos scripts"
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
- Parte 3: [Automatizando a configuração local do Protheus Docker Lab](/posts/automatizando-configuracao-local-protheus-docker-lab/)
- Parte 4: [Dados e manutenção no Protheus Docker Lab](/posts/dados-manutencao-protheus-docker-lab/)
- Parte 5: [Validação DevOps e limites do Protheus Docker Lab](/posts/validacao-devops-limites-protheus-docker-lab/)
- [Procedimentos de dados e manutenção do laboratório](https://github.com/dirleiflsilva/protheus-docker-lab/tree/main/docs/parte-4)
- [Validação DevOps e limites do laboratório](https://github.com/dirleiflsilva/protheus-docker-lab/tree/main/docs/parte-5)

## Estado atual

- Ambiente base validado em Docker Compose
- Serviços `license`, `postgres-iniciado`, `dbaccess-postgres` e `appserver` documentados
- Geração automatizada de `dbaccess.ini`, `odbc.ini` e `odbcinst.ini`
- Setup local automatizado com preservação de arquivos de trabalho
- Validação de arquivos, variáveis, portas e coerência entre configurações
- Testes automatizados dos scripts com Docker simulado
- WebApp e porta TCP do AppServer parametrizados via `.env`
- Inventário de persistência e rotina de manutenção documentados
- Backup do PostgreSQL em formato custom e restauração validada em banco separado, sem substituir a origem
- Pausa e retomada com preservação dos contêineres e suas montagens
- Workflow de CI aprovado para validar o Compose com `.env.example`, a sintaxe Bash e os 12 cenários com Docker simulado

## Decisões de engenharia

- Manter artefatos Protheus fora do Git, incluindo RPO e arquivos de `systemload`
- Versionar apenas modelos, scripts e documentação operacional
- Gerar a configuração efetiva do DBAccess com `dbaccesscfg`
- Usar healthcheck no PostgreSQL antes da inicialização do DBAccess
- Usar `stop`/`start` no dia a dia para preservar o contêiner do PostgreSQL e seu volume anônimo; a migração para volume nomeado permanece fora desta etapa
- Tratar o dump como backup do banco, complementado por cópias dos arquivos locais necessários ao ambiente
- Manter o primeiro lab com escopo controlado, sem REST, deploy automático ou observabilidade centralizada

## Encerramento

O roadmap editorial foi organizado em cinco partes:

1. Ambiente Protheus com Docker — validado e publicado
2. Organização do projeto e boas práticas com Docker Compose — validado
3. Automação e configuração local — validado
4. Dados e manutenção do ambiente — validado: backup e restauração em banco separado
5. Validação DevOps e limites do laboratório — validado: integração contínua para os artefatos versionáveis e limites documentados

Com as cinco partes concluídas, o laboratório cumpriu seu objetivo de estudar um ambiente Protheus reproduzível, sua operação e os limites das validações automatizadas.

O projeto está encerrado neste escopo. Evoluções como serviços REST, observabilidade centralizada, pipelines corporativos e integração com fontes AdvPL/TL++ são tecnicamente possíveis, mas não fazem parte deste lab e não justificam ampliar sua complexidade. Esses temas podem ser tratados em laboratórios futuros quando houver um objetivo de aprendizado próprio.
