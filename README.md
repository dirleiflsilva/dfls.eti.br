# dfls.eti.br

Meu site pessoal em **Hugo** usando o tema **PaperMod**.

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

- `hugo.yml`: configuração do site
- `content/about/_index.md`: página Sobre
- `assets/css/extended/custom.css`: customizações visuais
- `layouts/partials/`: overrides do PaperMod
- `static/particles/`: scripts de partículas da home

## Observações

- Tema PaperMod via submódulo em `themes/PaperMod`
- Repositório mantido com foco em simplicidade e evolução incremental
