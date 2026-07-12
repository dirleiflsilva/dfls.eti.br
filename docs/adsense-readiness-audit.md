# Auditoria de Preparação para Google AdSense

**Data da auditoria:** 12/07/2026  
**Escopo:** configuração Hugo, tema PaperMod, layouts/partials locais, conteúdo versionado, assets estáticos e HTML produzido por um build limpo.  
**Método:** inspeção estática do repositório, `hugo --destination /tmp/dfls-adsense-audit --cleanDestinationDir`, análise do HTML resultante e validação de 621 referências internas. Não foram feitas alterações funcionais no site.

## Resumo Executivo

**Avaliação geral: Parcialmente pronto.**

O site tem boa base técnica e editorial: domínio e `baseURL` coerentes, HTTPS como URL canônica, navegação clara, páginas Sobre e Contato, dez artigos publicados com conteúdo substancial, dois projetos, metadados essenciais, sitemap e robots.txt. O build com Hugo 0.152.2 terminou sem erros e a verificação local não encontrou links internos quebrados.

Ainda não é recomendável solicitar o AdSense. Faltam uma Política de Privacidade pública e informações sobre cookies, terceiros e publicidade. Além disso, Google Analytics 4 já é carregado globalmente sem mecanismo de consentimento, e Giscus, Formspree, Google Fonts e jsDelivr também devem ser descritos. Antes da solicitação, é preciso definir uma solução de consentimento compatível com a audiência atendida e fazer com que Analytics e, futuramente, AdSense respeitem essa escolha.

## Checklist

| Status | Item | Situação atual | Ação recomendada | Prioridade |
|---|---|---|---|---|
| ✅ OK | Página Sobre | `content/about/_index.md`, URL `/about/`; conteúdo e descrição presentes no HTML | Manter acessível no menu | Baixa |
| ✅ OK | Página Contato | `content/contact/_index.md` + `layouts/contact/list.html`, URL `/contact/`; formulário funcionalmente estruturado via Formspree | Informar na política o tratamento de nome, e-mail e mensagem | Média |
| ❌ Ausente | Política de Privacidade | Não há arquivo, rota ou item de navegação correspondente | Criar página institucional e link persistente no rodapé antes da solicitação | Alta |
| ❌ Ausente | Política de Cookies | Não há arquivo ou seção equivalente | Criar página própria ou seção claramente identificada dentro da Política de Privacidade | Alta |
| ⚠️ Parcial | Transparência sobre terceiros | GA4, Giscus, Formspree, Google Fonts e jsDelivr são usados, mas não estão explicados ao visitante | Documentar finalidades, dados, fornecedores, links e bases/controles aplicáveis | Alta |
| ⚠️ Parcial | Consentimento atual | Não existe banner/CMP; GA4 é carregado globalmente | Implantar CMP/consentimento e impedir Analytics antes da escolha quando exigido | Alta |
| ⚠️ Parcial | Cookies/armazenamento próprio | O tema grava `pref-theme`, `pref-theme-default-light-v1` e `menu-scroll-position` em `localStorage` | Classificar como armazenamento funcional e documentar | Média |
| ✅ OK | Analytics identificável | GA4 está configurado em `services.googleAnalytics.id` (`G-ZK13WF1R2S`) e respeita DNT | Integrá-lo ao consentimento; DNT sozinho não substitui consentimento | Alta |
| ✅ OK | Ponto global de integração | `layouts/partials/extend_head.html` é chamado pelo `head.html` do tema em todas as páginas | Criar partial dedicado e chamá-lo condicionalmente pelo `extend_head.html` | Média |
| ⚠️ Parcial | Configuração por ambiente | `params.env: production` força recursos de produção mesmo em build local comum | Condicionar AdSense a `hugo.IsProduction` e a um parâmetro explícito; usar `hugo server -e development` | Alta |
| ✅ OK | Conteúdo publicado | 10 posts não draft, aproximadamente 542–1.723 palavras cada; nenhum post vazio ou de teste detectado | Manter consistência editorial | Baixa |
| ⚠️ Parcial | Projetos | Dois projetos publicados; um deles tem cerca de 112 palavras, mas apresenta estado, stack e repositório | Expandir evidências/resultados quando houver material real | Baixa |
| ✅ OK | Links internos | 621 referências locais verificadas no build; nenhuma quebrada | Adicionar verificação à CI para prevenir regressões | Baixa |
| ✅ OK | Taxonomias | Conteúdo e archetype padronizados em `Projetos & Labs`; somente `/categories/projetos--labs/` é gerada | Manter a categoria padronizada em novos conteúdos | Baixa |
| ✅ OK | Títulos e descrições | Home, posts, projetos, Sobre, Contato e Obrigado geram `<title>` e meta description | Revisar apenas páginas automáticas de taxonomia/feeds | Baixa |
| ✅ OK | Canonical e Open Graph | PaperMod gera canonical absoluto, Open Graph, Twitter Cards e JSON-LD em produção | Manter `baseURL` correto por ambiente | Baixa |
| ✅ OK | Sitemap e robots.txt | `/sitemap.xml` e `/robots.txt` são gerados; robots permite rastreamento e aponta o sitemap | Manter | Baixa |
| ✅ OK | Favicon | Os cinco assets esperados pelo PaperMod foram derivados do ícone SVG existente e são gerados corretamente | Manter os arquivos ao alterar a identidade visual | Baixa |
| ✅ OK | `baseURL` e domínio | `https://dfls.eti.br/` e `static/CNAME` (`dfls.eti.br`) são coerentes | Manter | Baixa |
| ✅ OK | Segredos versionados | Nenhum `.env`, chave privada, token de formatos comuns ou credencial real foi localizado | Manter varredura; exemplos de senhas devem continuar claramente fictícios | Média |
| ✅ OK | `.gitignore` | Marcadores de conflito removidos; regras de ambiente, editor, build e arquivos temporários foram preservadas | Manter livre de conflitos | Baixa |
| ✅ OK | `noindex` da página Obrigado | `content/contact/obrigado.md` define `robotsNoIndex = true`; HTML gera `noindex, nofollow` | Manter a página acessível, sem bloqueá-la no robots.txt | Baixa |
| ✅ OK | Peso de imagens | Maior imagem estática tem cerca de 101 KB; nenhuma imagem excessivamente pesada foi detectada | Manter compressão proporcional | Baixa |
| ⚠️ Parcial | Scripts e recursos externos | GA4 é global; partículas (47 KB) só na home; Giscus só em posts; Mermaid/jsDelivr só em páginas com Mermaid; Google Fonts é global | Não adicionar AdSense fora de páginas elegíveis; considerar fonte local apenas se métricas justificarem | Média |
| ℹ️ Opcional | Consent Mode | Não existe | Usar Consent Mode com a CMP para propagar escolhas ao GA4 e AdSense | Média |
| ℹ️ Opcional | Anúncio no meio do artigo | Não existe | Considerar somente em artigos longos, com regra explícita no front matter | Baixa |

