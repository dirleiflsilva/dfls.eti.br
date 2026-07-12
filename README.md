# dfls.eti.br

Site pessoal em **Hugo** usando o tema **PaperMod**, com foco em conteúdo técnico sobre **PostgreSQL**, **Data Platform Engineering**, **Reliability**, **Automation** e **ERP Protheus**.

## Rodar localmente

```bash
hugo server -D --disableFastRender
```

Acesse: `http://localhost:1313`

## Build de produção

```bash
hugo
```

Saída em: `public/`

## Estrutura principal

- `hugo.yml`: configuração central do site, tema, menus, integrações, taxonomias e recursos do PaperMod
- `content/posts/`: posts do blog
- `content/projects/`: páginas de projetos e labs
- `content/about/_index.md`: página Sobre
- `content/contact/`: página de contato e página de obrigado
- `content/search.md`: página de busca local
- `assets/css/extended/custom.css`: customizações visuais aplicadas sobre o PaperMod
- `layouts/`: overrides e partials customizados do tema
- `static/particles/`: scripts de partículas usados na home
- `static/images/posts/`: imagens dos posts

## Recursos configurados

### Tema e experiência de leitura

- Tema **PaperMod** via submódulo em `themes/PaperMod`
- Tema claro como padrão, com alternância claro/escuro habilitada
- Data em formato brasileiro (`02/01/2006`)
- Tempo de leitura habilitado (`ShowReadingTime`)
- Contagem de palavras habilitada (`ShowWordCount`)
- Breadcrumbs habilitados (`ShowBreadCrumbs`)
- Navegação entre posts habilitada (`ShowPostNavLinks`)
- Botões de compartilhamento habilitados (`ShowShareButtons`)
- Botão de copiar código habilitado (`ShowCodeCopyButtons`)
- Sumário automático nos posts com o TOC do Hugo (`UseHugoToc`, `showtoc`)
- Links externos abrem em nova aba com `noopener noreferrer`
- Headings ancorados nos posts, herdando o comportamento do PaperMod

### Comentários com Giscus

Os comentários usam **Giscus**, configurado em `params.giscus` no `hugo.yml`.

Configuração atual:

- repositório: `dirleiflsilva/dfls.eti.br`
- categoria: `General`
- mapeamento: `pathname`
- idioma: `pt`
- tema: `preferred_color_scheme`
- reações habilitadas
- campo de comentário no topo

O partial responsável é `layouts/partials/comments.html`. Os comentários só aparecem em páginas da seção `posts` e quando `comments: true` está habilitado.

### Formulário de contato com Formspree

A página de contato usa **Formspree** como backend de envio.

- Endpoint configurado em `params.formspree.endpoint`
- Template em `layouts/contact/list.html`
- Envio feito via `fetch` com `Accept: application/json`
- Campo `_gotcha` usado como honeypot anti-spam
- Redirecionamento para `/contact/obrigado/` após envio com sucesso
- Mensagens de erro simples para falha de envio ou conexão

### Google Analytics

O site usa **Google Analytics 4** pelo serviço nativo do Hugo:

- ID configurado em `services.googleAnalytics.id`
- `privacy.googleAnalytics.respectDoNotTrack: true`
- carregamento condicionado ao build de produção, conforme comportamento do PaperMod/Hugo

### Busca local

A busca está habilitada pela saída `JSON` na home:

```yaml
outputs:
  home:
    - HTML
    - RSS
    - JSON
```

A página fica em `content/search.md` com layout `search`, usando a busca local do PaperMod baseada em índice JSON/Fuse.

### Posts relacionados

Posts relacionados estão habilitados por `ShowRelatedPosts: true` e renderizados por `layouts/partials/related_posts.html`.

A relação é calculada pelo Hugo com os pesos definidos em `related`:

- `tags`: peso 100
- `categories`: peso 80
- `date`: peso 10

São exibidos até 5 posts relacionados.

### Mermaid

Diagramas **Mermaid** são carregados sob demanda em `layouts/partials/extend_head.html`.

O script só é incluído quando a página contém bloco Markdown com:

````markdown
```mermaid
```
````

Isso evita carregar a biblioteca em páginas que não usam diagramas.

### Home

A home usa `homeInfoParams` do PaperMod e scripts de partículas carregados apenas na página inicial por `layouts/partials/extend_footer.html`.

`params.mainSections` permanece vazio de forma intencional. Isso mantém a home como apresentação profissional, sem duplicar nela a listagem disponível em `/posts/`. A seção Blog possui metadados próprios em `content/posts/_index.md` e também serve como base para um futuro arquivo cronológico exclusivo de posts.

O menu principal aponta para:

- Blog
- Projetos/Labs
- Busca
- Sobre
- Contato

### SEO, feeds e publicação

- `baseURL`: `https://dfls.eti.br/`
- `enableRobotsTXT: true`
- RSS habilitado na home
- saída JSON habilitada para busca
- minificação de saída habilitada em produção
- metadados de título, descrição, autor e palavras-chave configurados em `params`
- taxonomias de `tags` e `categories`
- arquivo `static/CNAME` para domínio customizado

### Internacionalização

Há traduções locais em `i18n/pt-br.yaml` para textos customizados, como:

- TOC: `Conteúdos`
- Posts relacionados: `Posts Relacionados`

## Front matter recomendado para posts

Exemplo base:

```yaml
---
title: "Título do post"
date: 2026-05-03
draft: false
toc: true
description: "Resumo curto usado em listagens e metadados."
tags:
  - postgresql
  - protheus
categories:
  - Banco de Dados
---
```

Campos úteis:

- `draft`: controla publicação
- `toc`: permite controlar o sumário por post
- `description`: melhora listagem, SEO e compartilhamento
- `tags` e `categories`: alimentam taxonomias e posts relacionados
- `disableShare: true`: desativa botões de compartilhamento em um post específico
- `showrelatedposts: false`: desativa posts relacionados em um post específico
- `comments: false`: desativa comentários em uma página específica

## Observações

- O projeto é mantido com foco em simplicidade e evolução incremental
- Preferir customizações em `assets/css/extended/custom.css` e `layouts/` em vez de alterar arquivos diretamente dentro de `themes/PaperMod`
- Recursos globais ficam centralizados em `hugo.yml`
