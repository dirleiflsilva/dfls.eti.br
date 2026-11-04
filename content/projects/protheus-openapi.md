---
title: "Protheus OpenAPI"
date: 2026-08-26
weight: 40
lastmod: 2026-11-04
draft: false
description: "Gerador experimental de documentação OpenAPI para APIs REST desenvolvidas em TL++ e AdvPL no TOTVS Protheus."
summary: "Biblioteca experimental em TL++ com descoberta, modelo OpenAPI e serialização separados; núcleo manual mínimo validado em JSON."
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
  - label: "Post técnico (Parte 5)"
    url: "/posts/por-que-criar-modelo-openapi-independente/"
stack:
  - Protheus
  - TL++
  - AdvPL
  - OpenAPI 3.0.3
  - REST
highlights:
  - "Arquitetura com descoberta, modelo e serialização separados"
  - "Núcleo manual mínimo com seis classes TL++ e validação de conflitos"
  - "Geração JSON independente do REST-DOC, validada com PROBAT e HTTP"
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
- Parte 5: [Por que criar um modelo OpenAPI independente](/posts/por-que-criar-modelo-openapi-independente/)
- Série: [Protheus OpenAPI](/series/protheus-openapi/)

## Estado atual

- Endpoints equivalentes em TL++ e AdvPL compilados e validados no ambiente de laboratório
- Geração nativa investigada com `tlpp.doc.generate()`, incluindo limites de descoberta, encoding e paths duplicados
- Normalizador conservador do YAML nativo coberto por 15 testes automatizados
- Descoberta, modelo intermediário e serialização definidos como responsabilidades separadas
- Núcleo manual mínimo com seis classes TL++, rejeição de conflitos e validação acumulada
- Documento JSON do Hello World gerado sem `tlpp.doc.generate()`, com evidências de testes PROBAT e chamadas HTTP

Este resumo acompanha a etapa abordada no artigo de 4 de novembro de 2026. O repositório pode conter incrementos posteriores ainda não apresentados nos artigos.

## Próximas etapas

- Detalhar o desenvolvimento do núcleo com PROBAT e os ciclos RED/GREEN
- Conectar esse modelo a adaptadores para endpoints TL++ e serviços AdvPL baseados em `WSRESTFUL`
- Acrescentar geração YAML à saída JSON já validada
- Acrescentar schemas, exemplos, respostas, segurança e extensões `x-totvs`

## Limites

O projeto é experimental, independente e não oficial. Ele não pretende substituir componentes da TOTVS, extrair fontes de RPOs compilados nem inferir com precisão absoluta payloads construídos dinamicamente.
