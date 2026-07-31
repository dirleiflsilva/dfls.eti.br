# Gerenciamento de Consentimento

**Última atualização:** 31/07/2026

## Objetivo

Este documento descreve a implementação global de preferências de privacidade, sua integração ao Google Consent Mode v2 e a dependência adicional de uma CMP certificada para publicidade em regiões abrangidas pela TCF.

O projeto implementa uma interface própria para as categorias necessárias, Analytics e publicidade. Ela controla o GA4 e registra a escolha global do visitante, mas não gera uma TC String nem substitui a CMP certificada exigida pelo Google para publicidade personalizada no EEE, Reino Unido e Suíça.

## Estado atual

O código está preparado da seguinte forma:

- Consent Mode v2 ativo somente em builds de produção;
- `dataLayer` e a função global `gtag()` são inicializados antes das tags Google;
- os quatro estados começam como `denied` quando ainda não existe uma escolha válida;
- o GA4 usa o Measurement ID de `services.googleAnalytics.id`;
- existe somente um fluxo de carregamento do GA4;
- DNT continua sendo respeitado de forma conservadora;
- a conta AdSense é identificada em produção por uma meta tag de conexão;
- Google AdSense ainda não está ativo;
- uma única mensagem global permite consentir, não consentir ou gerenciar opções;
- a escolha é persistida em `localStorage` sob a chave `dfls-privacy-consent-v1`;
- o link permanente no rodapé permite revisar ou revogar a decisão.

Os estados padrão são:

```text
analytics_storage = denied
ad_storage = denied
ad_user_data = denied
ad_personalization = denied
```

Esta é uma implementação de Consent Mode avançado: quando DNT não está ativo, a tag Google pode carregar sob o estado padrão negado e ajustar seu comportamento conforme os sinais. A interface local publica o `consent update` após uma escolha. Para visitantes com preferência salva, o estado correspondente é aplicado como `consent default` antes da configuração do GA4 na visita seguinte.

## Arquitetura no código

```text
themes/PaperMod/layouts/partials/head.html
   ├─ layouts/partials/extend_head.html
   │     └─ layouts/partials/consent/default.html
   │           └─ preferência salva → dataLayer → gtag() → consent default
   └─ layouts/partials/google_analytics.html
         └─ layouts/partials/consent/google-tags.html
               └─ DNT → gtag.js → gtag("config", Measurement ID)

layouts/partials/extend_footer.html
   └─ layouts/partials/consent/banner.html
         └─ mensagem → preferências → consent update → localStorage
```

O arquivo local `layouts/partials/google_analytics.html` substitui apenas o partial de Analytics resolvido pelo PaperMod. Nenhum arquivo do tema é alterado.

O ID de medição permanece centralizado em:

```yaml
services:
  googleAnalytics:
    id: "G-..."
```

Não se deve repetir esse valor diretamente nos partials.

## Ordem de inicialização

Em produção, a ordem no HTML é:

```text
window.dataLayer
   ↓
function gtag()
   ↓
gtag("consent", "default", ... denied)
   ↓
loader único de gtag.js
   ↓
gtag("js", ...)
   ↓
gtag("config", Measurement ID)
```

Essa ordem garante que a tag Google encontre os estados padrão antes de processar a configuração do GA4.

## Atualização pela interface de preferências

A função global `gtag()` e o `dataLayer` ficam disponíveis antes da tag Google. A interface atualiza apenas as categorias escolhidas:

- Analytics controla `analytics_storage`;
- publicidade controla `ad_storage`, `ad_user_data` e `ad_personalization`;
- recusar mantém os quatro sinais negados;
- DNT impede que Analytics seja concedido e também impede o carregamento da tag.

A preferência de publicidade é preparatória: não carrega anúncios nem substitui os sinais TCF que deverão vir de uma CMP certificada quando o AdSense for ativado para tráfego europeu.

## Conexão da conta AdSense

Em produção, `layouts/partials/adsense/account.html` gera a meta tag oficial `google-adsense-account` com o Publisher ID centralizado em `params.adsense.publisherId`. Essa tag serve somente para conectar e verificar o domínio `dfls.eti.br` na conta Google AdSense.

A meta tag:

- não carrega `adsbygoogle.js` nem faz requisições de anúncios;
- não exibe publicidade ou ativa Auto Ads;
- não altera os quatro estados de consentimento;
- não executa `consent update`;
- não substitui a configuração e publicação da CMP.

