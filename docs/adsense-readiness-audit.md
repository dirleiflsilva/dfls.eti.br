# Auditoria de Preparação para Google AdSense

**Data da auditoria inicial:** 12/07/2026

**Última revisão:** 31/07/2026

**Escopo:** configuração Hugo, tema PaperMod, layouts/partials locais, conteúdo versionado, assets estáticos e HTML produzido por um build limpo.  
**Método:** inspeção estática do repositório, revisão das orientações oficiais atuais do Google, builds limpos de produção e desenvolvimento com Hugo 0.152.2, análise do HTML resultante e validação de 709 referências internas na auditoria inicial. A conta AdSense está conectada ao domínio pela meta tag oficial; a interface global de preferências controla o Consent Mode do GA4, sem ativar publicidade nem substituir a CMP certificada exigida para tráfego TCF.

## Resumo Executivo

**Avaliação geral: Parcialmente pronto.**

O site tem boa base técnica e editorial: domínio e `baseURL` coerentes, HTTPS como URL canônica, navegação clara, páginas Sobre, Contato e Política de Privacidade, 18 artigos publicados, três projetos, seção Blog formalizada, metadados essenciais, sitemap e robots.txt. O build atual com Hugo 0.152.2 terminou sem erros e gerou 160 páginas e uma página adicional de paginação.

A conta AdSense foi criada e o domínio `dfls.eti.br` está conectado pelo Publisher ID configurado na meta tag oficial de produção. Isso não ativa anúncios: a revisão/aprovação do site continua pendente e nenhum script ou unidade de publicidade foi adicionado. A Política de Privacidade e a interface global de preferências foram atualizadas; aceite, recusa e revogação agora produzem updates reais de Consent Mode. Ainda falta configurar a CMP certificada/TCF no painel antes de veicular publicidade abrangida pelos requisitos europeus.

## Checklist