## 1. Estrutura básica do site

| Página | Arquivo responsável | URL gerada | Status | Melhoria recomendada |
|---|---|---|---|---|
| Sobre | `content/about/_index.md` (renderizado pelo list template do PaperMod) | `https://dfls.eti.br/about/` | OK | Nenhuma mudança estrutural necessária |
| Contato | `content/contact/_index.md` e `layouts/contact/list.html` | `https://dfls.eti.br/contact/` | OK | Explicar Formspree e retenção/uso dos dados na política |
| Política de Privacidade | inexistente | inexistente | Ausente | Criar `content/privacy/_index.md` ou equivalente e expor no rodapé |
| Política de Cookies | inexistente | inexistente | Ausente | Criar `content/cookies/_index.md` ou incorporar seção completa à política de privacidade |

`content/contact/obrigado.md` também gera `/contact/obrigado/`; é uma página curta por finalidade, não um conteúdo editorial incompleto. Ela define `robotsNoIndex = true` e gera `<meta name="robots" content="noindex, nofollow">`, continuando acessível sem ser bloqueada no robots.txt.

## 2. Política de Privacidade

Não existe política atual; portanto, todos os pontos abaixo estão ausentes:

- uso de cookies e de `localStorage`;
- serviços de terceiros (Google Analytics, Giscus/GitHub, Formspree, Google Fonts e jsDelivr/Mermaid);
- futuro uso do Google AdSense;
- publicidade personalizada, não personalizada e limitada;
- coleta de dados técnicos, como IP aproximado, navegador, dispositivo, páginas visitadas e eventos;
- finalidade e controles do Analytics;
- links externos e responsabilidade por políticas de terceiros;
- direitos do titular, canal de contato e procedimento para exercê-los;
- identificação do responsável pelo site, atualização e vigência da política;
- referência à LGPD e, quando houver audiência abrangida, a outras regras territoriais aplicáveis.

