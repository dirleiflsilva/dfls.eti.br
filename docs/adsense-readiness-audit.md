# Auditoria de Preparação para Google AdSense

**Data da auditoria inicial:** 12/07/2026

**Última revisão:** 14/07/2026

**Escopo:** configuração Hugo, tema PaperMod, layouts/partials locais, conteúdo versionado, assets estáticos e HTML produzido por um build limpo.  
**Método:** inspeção estática do repositório, revisão das orientações oficiais atuais do Google, build limpo com Hugo 0.152.2, análise do HTML resultante e validação de 709 referências internas. A Fase 2 adicionou somente a página institucional e seu link no rodapé; não alterou Analytics nem implementou consentimento ou publicidade.

## Resumo Executivo

**Avaliação geral: Parcialmente pronto.**

O site tem boa base técnica e editorial: domínio e `baseURL` coerentes, HTTPS como URL canônica, navegação clara, páginas Sobre, Contato e Política de Privacidade, 11 artigos publicados com conteúdo substancial, dois projetos, seção Blog formalizada, metadados essenciais, sitemap e robots.txt. O build com Hugo 0.152.2 terminou sem erros, gerou 109 páginas e uma página adicional de paginação, e a verificação local não encontrou links internos quebrados.

Ainda não é recomendável solicitar o AdSense. A Política de Privacidade e a transparência sobre cookies, terceiros e publicidade futura foram implementadas, mas o Google Analytics 4 continua sendo carregado globalmente sem mecanismo de consentimento. Antes da solicitação, é preciso definir uma solução de consentimento compatível com a audiência atendida e fazer com que Analytics e, futuramente, AdSense respeitem essa escolha.

## Checklist

