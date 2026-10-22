---
title: "Protheus OpenAPI"
date: 2026-08-26
weight: 40
lastmod: 2026-10-21
draft: false
description: "Gerador experimental de documentação OpenAPI para APIs REST desenvolvidas em TL++ e AdvPL no TOTVS Protheus."
summary: "Projeto autoral para aprender TL++ construindo uma ferramenta real de documentação para diferentes gerações de APIs REST Protheus."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/protheus-openapi"
post_links:
  - label: "Post técnico (Parte 1)"
    url: "/posts/protheus-openapi-jornada-tlpp-documentar-apis-rest/"
  - label: "Post técnico (Parte 2)"
    url: "/posts/hello-world-rest-tlpp-annotations-rest-doc/"
  - label: "Post técnico (Parte 3)"
    url: "/posts/tlpp-versus-wsrestful-descoberta-openapi/"
  - label: "Post técnico (Parte 4)"
    url: "/posts/yaml-invalido-encoding-normalizacao-protheus-openapi/"
stack:
  - Protheus
  - TL++
  - AdvPL
  - OpenAPI 3.0.3
  - REST
highlights:
  - "Comparação experimental entre endpoints TL++ e WSRESTFUL"
  - "Diagnóstico de encoding Windows-1252 e paths duplicados no YAML nativo"
  - "Normalização conservadora coberta por 15 testes automatizados"
tags: ["protheus", "tlpp", "advpl", "openapi", "rest", "labs"]
categories: ["Projetos & Labs"]
---

## Objetivo

Estudar e desenvolver uma biblioteca, escrita prioritariamente em TL++, capaz de produzir especificações OpenAPI para APIs REST do Protheus.

O projeto combina uma necessidade real de documentação com uma jornada pública de aprendizado. A proposta é entender os recursos nativos disponíveis, registrar seus limites e investigar uma representação uniforme para endpoints modernos em TL++ e implementações baseadas em `WSRESTFUL` no AdvPL.

## Links

- Repositório: [protheus-openapi](https://github.com/dirleiflsilva/protheus-openapi)
- Parte 1: [Protheus OpenAPI: uma jornada de TL++ para documentar APIs REST](/posts/protheus-openapi-jornada-tlpp-documentar-apis-rest/)
- Parte 2: [Hello World REST em TL++: annotations e geração nativa com REST-DOC](/posts/hello-world-rest-tlpp-annotations-rest-doc/)
- Parte 3: [TL++ versus WSRESTFUL: o que o gerador OpenAPI consegue descobrir](/posts/tlpp-versus-wsrestful-descoberta-openapi/)
- Parte 4: [YAML inválido, encoding e normalização segura no Protheus OpenAPI](/posts/yaml-invalido-encoding-normalizacao-protheus-openapi/)
- Série: [Protheus OpenAPI](/series/protheus-openapi/)

## Estado atual

- Endpoints equivalentes em TL++ e AdvPL compilados e validados no ambiente de laboratório
- Geração nativa investigada com `tlpp.doc.generate()`, incluindo limites de descoberta, encoding e paths duplicados
- Normalizador conservador do YAML nativo coberto por 15 testes automatizados

Este resumo acompanha a evolução publicada na série até 21 de outubro de 2026. O repositório pode conter incrementos posteriores ainda não apresentados nos artigos.

## Próximas etapas

- Criar um modelo OpenAPI independente da saída agregada do REST-DOC
- Conectar esse modelo a adaptadores para endpoints TL++ e serviços AdvPL baseados em `WSRESTFUL`
- Serializar a representação validada em JSON e YAML
- Acrescentar schemas, exemplos, respostas, segurança e extensões `x-totvs`

## Limites

O projeto é experimental, independente e não oficial. Ele não pretende substituir componentes da TOTVS, extrair fontes de RPOs compilados nem inferir com precisão absoluta payloads construídos dinamicamente.