A futura política deve refletir a configuração realmente implantada. Não convém copiar uma política genérica nem afirmar que o site não usa cookies/rastreadores enquanto o GA4 estiver ativo. Esta auditoria técnica não substitui revisão jurídica.

## 3. Cookies e consentimento

### Estado atual

- O Google Analytics 4 é inserido pelo partial `google_analytics.html` do PaperMod, acionado em `themes/PaperMod/layouts/partials/head.html`. O download de `googletagmanager.com/gtag/js` ocorre antes de qualquer escolha, exceto quando o navegador envia DNT.
- O tema usa `localStorage` para preferência de tema e posição do menu. `layouts/partials/extend_head.html` também grava uma chave de migração de tema.
- Giscus é carregado por `layouts/partials/comments.html` apenas no final de posts e conecta o visitante a `giscus.app`/GitHub.
- Formspree recebe nome, e-mail e mensagem na página de contato.
- Google Fonts é importado globalmente por `assets/css/extended/custom.css`.
- Mermaid é importado de jsDelivr apenas em páginas cujo Markdown contém bloco Mermaid.
- Não há Google Tag Manager nem script do AdSense.
- Não há banner, central de preferências, categorias, carregamento condicional ou Consent Mode.

### Classificação das recomendações

| Classificação | Recomendação | Motivo |
|---|---|---|
| Obrigatória antes do AdSense | Publicar transparência sobre cookies, armazenamento, terceiros, Analytics e publicidade | Hoje o usuário não recebe informação adequada sobre o tratamento já existente |
| Obrigatória antes do AdSense | Definir e implementar CMP/fluxo de consentimento compatível com os territórios atendidos | Para tráfego do EEE, Reino Unido e Suíça, o Google exige CMP certificada integrada ao TCF para anúncios personalizados; o site público não restringe geografia |
| Obrigatória antes do AdSense | Fazer GA4 e o futuro AdSense respeitarem o estado de consentimento | O GA4 atual carrega antes de qualquer decisão e DNT não cobre todos os requisitos |
| Recomendada | Separar categorias “necessários/funcionais”, “analytics” e “publicidade” | Facilita escolhas granulares e manutenção futura |
| Recomendada | Integrar Consent Mode à CMP | Permite que GA4 e AdSense interpretem os sinais de consentimento de forma consistente |
| Recomendada | Oferecer link permanente “Preferências de privacidade” | Permite rever/revogar a decisão |
| Opcional | Hospedar a fonte localmente | Reduz uma chamada externa e simplifica a lista de terceiros, sem ser requisito do AdSense |

