---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
description: "Resumo curto do projeto e do problema que ele resolve."
summary: "Ficha técnica do projeto com links e status."
project_status: "active"
repo_url: "https://github.com/seu-usuario/seu-repo"
post_links:
  - label: "Post técnico (Lab 01)"
    url: ""
stack:
  - PostgreSQL
  - Docker
  - Bash
highlights:
  - "Ambiente reproduzível"
  - "Automação de validações"
categories: ["Projetos/Labs"]
---

## Contexto

Explique o problema, escopo e motivação do projeto.

## Decisões de engenharia

Liste as principais decisões técnicas e trade-offs.

## Próximos passos

Registre o roadmap de evolução deste lab.