| Status | Item | Situação atual | Ação recomendada | Prioridade |
|---|---|---|---|---|
| ✅ OK | Página Sobre | `content/about/_index.md`, URL `/about/`; conteúdo e descrição presentes no HTML | Manter acessível no menu | Baixa |
| ✅ OK | Página Contato | `content/contact/_index.md` + `layouts/contact/list.html`, URL `/contact/`; formulário funcionalmente estruturado via Formspree e documentado na política | Manter a política alinhada ao fluxo | Baixa |
| ✅ OK | Política de Privacidade | `content/privacy/_index.md`, URL `/privacy/`; página pública, indexável e com metadados próprios | Revisar quando serviços ou requisitos mudarem | Baixa |
| ✅ OK | Política de Cookies | Seção equivalente incluída na Política de Privacidade, cobrindo armazenamento funcional, Analytics e publicidade futura | Atualizar junto da implementação de consentimento | Média |
| ✅ OK | Transparência sobre terceiros | A política documenta GA4, Formspree, Giscus/GitHub, Google Fonts e jsDelivr/Mermaid com links oficiais essenciais | Manter alinhada ao código | Média |
| ⚠️ Parcial | Consentimento atual | Mensagem global, três escolhas, preferências granulares, persistência, revogação e updates do Consent Mode implementados; não gera TC String | Configurar a CMP certificada/TCF antes da publicidade europeia | Alta |
| ✅ OK | Cookies/armazenamento próprio | A política classifica e descreve `pref-theme`, `pref-theme-default-light-v1` e `menu-scroll-position` como armazenamento funcional | Manter alinhado às chaves usadas pelo tema | Baixa |
| ✅ OK | Carregamento do GA4 | Override local usa `services.googleAnalytics.id`; há um único loader e um único `gtag("config")`, ambos posteriores ao default de consentimento | Manter o fluxo único | Baixa |
| ✅ OK | Ordem das tags | `dataLayer` → `gtag()` → `consent default` → loader `gtag.js` → configuração GA4, confirmados no HTML de produção | Revalidar após integrar a CMP | Média |
| ✅ OK | DNT | Consent default permanece negado; DNT `1` ou `yes` impede loader e configuração GA4 sem conceder consentimento | Manter conservador | Baixa |
| ✅ OK | Configuração por ambiente | `params.env: production` removido; partial local depende de `hugo.IsProduction`; build development não contém Google tag ou Measurement ID | Manter deploy explícito e testar regressões | Baixa |
| ⚠️ Parcial | Conexão da conta AdSense | Conta criada; `dfls.eti.br` conectado em produção via meta `google-adsense-account`, usando o Publisher ID centralizado; sem código de anúncios | Publicar e aguardar a validação/revisão no painel Google | Alta |
| ✅ OK | Conteúdo publicado | 18 posts publicados e nove rascunhos futuros; nenhum post vazio ou de teste detectado | Manter consistência editorial e reforçar evidências autorais | Baixa |
| ✅ OK | Autoria | Os 18 artigos exibem assinatura clicável para `/about/`, bio editorial e `BlogPosting.author` vinculado a uma entidade `Person`; a página Sobre gera `ProfilePage` | Manter nome, bio e perfis externos centralizados em `hugo.yml` | Baixa |
| ✅ OK | Índice do Blog | `content/posts/_index.md` organiza temas, séries e publicações recentes; `/posts/arquivo/` funciona como arquivo completo | Manter como índice principal | Baixa |
| ✅ OK | Projetos | Três projetos publicados com estado, stack, repositório e vínculos para artigos técnicos; a home apresenta um destaque compacto com links para os projetos e seus artigos relacionados | Expandir evidências/resultados conforme os projetos evoluírem | Baixa |
| ✅ OK | Links internos | 709 referências locais verificadas no build; nenhuma quebrada | Adicionar verificação à CI para prevenir regressões | Baixa |
| ✅ OK | Taxonomias editoriais | Tópicos e séries permanecem indexáveis; `/tags/`, os 49 termos de tags e `/search/` continuam navegáveis, mas recebem `noindex` e não entram no sitemap | Manter a regra centralizada de cascade ao criar novas taxonomias utilitárias | Baixa |
| ✅ OK | Títulos e descrições | Home, posts, projetos, Sobre, Contato, Privacidade e Obrigado geram `<title>` e meta description | Revisar apenas páginas automáticas de taxonomia/feeds | Baixa |
| ✅ OK | Canonical e Open Graph | PaperMod gera canonical absoluto, Open Graph, Twitter Cards e JSON-LD em produção | Manter `baseURL` correto por ambiente | Baixa |
| ✅ OK | Sitemap e robots.txt | `/sitemap.xml` contém somente as 40 URLs públicas indexáveis; busca, tags superficiais e confirmação de contato foram retiradas sem bloquear o rastreamento do site | Manter | Baixa |
| ✅ OK | Favicon | Os cinco assets esperados pelo PaperMod foram derivados do ícone SVG existente e são gerados corretamente | Manter os arquivos ao alterar a identidade visual | Baixa |
| ✅ OK | `baseURL` e domínio | `https://dfls.eti.br/` e `static/CNAME` (`dfls.eti.br`) são coerentes | Manter | Baixa |
| ✅ OK | Segredos versionados | Nenhum `.env`, chave privada, token de formatos comuns ou credencial real foi localizado | Manter varredura; exemplos de senhas devem continuar claramente fictícios | Média |
| ✅ OK | `.gitignore` | Marcadores de conflito removidos; regras de ambiente, editor, build e arquivos temporários foram preservadas | Manter livre de conflitos | Baixa |
| ✅ OK | `noindex` da página Obrigado | `content/contact/obrigado.md` define `robotsNoIndex = true`; HTML gera `noindex, nofollow` | Manter a página acessível, sem bloqueá-la no robots.txt | Baixa |
| ✅ OK | Link institucional no rodapé | `params.footer.text` inclui `/privacy/`; o link aparece nas páginas principais e no 404 sem override do tema | Manter persistente | Baixa |
| ✅ OK | Peso de imagens | Maior imagem estática tem cerca de 101 KB; nenhuma imagem excessivamente pesada foi detectada | Manter compressão proporcional | Baixa |
| ⚠️ Parcial | Scripts e recursos externos | GA4 é exclusivo de produção e consent-aware com default negado; partículas, Giscus, Mermaid e Google Fonts mantêm o comportamento anterior | Integrar terceiros às escolhas conforme a estratégia da CMP exigir | Média |
| ✅ OK | Consent Mode v2 local | Default antes da tag, escolha persistida e updates seletivos para Analytics/publicidade; aceite, recusa e reabertura testados | Revalidar no Tag Assistant após o deploy | Média |
| ℹ️ Opcional | Anúncio no meio do artigo | Não existe | Considerar somente em artigos longos, com regra explícita no front matter | Baixa |

## 1. Estrutura básica do site