| Status | Item | Situação atual | Ação recomendada | Prioridade |
|---|---|---|---|---|
| ✅ OK | Página Sobre | `content/about/_index.md`, URL `/about/`; conteúdo e descrição presentes no HTML | Manter acessível no menu | Baixa |
| ✅ OK | Página Contato | `content/contact/_index.md` + `layouts/contact/list.html`, URL `/contact/`; formulário funcionalmente estruturado via Formspree e documentado na política | Manter a política alinhada ao fluxo | Baixa |
| ✅ OK | Política de Privacidade | `content/privacy/_index.md`, URL `/privacy/`; página pública, indexável e com metadados próprios | Revisar quando serviços ou requisitos mudarem | Baixa |
| ✅ OK | Política de Cookies | Seção equivalente incluída na Política de Privacidade, cobrindo armazenamento funcional, Analytics e publicidade futura | Atualizar junto da implementação de consentimento | Média |
| ✅ OK | Transparência sobre terceiros | A política documenta GA4, Formspree, Giscus/GitHub, Google Fonts e jsDelivr/Mermaid com links oficiais essenciais | Manter alinhada ao código | Média |
| ⚠️ Parcial | Consentimento atual | Não existe banner/CMP; GA4 é carregado globalmente | Implantar CMP/consentimento e impedir Analytics antes da escolha quando exigido | Alta |
| ✅ OK | Cookies/armazenamento próprio | A política classifica e descreve `pref-theme`, `pref-theme-default-light-v1` e `menu-scroll-position` como armazenamento funcional | Manter alinhado às chaves usadas pelo tema | Baixa |
| ✅ OK | Analytics identificável | GA4 está configurado em `services.googleAnalytics.id` (`G-ZK13WF1R2S`) e respeita DNT | Integrá-lo ao consentimento; DNT sozinho não substitui consentimento | Alta |
| ✅ OK | Ponto global de integração | `layouts/partials/extend_head.html` é chamado pelo `head.html` do tema em todas as páginas | Criar partial dedicado e chamá-lo condicionalmente pelo `extend_head.html` | Média |
| ⚠️ Parcial | Configuração por ambiente | `params.env: production` força recursos de produção mesmo em build local comum | Condicionar AdSense a `hugo.IsProduction` e a um parâmetro explícito; usar `hugo server -e development` | Alta |
| ✅ OK | Conteúdo publicado | 11 posts versionados e publicados, aproximadamente 542–1.723 palavras cada; nenhum post vazio ou de teste detectado | Manter consistência editorial | Baixa |
| ✅ OK | Índice do Blog | `content/posts/_index.md` define título, descrição, resumo e URL de `/posts/`; paginação passou a ser gerada após o 11º post | Manter como índice principal; avaliar arquivo cronológico quando o volume justificar | Baixa |
| ⚠️ Parcial | Projetos | Dois projetos publicados; um deles tem cerca de 112 palavras, mas apresenta estado, stack e repositório | Expandir evidências/resultados quando houver material real | Baixa |
| ✅ OK | Links internos | 709 referências locais verificadas no build; nenhuma quebrada | Adicionar verificação à CI para prevenir regressões | Baixa |
| ✅ OK | Taxonomias | Conteúdo e archetype padronizados em `Projetos & Labs`; somente `/categories/projetos--labs/` é gerada | Manter a categoria padronizada em novos conteúdos | Baixa |
| ✅ OK | Títulos e descrições | Home, posts, projetos, Sobre, Contato, Privacidade e Obrigado geram `<title>` e meta description | Revisar apenas páginas automáticas de taxonomia/feeds | Baixa |
| ✅ OK | Canonical e Open Graph | PaperMod gera canonical absoluto, Open Graph, Twitter Cards e JSON-LD em produção | Manter `baseURL` correto por ambiente | Baixa |
| ✅ OK | Sitemap e robots.txt | `/sitemap.xml` e `/robots.txt` são gerados; robots permite rastreamento e aponta o sitemap | Manter | Baixa |
| ✅ OK | Favicon | Os cinco assets esperados pelo PaperMod foram derivados do ícone SVG existente e são gerados corretamente | Manter os arquivos ao alterar a identidade visual | Baixa |
| ✅ OK | `baseURL` e domínio | `https://dfls.eti.br/` e `static/CNAME` (`dfls.eti.br`) são coerentes | Manter | Baixa |
| ✅ OK | Segredos versionados | Nenhum `.env`, chave privada, token de formatos comuns ou credencial real foi localizado | Manter varredura; exemplos de senhas devem continuar claramente fictícios | Média |
| ✅ OK | `.gitignore` | Marcadores de conflito removidos; regras de ambiente, editor, build e arquivos temporários foram preservadas | Manter livre de conflitos | Baixa |
| ✅ OK | `noindex` da página Obrigado | `content/contact/obrigado.md` define `robotsNoIndex = true`; HTML gera `noindex, nofollow` | Manter a página acessível, sem bloqueá-la no robots.txt | Baixa |
| ✅ OK | Link institucional no rodapé | `params.footer.text` inclui `/privacy/`; o link aparece nas páginas principais e no 404 sem override do tema | Manter persistente | Baixa |
| ✅ OK | Peso de imagens | Maior imagem estática tem cerca de 101 KB; nenhuma imagem excessivamente pesada foi detectada | Manter compressão proporcional | Baixa |
| ⚠️ Parcial | Scripts e recursos externos | GA4 é global; partículas (47 KB) só na home; Giscus só em posts; Mermaid/jsDelivr só em páginas com Mermaid; Google Fonts é global | Não adicionar AdSense fora de páginas elegíveis; considerar fonte local apenas se métricas justificarem | Média |
| ℹ️ Opcional | Consent Mode | Não existe | Usar Consent Mode com a CMP para propagar escolhas ao GA4 e AdSense | Média |
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

- O Google Analytics 4 é inserido pelo partial `google_analytics.html` do PaperMod, acionado em `themes/PaperMod/layouts/partials/head.html`. O download de `googletagmanager.com/gtag/js` ocorre antes de qualquer escolha, exceto quando o navegador envia DNT.
- O tema usa `localStorage` para preferência de tema e posição do menu. `layouts/partials/extend_head.html` também grava uma chave de migração de tema.
- Giscus é carregado por `layouts/partials/comments.html` apenas no final de posts e conecta o visitante a `giscus.app`/GitHub.
- Formspree recebe nome, e-mail e mensagem na página de contato.
- Google Fonts é importado globalmente por `assets/css/extended/custom.css`.
- Mermaid é importado de jsDelivr apenas em páginas cujo Markdown contém bloco Mermaid.
- Não há Google Tag Manager nem script do AdSense.
- Não há banner, central de preferências, categorias, carregamento condicional ou Consent Mode.
- A Política de Privacidade agora descreve esse estado atual e diferencia armazenamento funcional, Analytics e publicidade futura.

### Classificação das recomendações

