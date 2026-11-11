---
title: "Media Transcriber"
date: 2026-07-20
weight: 20
draft: false
description: "Aplicação de processamento e transcrição de mídia construída incrementalmente como laboratório prático de Engenharia de Software com Python."
summary: "Laboratório de Engenharia de Software com Python: CLI, conversão de áudio com FFmpeg e testes automatizados, evoluindo até a transcrição de mídia."
project_status: "active"
repo_url: "https://gitlab.com/dirleiflsilva/media-transcriber"
post_links:
  - label: "Post de apresentação"
    url: "/posts/media-transcriber-laboratorio-engenharia-software-python/"
  - label: "Fundação do projeto Python"
    url: "/posts/fundacao-projeto-python-qualidade-ci/"
  - label: "Primeira CLI com testes"
    url: "/posts/cli-python-testes-media-transcriber/"
  - label: "Integração testável com FFmpeg"
    url: "/posts/integrando-ffmpeg-forma-testavel-media-transcriber/"
stack:
  - Python
  - pytest
  - Ruff
  - GitLab CI/CD
  - FFmpeg
highlights:
  - "Evolução incremental guiada por problemas reais"
  - "Conversão com FFmpeg e testes unitários e de integração"
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
- Primeira CLI: [CLI em Python com testes: a primeira funcionalidade do Media Transcriber](/posts/cli-python-testes-media-transcriber/)
- Integração com FFmpeg: [Integrando FFmpeg de forma testável no Media Transcriber](/posts/integrando-ffmpeg-forma-testavel-media-transcriber/)

## Estado atual

- Fundação do projeto concluída e registrada na versão `v0.1.0`
- Primeira CLI de entrada e validação de arquivos disponível na versão `v0.2.0`
- Conversão de áudio e vídeo para WAV PCM de 16 bits, mono e 16 kHz disponível na versão `v0.3.0`, com proteção do destino e testes de integração com FFmpeg
- Testes, cobertura, linting, formatação e análise estática integrados ao fluxo de desenvolvimento
- Pipeline de integração contínua configurada no GitLab
- A série já cobre o processamento de áudio; a integração com transcrição será abordada no próximo incremento

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