| Página | Arquivo responsável | URL gerada | Status | Melhoria recomendada |
|---|---|---|---|---|
| Sobre | `content/about/_index.md` (renderizado pelo list template do PaperMod) | `https://dfls.eti.br/about/` | OK | Nenhuma mudança estrutural necessária |
| Contato | `content/contact/_index.md` e `layouts/contact/list.html` | `https://dfls.eti.br/contact/` | OK | Manter a política alinhada ao uso do Formspree |
| Política de Privacidade | `content/privacy/_index.md` | `https://dfls.eti.br/privacy/` | OK | Revisar quando integrações, finalidades ou requisitos mudarem |
| Política de Cookies | seção em `content/privacy/_index.md` | `https://dfls.eti.br/privacy/#cookies-e-tecnologias-de-armazenamento` | OK | Separar em página própria apenas se a complexidade futura justificar |

`content/contact/obrigado.md` também gera `/contact/obrigado/`; é uma página curta por finalidade, não um conteúdo editorial incompleto. Ela define `robotsNoIndex = true` e gera `<meta name="robots" content="noindex, nofollow">`, continuando acessível sem ser bloqueada no robots.txt.

## 2. Política de Privacidade

A página `/privacy/` foi implementada em português do Brasil e cobre:

- dados técnicos processados por serviços de terceiros;
- dados enviados voluntariamente pelo formulário de contato;
- Google Analytics 4 e seu estado atual de carregamento;
- Formspree, Giscus/GitHub, Google Fonts e jsDelivr/Mermaid;
- cookies e as chaves funcionais de `localStorage` identificadas no código;
- futura utilização do Google AdSense, sem afirmar que o serviço já está ativo;
- anúncios personalizados, não personalizados ou limitados conforme futura configuração;
- links externos, direitos relacionados à LGPD e canal de contato já publicado;
- data de atualização e possibilidade de revisão futura.

A página gera título, descrição, canonical `https://dfls.eti.br/privacy/` e `index, follow`. O link foi adicionado a `params.footer.text`, portanto aparece globalmente sem alteração direta no PaperMod. O texto deverá ser revisto junto das próximas fases e sempre que as integrações mudarem. Esta auditoria técnica não substitui revisão jurídica.

## 3. Cookies e consentimento

### Estado atual

- O PaperMod continua acionando `google_analytics.html`, mas um override local agora inicializa Consent Mode e GA4 sem editar o tema.
- Em produção, `layouts/partials/consent/default.html` cria `dataLayer`/`gtag()` e define os quatro sinais como `denied` antes da tag Google.
- `layouts/partials/consent/google-tags.html` preserva DNT: com DNT ativo, não carrega `gtag.js` nem configura GA4; sem DNT, carrega uma única tag sob os estados negados.
- O tema usa `localStorage` para preferência de tema e posição do menu. `layouts/partials/extend_head.html` também grava uma chave de migração de tema.
- Giscus é carregado por `layouts/partials/comments.html` apenas no final de posts e conecta o visitante a `giscus.app`/GitHub.
- Formspree recebe nome, e-mail e mensagem na página de contato.
- Google Fonts é importado globalmente por `assets/css/extended/custom.css`.
- Mermaid é importado de jsDelivr apenas em páginas cujo Markdown contém bloco Mermaid.
- Não há Google Tag Manager nem script do AdSense.
- A meta tag `google-adsense-account` conecta a conta em produção, mas não carrega publicidade nem participa do fluxo de consentimento.
- Há uma única mensagem global com consentimento, recusa e gerenciamento; a central pode ser reaberta pelo rodapé e publica updates seletivos.
- A interface local não é uma CMP TCF certificada e não gera TC String para publicidade europeia.
- A Política de Privacidade agora descreve esse estado atual e diferencia armazenamento funcional, Analytics e publicidade futura.

### Classificação das recomendações