| Classificação | Recomendação | Motivo |
|---|---|---|
| Concluída na Fase 2 | Manter transparência sobre cookies, armazenamento, terceiros, Analytics e publicidade futura | A página `/privacy/` agora fornece essas informações e deve acompanhar futuras mudanças |
| Obrigatória antes do AdSense | Definir e implementar CMP/fluxo de consentimento compatível com os territórios atendidos | Para tráfego do EEE, Reino Unido e Suíça, o Google exige CMP certificada integrada ao TCF; em 2026, a solução deve operar com TCF v2.3 |
| Obrigatória antes do AdSense | Fazer GA4 e o futuro AdSense respeitarem o estado de consentimento | O GA4 atual carrega antes de qualquer decisão e DNT não cobre todos os requisitos |
| Recomendada | Separar categorias “necessários/funcionais”, “analytics” e “publicidade” | Facilita escolhas granulares e manutenção futura |
| Recomendada | Integrar Consent Mode à CMP | Permite que GA4 e AdSense interpretem os sinais de consentimento de forma consistente |
| Recomendada | Oferecer link permanente “Preferências de privacidade” | Permite rever/revogar a decisão |
| Opcional | Hospedar a fonte localmente | Reduz uma chamada externa e simplifica a lista de terceiros, sem ser requisito do AdSense |

Como solução simples e de baixo custo, avaliar primeiro o recurso **Privacy & messaging/CMP do próprio AdSense**, antes de adicionar biblioteca própria. O Google documenta que uma CMP certificada é exigida para anúncios personalizados no EEE, Reino Unido e Suíça. Desde 01/03/2026, o padrão aplicável é TCF v2.3; a CMP do Google faz essa emissão automaticamente. Referências oficiais: [conteúdo obrigatório da política](https://support.google.com/adsense/answer/1348695?hl=en), [requisitos de CMP para publishers](https://support.google.com/adsense/answer/13554116?hl=en), [integração com TCF v2.3](https://support.google.com/adsense/answer/9804260?hl=en) e [Consent Mode no AdSense](https://support.google.com/adsense/answer/16053245?hl=en).

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

- Onze posts versionados e publicados, todos com `draft: false`, título, descrição e corpo substancial.
- Dois projetos publicados com título, descrição, estado e repositório.
- A seção Blog possui metadados próprios em `content/posts/_index.md`; `/posts/` é o índice editorial e já pagina corretamente o 11º artigo.
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
- Build: 109 páginas, uma página de paginação, 31 arquivos estáticos e nenhum erro.
- Maior imagem: aproximadamente 101 KB; não há imagem individual excessiva.
- CSS final: aproximadamente 25 KB.
- JavaScript de busca: aproximadamente 18 KB, carregado somente na busca.
- `particles.js` + `app.js`: aproximadamente 47 KB, somente na home.
- GA4 e Google Fonts são recursos externos globais.
- Giscus é assíncrono e limitado aos posts.
- Mermaid é um módulo externo potencialmente pesado, mas só é importado quando o conteúdo contém diagrama Mermaid.

O site atual é leve. O AdSense provavelmente se tornará o maior componente de JavaScript e rede de terceiros; por isso, limitar anúncios a posts, carregar o script uma única vez e evitar anúncios automáticos inicialmente são as medidas de maior impacto. Não há justificativa para adicionar framework ou gerenciador de tags apenas para esta integração.

## Bloqueadores para solicitar AdSense

1. **Consentimento não implementado**, embora o GA4 já carregue globalmente; é necessário escolher CMP/fluxo e garantir que Analytics e AdSense respeitem o estado de consentimento e as regiões aplicáveis.
2. **Arquitetura de produção ainda sem proteção adequada por ambiente**: `params.env: production` está fixo, portanto o futuro código de anúncios não deve depender somente desse valor.

Os favicons, as taxonomias, o `.gitignore` e o `noindex` da página Obrigado foram corrigidos na Fase 1. A Política de Privacidade, a seção de cookies, a transparência sobre terceiros e o link institucional no rodapé foram concluídos na Fase 2. Consentimento e configuração por ambiente continuam pendentes.

## Melhorias recomendadas

1. Adicionar um link de preferências de privacidade ao rodapé quando esse recurso existir na Fase 3.
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

1. Escolher a CMP, preferencialmente avaliando primeiro a solução integrada do Google por simplicidade e custo, e definir o comportamento regional.
2. Fazer GA4 respeitar consentimento e testar aceitar, recusar, revogar e DNT em uma versão de homologação.
3. Revisar a Política de Privacidade para refletir o mecanismo de consentimento efetivamente adotado.
4. Implementar a configuração e os partials de AdSense, ainda com `enabled: false`.
5. Validar em ambiente de produção controlado que não há script/ad request em páginas excluídas nem em desenvolvimento.
6. Ativar inicialmente uma única unidade responsiva ao final dos posts e acompanhar experiência e métricas antes de expandir.
