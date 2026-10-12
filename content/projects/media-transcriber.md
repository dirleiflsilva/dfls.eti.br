---
title: "Media Transcriber"
date: 2026-07-20
weight: 20
draft: false
description: "Aplicação de processamento e transcrição de mídia construída incrementalmente como laboratório prático de Engenharia de Software com Python."
summary: "Projeto autoral para explorar testes, arquitetura, CI/CD e evolução incremental por meio de uma aplicação Python de transcrição de mídia."
project_status: "active"
repo_url: "https://gitlab.com/dirleiflsilva/media-transcriber"
post_links:
  - label: "Post de apresentação"
    url: "/posts/media-transcriber-laboratorio-engenharia-software-python/"
  - label: "Fundação do projeto Python"
    url: "/posts/fundacao-projeto-python-qualidade-ci/"
stack:
  - Python
  - pytest
  - Ruff
  - GitLab CI/CD
  - FFmpeg
highlights:
  - "Evolução incremental guiada por problemas reais"
  - "Fundação planejada com qualidade automatizada"
  - "Roadmap de CLI a uma aplicação self-hosted"
tags: ["python", "engenharia de software", "testes", "ci-cd", "labs"]
categories: ["Projetos & Labs"]
---

## Objetivo

Construir uma aplicação para processar e transcrever arquivos de áudio e vídeo enquanto exploro, de forma prática, o ciclo de desenvolvimento de software com Python.

O projeto deverá evoluir em etapas. Tecnologias, padrões e abstrações serão introduzidos quando ajudarem a resolver problemas concretos, sem antecipar uma arquitetura mais complexa do que a aplicação exige.

## Links

- Repositório: [media-transcriber](https://gitlab.com/dirleiflsilva/media-transcriber)
- Post de apresentação: [De uma ideia abandonada a um laboratório de Engenharia de Software com Python](/posts/media-transcriber-laboratorio-engenharia-software-python/)
- Fundação do projeto: [Como estruturei um projeto Python com qualidade e CI](/posts/fundacao-projeto-python-qualidade-ci/)

## Estado atual

- Fundação do projeto concluída e registrada na versão `v0.1.0`
- Primeira CLI de entrada e validação de arquivos disponível na versão `v0.2.0`
- Testes, cobertura, linting, formatação e análise estática integrados ao fluxo de desenvolvimento
- Pipeline de integração contínua configurada no GitLab
- Funcionalidades de processamento e transcrição ainda não implementadas

## Primeira etapa

A versão `v0.1.0` estabeleceu a fundação do projeto:

- estrutura moderna de projeto Python
- gerenciamento de dependências
- testes automatizados
- linting, formatação e análise estática de tipos
- cobertura de testes
- automação de validações locais
- pipeline inicial no GitLab CI
- documentação do ambiente de desenvolvimento

## Evolução planejada

- entrada e validação de arquivos por uma CLI
- extração de áudio com FFmpeg
- integração com o primeiro mecanismo de transcrição
- revisão da arquitetura após os primeiros casos de uso reais
- containerização
- API HTTP
- persistência com PostgreSQL
- processamento assíncrono
- observabilidade
- primeira versão self-hosted