Como solução simples e de baixo custo, avaliar primeiro o recurso **Privacy & messaging/CMP do próprio AdSense**, antes de adicionar biblioteca própria. O Google documenta que uma CMP certificada é exigida para anúncios personalizados no EEE, Reino Unido e Suíça e oferece sua própria CMP. Referências oficiais: [requisitos de CMP para publishers](https://support.google.com/adsense/answer/13554116?hl=en), [configuração da CMP](https://support.google.com/adsense/answer/7670013?hl=en) e [Consent Mode no AdSense](https://support.google.com/adsense/answer/16053245?hl=en).

## 4. Preparação técnica para o AdSense

### Melhor ponto na arquitetura atual

O ponto de extensão mais estável é `layouts/partials/extend_head.html`, que o `head.html` do PaperMod já chama. Não é necessário copiar ou editar `themes/PaperMod/layouts/partials/head.html`, o que reduziria a facilidade de atualizar o submódulo do tema.

Arquitetura futura sugerida:

```text
hugo.yml
layouts/
  partials/
    extend_head.html       # chama o partial global quando elegível
    adsense/
      head.html            # script global, consent-aware
      unit.html            # bloco manual reutilizável
  shortcodes/
    ad.html                # opcional; uso editorial explícito
```

Exemplo curto de configuração, ainda não implementado:

```yaml
params:
  adsense:
    enabled: false
    client: "ca-pub-XXXXXXXXXXXXXXX"
    autoAds: false
```

Condição recomendada no `extend_head.html`:

```go-html-template
{{ if and hugo.IsProduction site.Params.adsense.enabled site.Params.adsense.client }}
  {{ partial "adsense/head.html" . }}
{{ end }}
```

Pontos importantes:

- usar `hugo.IsProduction`, e não apenas `params.env`, porque hoje `params.env: production` está fixo no arquivo comum;
- manter `enabled: false` como padrão e ativar em configuração de produção, por exemplo `config/production/hugo.yml`, ou por parâmetro controlado no deploy;
- não carregar o script enquanto a CMP ainda não tiver estabelecido os sinais necessários; a ordem CMP/Consent Mode/AdSense deve ser testada;
- evitar duplicar o script global: anúncios automáticos e unidades manuais compartilham o mesmo carregamento base;
- permitir flags por página, como `ads: false`, para Sobre, Contato, políticas e projetos;
- inserir unidade manual com partial/shortcode apenas quando houver `slot` configurado, sem IDs espalhados pelos templates.

## 5. Posicionamento de anúncios

Estratégia discreta recomendada:

| Área | Estratégia |
|---|---|
| Página inicial | Não exibir. É a apresentação profissional e hoje tem layout de hero limpo |
| Posts | Uma unidade responsiva após o conteúdo e antes de CTA, relacionados e comentários; o ponto exato está em `layouts/_default/single.html`, logo após `.post-content` |
| Posts longos | Opcionalmente uma unidade no meio, somente por shortcode/front matter explícito e após seção completa; não automatizar inserção por contagem de parágrafos |
| Projetos/Labs | Não exibir nas páginas de portfólio inicialmente; se monetização futura justificar, limitar ao final de relatos extensos, nunca nos cards/listagem |
| Sobre | Não exibir |
| Contato e Obrigado | Não exibir |
| Privacidade, Cookies, busca, taxonomias e 404 | Não exibir |

Começar com anúncios automáticos desativados oferece maior previsibilidade. A primeira implantação deveria ser apenas uma unidade ao fim dos artigos. Avaliar métricas antes de acrescentar qualquer posição intermediária.

## 6. Qualidade e estrutura de conteúdo

### Pontos positivos verificados

- Dez posts publicados, todos com `draft: false`, título, descrição e corpo substancial.
- Dois projetos publicados com título, descrição, estado e repositório.
- Nenhuma página de teste, `Lorem ipsum`, `TODO` ou rascunho publicado foi detectada.
- Nenhum conteúdo duplicado exato foi identificado na inspeção.
- O build não emitiu erros e não há referência interna quebrada no HTML produzido.
- Navegação principal aponta para Blog, Projetos/Labs, Sobre e Contato; Busca tem acesso próprio no cabeçalho.

### Pontos corrigidos ou a acompanhar

- As categorias do conteúdo publicado e do archetype foram padronizadas como `Projetos & Labs`; a taxonomia duplicada deixou de ser gerada.
- `/contact/obrigado/` foi marcada como `noindex, nofollow`; ela permanece acessível no fluxo do formulário.
- O archetype `archetypes/projects.md` contém `seu-usuario/seu-repo`. Não é publicado hoje, mas deve ser substituído ao criar conteúdo novo para evitar placeholder acidental.
- `mainSections: []` faz a home permanecer apenas como apresentação, sem lista de artigos. Isso é uma decisão de portfólio válida, não um erro; a seção Blog continua acessível no menu.
- Os marcadores de conflito do `.gitignore` foram removidos, preservando as regras úteis existentes.

## 7. SEO e metadados básicos

| Elemento | Resultado |
|---|---|
| `<title>` | OK; home usa o título do site e páginas usam `Título | Dirlei Friedrich` |
| Meta description | OK nas páginas principais e em todo post/projeto publicado |
| Canonical | OK; absoluto e baseado em `https://dfls.eti.br/` |
| Open Graph/Twitter | OK em build de produção |
| Sitemap | OK em `/sitemap.xml` |
| robots.txt | OK em `/robots.txt`; permite indexação e referencia o sitemap |
| Favicon | OK; os cinco arquivos referenciados existem e o JSON-LD aponta para `favicon.ico` válido |
| `baseURL` | OK e coerente com `static/CNAME` |
| URLs absolutas | OK para canonical, Open Graph, sitemap e favicons; imagens internas usam caminhos válidos |

Os favicons e a referência de `logo` no JSON-LD foram corrigidos com assets derivados do ícone SVG já existente. A categoria `Projetos & Labs` também foi unificada, eliminando a fragmentação entre as duas taxonomias anteriores.

## 8. Segurança e conteúdo técnico

- Não foram encontrados arquivos `.env` versionados, chaves privadas, tokens GitHub/GitLab/AWS/OpenAI/Google ou padrões comuns de segredo.
- `.env` está listado no `.gitignore`; os marcadores de conflito anteriormente presentes no arquivo foram removidos.
- Senhas como `postgres`, `dev` e `senha_forte` aparecem apenas em exemplos didáticos de Docker/PostgreSQL e não estão associadas a hosts ou contas reais.
- O ID do GA4, IDs do Giscus e endpoint público do Formspree são identificadores de integração expostos por natureza; não são segredos. Ainda assim, devem ser documentados e monitorados contra abuso.
- Os posts contêm URLs públicas e exemplos locais; nenhuma URL privada ou dado pessoal sensível foi detectado.

Recomenda-se manter uma varredura de segredos na CI e revisar capturas de tela antes de novos posts, pois imagens podem expor dados que buscas textuais não detectam.

## 9. Performance

### Evidências

- Build total: aproximadamente 2,8 MB.
- Maior imagem: aproximadamente 101 KB; não há imagem individual excessiva.
- CSS final: aproximadamente 25 KB.
- JavaScript de busca: aproximadamente 18 KB, carregado somente na busca.
- `particles.js` + `app.js`: aproximadamente 47 KB, somente na home.
- GA4 e Google Fonts são recursos externos globais.
- Giscus é assíncrono e limitado aos posts.
- Mermaid é um módulo externo potencialmente pesado, mas só é importado quando o conteúdo contém diagrama Mermaid.

O site atual é leve. O AdSense provavelmente se tornará o maior componente de JavaScript e rede de terceiros; por isso, limitar anúncios a posts, carregar o script uma única vez e evitar anúncios automáticos inicialmente são as medidas de maior impacto. Não há justificativa para adicionar framework ou gerenciador de tags apenas para esta integração.

## Bloqueadores para solicitar AdSense

1. **Política de Privacidade ausente**, sem explicação de Analytics, cookies/armazenamento, terceiros, dados técnicos, direitos, LGPD e futura publicidade.
2. **Transparência de cookies ausente**, seja em página própria ou seção suficientemente clara e acessível.
3. **Consentimento não implementado**, embora o GA4 já carregue globalmente; é necessário escolher CMP/fluxo e garantir que Analytics e AdSense respeitem o estado de consentimento e as regiões aplicáveis.
4. **Arquitetura de produção ainda sem proteção adequada por ambiente**: `params.env: production` está fixo, portanto o futuro código de anúncios não deve depender somente desse valor.

Os favicons ausentes, as taxonomias duplicadas, o conflito no `.gitignore` e o `noindex` da página Obrigado foram corrigidos nesta primeira fase. Essas correções não alteram os bloqueadores de privacidade e consentimento acima.

## Melhorias recomendadas

1. Adicionar links de Privacidade, Cookies e Preferências de privacidade ao rodapé, presentes em todas as páginas.
2. Adicionar à CI o build e um verificador de links/arquivos referenciados.
3. Avaliar hospedar a fonte localmente para reduzir terceiros; é opcional.

## Arquitetura recomendada para futura integração

1. Criar configuração `params.adsense` com `enabled`, `client` e `autoAds`, desativada por padrão.
2. Separar configuração de produção, ou passar a ativação no workflow de deploy; nunca ativar com `hugo server`.
3. Criar `layouts/partials/adsense/head.html` e chamá-lo por `layouts/partials/extend_head.html` somente quando produção + habilitado + client válido.
4. Integrar primeiro a CMP e os sinais de Consent Mode; validar a ordem de carregamento antes de ativar anúncios.
5. Criar `layouts/partials/adsense/unit.html` para slots manuais e chamá-lo em `layouts/_default/single.html` após o conteúdo apenas para `.Section == "posts"` e quando a página não definir `ads: false`.
6. Manter anúncios automáticos desligados na primeira versão.
7. Excluir explicitamente home, projetos, Sobre, Contato, Obrigado, políticas, busca, taxonomias e 404.

## Próximos passos

1. Criar e revisar a Política de Privacidade e a seção/página de Cookies com base nos serviços efetivamente usados.
2. Escolher a CMP, preferencialmente avaliando primeiro a solução integrada do Google por simplicidade e custo, e definir o comportamento regional.
3. Fazer GA4 respeitar consentimento e testar aceitar, recusar, revogar e DNT em uma versão de homologação.
4. Implementar a configuração e os partials de AdSense, ainda com `enabled: false`.
5. Validar em ambiente de produção controlado que não há script/ad request em páginas excluídas nem em desenvolvimento.
6. Ativar inicialmente uma única unidade responsiva ao final dos posts e acompanhar experiência e métricas antes de expandir.
