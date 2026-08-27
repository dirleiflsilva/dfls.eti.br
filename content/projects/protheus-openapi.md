---
title: "Protheus OpenAPI"
date: 2026-08-26
lastmod: 2026-08-26
draft: false
description: "Gerador experimental de documentação OpenAPI para APIs REST desenvolvidas em TL++ e AdvPL no TOTVS Protheus."
summary: "Projeto autoral para aprender TL++ construindo uma ferramenta real de documentação para diferentes gerações de APIs REST Protheus."
project_status: "active"
repo_url: "https://github.com/dirleiflsilva/protheus-openapi"
stack:
  - Protheus
  - TL++
  - AdvPL
  - OpenAPI 3.0.3
  - REST
highlights:
  - "Comparação experimental entre endpoints TL++ e WSRESTFUL"
  - "Núcleo OpenAPI 3.0.3 independente com validação e serialização JSON"
  - "Testes TL++ com PROBAT, contratos estáticos e documentação pública"
tags: ["protheus", "tlpp", "advpl", "openapi", "rest", "labs"]
categories: ["Projetos & Labs"]
---

## Objetivo

Estudar e desenvolver uma biblioteca, escrita prioritariamente em TL++, capaz de produzir especificações OpenAPI para APIs REST do Protheus.

O projeto combina uma necessidade real de documentação com uma jornada pública de aprendizado. A proposta é entender os recursos nativos disponíveis, registrar seus limites e investigar uma representação uniforme para endpoints modernos em TL++ e implementações baseadas em `WSRESTFUL` no AdvPL.

## Links

- Repositório: [protheus-openapi](https://github.com/dirleiflsilva/protheus-openapi)

## Estado atual

- Endpoints equivalentes em TL++ e AdvPL compilados e validados no ambiente de laboratório
- Geração nativa investigada com `tlpp.doc.generate()`, incluindo limites de descoberta, encoding e paths duplicados
- Normalizador conservador do YAML nativo coberto por 15 testes automatizados
- Núcleo mínimo concluído com seis classes para representar, validar e serializar OpenAPI 3.0.3 em JSON
- Testes TL++ executados com PROBAT e contratos estáticos mantidos em PowerShell
- Endpoint de demonstração publicado sem dependência de `tlpp.doc.generate()`

## Próximas etapas

- Descobrir progressivamente endpoints TL++ com annotations
- Interpretar fontes AdvPL baseados em `WSRESTFUL`
- Acrescentar schemas, exemplos, respostas, segurança e extensões `x-totvs`
- Automatizar testes, validação e uma demonstração com Swagger UI

## Limites

O projeto é experimental, independente e não oficial. Ele não pretende substituir componentes da TOTVS, extrair fontes de RPOs compilados nem inferir com precisão absoluta payloads construídos dinamicamente.