| Classificação | Recomendação | Motivo |
|---|---|---|
| Concluída na Fase 2 | Manter transparência sobre cookies, armazenamento, terceiros, Analytics e publicidade futura | A página `/privacy/` agora fornece essas informações e deve acompanhar futuras mudanças |
| Obrigatória antes do AdSense | Definir e implementar CMP/fluxo de consentimento compatível com os territórios atendidos | Para tráfego do EEE, Reino Unido e Suíça, o Google exige CMP certificada integrada ao TCF; em 2026, a solução deve operar com TCF v2.3 |
| Concluída localmente em 31/07 | Fazer GA4 respeitar a escolha de Analytics | Default e updates seletivos implementados; aceite, recusa, persistência e revogação testados no navegador |
| Recomendada | Separar categorias “necessários/funcionais”, “analytics” e “publicidade” | Facilita escolhas granulares e manutenção futura |
| Pendente no painel | Integrar Consent Mode à CMP | A fundação existe no código, mas a CMP do Google e seus controles ainda não foram configurados/publicados |
| Recomendada | Oferecer link permanente “Preferências de privacidade” | Permite rever/revogar a decisão |
| Opcional | Hospedar a fonte localmente | Reduz uma chamada externa e simplifica a lista de terceiros, sem ser requisito do AdSense |