## DNT — Do Not Track

A configuração existente mantém `privacy.googleAnalytics.respectDoNotTrack: true`.

O novo fluxo trata DNT assim:

1. o Consent Mode é inicializado com todos os estados negados;
2. se o navegador enviar DNT como `1` ou `yes`, o loader de `gtag.js` e o `gtag("config")` não são executados;
3. DNT nunca é interpretado como consentimento concedido;
4. não é criado um segundo estado ou armazenamento para representar DNT.

A futura CMP poderá apresentar suas opções conforme os requisitos aplicáveis, mas não deverá transformar DNT automaticamente em `granted`.

## Ambientes

O carregamento depende de `hugo.IsProduction`. O parâmetro fixo `params.env: production` foi removido porque fazia o PaperMod tratar builds de desenvolvimento como produção.

Comportamento esperado:

| Ambiente | Consent Mode | GA4 real | Metadados de produção |
|---|---|---|---|
| `hugo` / deploy atual | Ativo, default negado | Ativo quando DNT não está habilitado | Ativos; meta de conexão AdSense presente |
| `hugo -e development` | Interface e estado local para testes | Ausente | Tags Google e meta AdSense ausentes |
| `hugo server -e development` | Interface e estado local para testes | Ausente | Tags Google e meta AdSense ausentes |

## Dependência externa: CMP certificada para publicidade

A conta Google AdSense foi criada e o Publisher ID foi configurado no repositório para conectar o domínio por meta tag. A revisão/aprovação do site, o ID de mensagem e a configuração de Privacy & messaging continuam dependentes do painel Google; nenhum identificador adicional deve ser inventado.

Fluxo ainda necessário no painel do Google antes de veicular publicidade abrangida pela TCF:

1. concluir a conexão e validação do domínio `dfls.eti.br` pela meta tag publicada;
2. acompanhar a revisão/aprovação do site no Google AdSense;
3. acessar **Privacy & messaging**;
4. configurar a mensagem de regulamentações europeias quando aplicável;
5. habilitar na CMP do Google os sinais de Consent Mode para publicidade e Analytics;
6. publicar a mensagem;
7. integrar o resultado sem apresentar duas mensagens ao mesmo visitante;
8. validar no site os estados, a TC String e suas atualizações.

Segundo a documentação do Google, os controles de Consent Mode da CMP podem estar desativados por padrão no painel. Essa configuração é externa ao código e deve ser revisada antes da publicação da mensagem.

Referências oficiais:

- [Configuração do Consent Mode em sites](https://developers.google.com/tag-platform/security/guides/consent?hl=pt-br)
- [Verificação da implementação do Consent Mode](https://support.google.com/analytics/answer/14218557?hl=pt-BR)
- [Consent Mode na CMP do Google](https://support.google.com/adsense/answer/16053245?hl=pt-BR)
- [Privacy & messaging no Google AdSense](https://support.google.com/adsense/answer/10924669?hl=pt-BR)

## Checklist de validação

Após publicar a CMP, validar com o Google Tag Assistant:

- [ ] existe somente uma Google tag com o Measurement ID configurado;
- [ ] a chamada `consent default` ocorre antes da tag e do evento de configuração;
- [ ] `analytics_storage`, `ad_storage`, `ad_user_data` e `ad_personalization` começam como `denied`;
- [ ] recusar a mensagem mantém os sinais aplicáveis como `denied`;
- [ ] aceitar as categorias atualiza somente os sinais correspondentes para `granted`;
- [ ] alterar ou revogar a escolha produz um novo `consent update`;
- [ ] a atualização ocorre na mesma página, antes de qualquer navegação;
- [ ] o GA4 respeita `analytics_storage` em cada cenário;
- [ ] as tags de publicidade futuras respeitam os sinais relacionados a anúncios;
- [ ] DNT não resulta em consentimento concedido nem em inicialização duplicada;
- [ ] não há tag, configuração ou evento duplicado;
- [ ] o painel do GA4 passa a receber os sinais esperados após o período de processamento indicado pelo Google.

Os testes locais de aceite, recusa e revogação fazem parte do build atual. A validação de TCF e publicidade continuará pendente até a configuração e publicação da CMP certificada no painel.