Como solução simples e de baixo custo, avaliar primeiro o recurso **Privacy & messaging/CMP do próprio AdSense**, antes de adicionar biblioteca própria. O Google documenta que uma CMP certificada é exigida para anúncios personalizados no EEE, Reino Unido e Suíça. Desde 01/03/2026, o padrão aplicável é TCF v2.3; a CMP do Google faz essa emissão automaticamente. Referências oficiais: [conteúdo obrigatório da política](https://support.google.com/adsense/answer/1348695?hl=en), [requisitos de CMP para publishers](https://support.google.com/adsense/answer/13554116?hl=en), [integração com TCF v2.3](https://support.google.com/adsense/answer/9804260?hl=en) e [Consent Mode no AdSense](https://support.google.com/adsense/answer/16053245?hl=en).

## 4. Preparação técnica para o AdSense

### Conexão da conta

O Publisher ID está centralizado em `params.adsense.publisherId`. Em produção, `layouts/partials/extend_head.html` chama `layouts/partials/adsense/account.html`, que gera exclusivamente a meta tag oficial `google-adsense-account` quando o parâmetro existe e não está vazio. A tag não aparece em development, não carrega `adsbygoogle.js`, não cria requisições ou unidades de anúncio e não altera Consent Mode, GA4 ou DNT.

A conta foi criada e o domínio `dfls.eti.br` está sendo conectado. A confirmação da conexão e a revisão/aprovação do site continuam pendentes no painel Google AdSense.

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

Estrutura futura para exibição de anúncios, ainda não implementada além do `publisherId`:

```yaml
params:
  adsense:
    publisherId: "ca-pub-..."
    enabled: false
    client: ""
    autoAds: false
```

Condição recomendada no `extend_head.html`:

```go-html-template
{{ if and hugo.IsProduction site.Params.adsense.enabled site.Params.adsense.client }}
  {{ partial "adsense/head.html" . }}
{{ end }}
```

Pontos importantes:

- `params.env: production` foi removido; manter `hugo.IsProduction` como condição obrigatória para tags reais;
- manter `enabled: false` como padrão e ativar em configuração de produção, por exemplo `config/production/hugo.yml`, ou por parâmetro controlado no deploy;
- definir o default negado antes de qualquer tag e deixar somente a CMP certificada publicar updates; a ordem completa deve ser testada;
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

- Onze posts versionados e publicados, todos com `draft: false`, título, descrição e corpo substancial.
- Três projetos publicados com título, descrição, estado, repositório e vínculos editoriais.
- A seção Blog possui metadados próprios em `content/posts/_index.md`; `/posts/` organiza temas, séries e publicações recentes, enquanto `/posts/arquivo/` lista o acervo.
- Nenhuma página de teste, `Lorem ipsum`, `TODO` ou rascunho publicado foi detectada.
- Nenhum conteúdo duplicado exato foi identificado na inspeção.
- O build não emitiu erros e não há referência interna quebrada no HTML produzido.
- Navegação principal aponta para Blog, Projetos/Labs, Sobre e Contato; Busca tem acesso próprio no cabeçalho.

### Pontos corrigidos ou a acompanhar

- As categorias do conteúdo publicado e do archetype foram padronizadas como `Projetos & Labs`; a taxonomia duplicada deixou de ser gerada.
- `/contact/obrigado/` foi marcada como `noindex, nofollow`; ela permanece acessível no fluxo do formulário.
- O archetype `archetypes/projects.md` contém `seu-usuario/seu-repo`. Não é publicado hoje, mas deve ser substituído ao criar conteúdo novo para evitar placeholder acidental.
- `mainSections: []` faz a home permanecer apenas como apresentação, sem lista de artigos. Isso é uma decisão de portfólio documentada no README, não um erro; a seção Blog continua acessível no menu.
- Os marcadores de conflito do `.gitignore` foram removidos, preservando as regras úteis existentes.

## 7. SEO e metadados básicos

| Elemento | Resultado |
|---|---|
| `<title>` | OK; home usa o título do site e páginas usam `Título | Dirlei Friedrich` |
| Meta description | OK nas páginas principais, na seção Blog, na Política de Privacidade e em todo post/projeto publicado |
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

- Build total: aproximadamente 2,9 MB.
- Build: 160 páginas, uma página de paginação, 32 arquivos estáticos e nenhum erro.
- Maior imagem: aproximadamente 101 KB; não há imagem individual excessiva.
- CSS final: aproximadamente 25 KB.
- JavaScript de busca: aproximadamente 18 KB, carregado somente na busca.
- `particles.js` + `app.js`: aproximadamente 47 KB, somente na home.
- Google Fonts é global; GA4 é carregado somente em produção, sob Consent Mode default negado e quando DNT não está ativo.
- Giscus é assíncrono e limitado aos posts.
- Mermaid é um módulo externo potencialmente pesado, mas só é importado quando o conteúdo contém diagrama Mermaid.

O site atual é leve. O AdSense provavelmente se tornará o maior componente de JavaScript e rede de terceiros; por isso, limitar anúncios a posts, carregar o script uma única vez e evitar anúncios automáticos inicialmente são as medidas de maior impacto. Não há justificativa para adicionar framework ou gerenciador de tags apenas para esta integração.

## Bloqueadores para solicitar AdSense

1. **CMP certificada/TCF ainda não configurada no painel**: a interface global controla Consent Mode, mas não gera a TC String exigida para publicidade europeia.
2. **Validação externa ainda pendente**: o fluxo local passou nos testes de navegador; resta revalidar o deploy no Tag Assistant e, futuramente, a integração TCF.

Os favicons, as taxonomias, o `.gitignore` e o `noindex` da página Obrigado foram corrigidos na Fase 1. A Política de Privacidade, a seção de cookies, a transparência e o link institucional foram concluídos na Fase 2. A fundação do Consent Mode, a ordem do GA4, DNT e a separação de ambientes foram concluídos na Fase 3. Em 31/07, a mensagem global, a persistência, os updates e a revogação foram implementados; a integração externa com a CMP certificada/TCF continua pendente.

## Melhorias recomendadas

1. Manter o link de preferências de privacidade já publicado no rodapé e revalidá-lo após integrar a CMP certificada.
2. Adicionar à CI o build e um verificador de links/arquivos referenciados.
3. Avaliar hospedar a fonte localmente para reduzir terceiros; é opcional.

## Arquitetura recomendada para futura integração

1. Expandir a configuração atual `params.adsense`, no futuro, com `enabled`, `client` e `autoAds`, mantendo a exibição desativada por padrão.
2. Separar configuração de produção, ou passar a ativação no workflow de deploy; nunca ativar com `hugo server`.
3. Criar `layouts/partials/adsense/head.html` e chamá-lo por `layouts/partials/extend_head.html` somente quando produção + habilitado + client válido.
4. Integrar primeiro a CMP e os sinais de Consent Mode; validar a ordem de carregamento antes de ativar anúncios.
5. Criar `layouts/partials/adsense/unit.html` para slots manuais e chamá-lo em `layouts/_default/single.html` após o conteúdo apenas para `.Section == "posts"` e quando a página não definir `ads: false`.
6. Manter anúncios automáticos desligados na primeira versão.
7. Excluir explicitamente home, projetos, Sobre, Contato, Obrigado, políticas, busca, taxonomias e 404.

## Próximos passos

1. Publicar o código atual e validar no Tag Assistant default, aceite, recusa, alteração, revogação, DNT e ausência de duplicidade.
2. Configurar a CMP certificada no Google AdSense Privacy & messaging e planejar sua convivência regional sem mensagens duplicadas.
3. Validar a TC String e os sinais de publicidade antes de ativar qualquer script ou unidade de anúncio.
4. Implementar a configuração e os partials de exibição do AdSense, ainda com `enabled: false`; a meta de conexão já está separada desse fluxo.
5. Validar em ambiente de produção controlado que não há script/ad request em páginas excluídas nem em desenvolvimento.
6. Ativar inicialmente uma única unidade responsiva ao final dos posts e acompanhar experiência e métricas antes de expandir.
