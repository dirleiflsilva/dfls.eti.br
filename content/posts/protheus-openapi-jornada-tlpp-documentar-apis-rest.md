---
title: "Protheus OpenAPI: uma jornada de TL++ para documentar APIs REST"
date: 2026-08-26
draft: false
toc: true
slug: "protheus-openapi-jornada-tlpp-documentar-apis-rest"
description: "A origem do Protheus OpenAPI, um projeto experimental para aprender TL++ investigando a documentação de APIs REST modernas e legadas no Protheus."
tags:
  - protheus
  - tlpp
  - advpl
  - openapi
  - rest
  - totvs
topics:
  - Protheus e AdvPL
  - Engenharia de Software
series:
  - Protheus OpenAPI
series_order: 1
---

Documentar uma API parece simples enquanto código e documentação nascem juntos.

O problema aparece depois.

Uma rota muda, um parâmetro é acrescentado, uma resposta ganha outro formato e a especificação continua descrevendo a versão anterior. Aos poucos, o contrato que deveria ajudar consumidores, testes e integrações deixa de representar o serviço publicado.

No Protheus, existe ainda uma dificuldade adicional: APIs REST desenvolvidas em momentos diferentes podem usar modelos diferentes. De um lado estão endpoints TL++ baseados em annotations. De outro, serviços AdvPL construídos com `WSRESTFUL`, `WSMETHOD` e estruturas relacionadas.

Foi desse problema que nasceu o [Protheus OpenAPI](https://github.com/dirleiflsilva/protheus-openapi), um projeto experimental para estudar TL++ enquanto investigo uma forma de produzir documentação OpenAPI para essas duas gerações de APIs REST.

Este artigo abre a jornada reconstruindo sua primeira etapa. Antes de construir uma biblioteca, foi necessário entender o que o ambiente já oferecia, executar endpoints equivalentes e transformar as limitações encontradas em requisitos verificáveis.

> Esta série acompanha a evolução do projeto em ordem cronológica. O repositório pode conter etapas mais recentes do que as apresentadas em cada artigo.

> O Protheus OpenAPI é um projeto independente, experimental e não oficial. Ele não pretende substituir componentes da TOTVS nem afirmar compatibilidade fora do ambiente efetivamente testado.

---

## Por que OpenAPI?

OpenAPI descreve uma API HTTP em um formato que pode ser lido tanto por pessoas quanto por ferramentas.

Um documento pode registrar, entre outros elementos:

- caminhos e verbos HTTP;
- parâmetros de path, query e header;
- corpos de requisição;
- respostas e códigos de status;
- schemas reutilizáveis;
- mecanismos de segurança;
- exemplos de payloads.

Essa descrição pode alimentar interfaces como Swagger UI, validadores de contrato, geração de clientes e verificações automatizadas em pipelines.

O objetivo, portanto, não é apenas produzir uma página visualmente agradável. Uma especificação útil precisa representar o comportamento esperado da API e permanecer próxima do código que publica esse comportamento.

## O problema que quero investigar no Protheus

O `tlppCore` já possui recursos de documentação e geração. Por isso, a pergunta inicial do projeto não foi “como substituir o gerador nativo?”.

As perguntas mais úteis eram outras:

- o que o gerador já consegue descobrir em endpoints TL++?
- que documento ele produz no ambiente real?
- endpoints AdvPL baseados em `WSRESTFUL` aparecem no mesmo resultado?
- quais metadados podem ser extraídos com segurança?
- como complementar informações que não existem no fonte?
- seria possível representar TL++ e AdvPL em um modelo comum?

Responder a essas perguntas antes de desenhar a biblioteca evita criar abstrações sobre suposições.

Também define um limite importante: nem todo payload pode ser inferido automaticamente. Uma API pode construir JSON dinamicamente, consultar o dicionário de dados ou variar sua resposta conforme regras executadas em runtime. Nesses casos, a geração precisará combinar descoberta com metadados explícitos.

## Primeiro experimento: duas rotas equivalentes

O laboratório começou com o menor contrato que permitia comparar as duas tecnologias.

Foram publicados dois endpoints autenticados:

| Implementação | Endpoint | Resultado |
|---|---|---|
| TL++ com annotation | `GET /api/v1/hello` | JSON com mensagem, linguagem e status |
| AdvPL com `WSRESTFUL` | `GET /api/v1/hello-advpl` | JSON com a mesma estrutura |

No TL++, a rota foi declarada com `@Get`:

```tlpp
@Get(;
    endpoint="/api/v1/hello",;
    title="Hello World",;
    description="Retorna uma mensagem Hello World gerada por um endpoint TL++.",;
    responses='[{"statusCode":200,"description":"Hello World retornado com sucesso."}]';
)
User Function HloApi() as Logical
```

No AdvPL, o contrato equivalente usou a estrutura tradicional:

```advpl
WSRESTFUL api DESCRIPTION "Hello World AdvPL" FORMAT APPLICATION_JSON
    WSMETHOD GET Hello;
        DESCRIPTION "Retorna uma mensagem Hello World gerada por um endpoint AdvPL.";
        WSSYNTAX "/v1/hello-advpl";
        PATH "/v1/hello-advpl";
        PRODUCES APPLICATION_JSON
END WSRESTFUL
```

As duas implementações foram compiladas no mesmo RPO REST e chamadas no mesmo ambiente. Sem credenciais, ambas responderam com HTTP `401`. Com autenticação, retornaram HTTP `200` e o JSON esperado.

Essa equivalência é importante. Se as duas rotas funcionam em runtime, a comparação documental deixa de misturar dois problemas diferentes: publicação da API e descoberta de seus metadados.

## O que o gerador nativo produziu

A exportação foi acionada pelo próprio TL++:

```tlpp
tlpp.doc.generate("swagger", "hello_openapi", {8084}, {"pt-br"})
```

Um primeiro aprendizado apareceu já na escolha do formato. O modo `json` produziu uma representação interna do REST-DOC, não a especificação OpenAPI esperada. Para gerar o documento em YAML foi necessário usar o modo `swagger`.

No ambiente testado, o resultado declarou OpenAPI `3.0.3` e documentou corretamente `GET /api/v1/hello`, incluindo resumo, descrição e resposta `200`.

O endpoint AdvPL, entretanto, não apareceu no documento gerado.

| Evidência observada | TL++ com annotation | AdvPL com `WSRESTFUL` |
|---|---:|---:|
| Endpoint executado com sucesso | sim | sim |
| Metadados declarados no fonte | sim | sim |
| Descoberto por `tlpp.doc.generate()` | sim | não observado |
| Path emitido no YAML | sim | não |
| Resposta `200` documentada | sim | não |

Essa conclusão vale para o ambiente do experimento: Protheus `12.1.2510`, AppServer `24.3.1.5`, LIB `20251006` e TLPPCore `01.06.01`. Ela não deve ser generalizada automaticamente para todas as combinações de versões.

Mesmo com essa restrição, o resultado fornece uma hipótese concreta para a biblioteca: usar os recursos nativos onde eles funcionam e criar um caminho complementar para serviços `WSRESTFUL`.

## Quando o artefato real contraria o cenário ideal

O YAML completo trouxe outro aprendizado que um exemplo isolado dificilmente revelaria.

O gerador reuniu 232 declarações de path, mas apenas 226 paths eram únicos. Cinco paths de módulos padrão apareceram mais de uma vez, com verbos separados sob chaves YAML repetidas. Como um deles apareceu três vezes, o editor apresentou seis diagnósticos de chave duplicada.

As duas rotas TL++ do experimento não causaram o problema. Ainda assim, o documento agregado ficou estruturalmente inválido.

Além disso, o arquivo foi gravado em Windows-1252. Esse encoding não cria as duplicidades, mas faz os acentos parecerem corrompidos quando o documento é aberto diretamente como UTF-8.

Esses detalhes mudaram a natureza da investigação. Já não bastava confirmar que um arquivo havia sido criado; era necessário validar a estrutura completa, preservar o original e distinguir defeitos de agregação, problemas de encoding e ausência real de uma rota.

## Um normalizador como resultado intermediário

Para continuar o experimento sem modificar o artefato bruto, criei um normalizador em PowerShell.

Ele consolida apenas casos sem ambiguidade:

- o mesmo path com verbos HTTP diferentes pode ser unido;
- o mesmo verbo repetido no mesmo path interrompe o processo;
- campos compartilhados idênticos são preservados uma vez;
- campos compartilhados incompatíveis geram erro;
- a saída é gravada em UTF-8 sem BOM;
- uma falha não deixa um documento parcial.

Aplicado ao YAML real, o processo consolidou cinco grupos duplicados, incorporou seis operações e produziu 226 paths únicos. O comportamento foi coberto por 15 testes automatizados.

O normalizador não inventa a rota AdvPL ausente. Sua responsabilidade é corrigir, de forma conservadora, uma categoria específica de inconsistência observada na saída nativa.

Embora seja útil, ele não será o núcleo do Protheus OpenAPI. Se toda a solução dependesse do YAML gerado, a biblioteca herdaria tanto o formato quanto os defeitos particulares desse artefato.

Por isso, o normalizador encerra uma parte da investigação e serve como referência para comparar resultados futuros.

## A arquitetura que surgiu do experimento

Os resultados apontam para três responsabilidades separadas:

```text
Endpoints TL++ ──> Adaptador TL++ ──┐
                                    │
Endpoints AdvPL ─> Adaptador AdvPL ─┼─> Modelo intermediário ─> OpenAPI JSON
                                    │                         └> OpenAPI YAML
Metadados explícitos ───────────────┘
```

Os adaptadores descobrem o que cada modelo de código consegue oferecer. O modelo intermediário representa documentos, paths, operações e respostas sem depender da origem. Os serializadores transformam essa representação no formato final.

Essa separação permite que TL++ e AdvPL alimentem o mesmo núcleo. Também evita que regras de negócio da especificação fiquem misturadas com reflection, leitura de fontes ou detalhes do gerador nativo.

## Por que começar pelo modelo intermediário

Depois do experimento, três caminhos seriam possíveis.

O primeiro seria ampliar imediatamente o normalizador. Ele já resolve um problema real, mas manteria a evolução presa à saída do REST-DOC.

O segundo seria começar pelo adaptador AdvPL. Isso atacaria diretamente a rota ausente, porém ainda não existiria um contrato estável para receber os dados descobertos.

O terceiro — escolhido naquele momento como próximo marco — seria construir primeiro um pequeno modelo OpenAPI em TL++ e um serializador JSON.

O primeiro incremento deveria representar somente:

- versão OpenAPI `3.0.3`;
- título, descrição e versão da API;
- path `/api/v1/hello`;
- operação `get`;
- resumo e descrição;
- resposta HTTP `200`.

Parâmetros, schemas, request bodies, segurança, `servers`, `components`, leitura de fontes e geração YAML ficariam fora desse recorte inicial.

O objetivo seria gerar, inteiramente pelo núcleo TL++, um JSON equivalente à documentação do Hello World sem depender de `tlpp.doc.generate()`.

Além de produzir o primeiro artefato independente, esse marco criaria um exercício concreto de orientação a objetos, encapsulamento, validação e serialização em TL++.

## Validação como parte do domínio

Um documento OpenAPI não deve ser serializado silenciosamente quando estiver inconsistente.

A estratégia definida para esse núcleo combinava três comportamentos:

1. Erros estruturais falham no momento em que são introduzidos. Um path sem `/`, um verbo desconhecido ou uma operação duplicada não devem criar um estado ambíguo.
2. Incompletudes são acumuladas para validação. Um documento sem título ou uma operação sem resposta podem ser apresentados juntos antes da serialização.
3. O serializador aceita apenas um modelo válido. Ele não corrige, completa nem ignora dados e não produz JSON parcial em caso de falha.

Essa abordagem transforma regras da especificação em invariantes explícitas do núcleo, em vez de espalhá-las pelos futuros adaptadores.

## Uma jornada pública de desenvolvimento

O projeto foi organizado para que cada etapa gere código, evidências e material para um novo artigo.

O caminho editorial planejado naquele momento incluía:

1. configurar o REST TL++ e publicar o Hello World;
2. comparar endpoints equivalentes em TL++ e AdvPL;
3. gerar OpenAPI com `tlpp.doc.generate()`;
4. diagnosticar encoding e paths duplicados;
5. projetar um modelo OpenAPI independente em TL++;
6. serializar e validar um documento OpenAPI `3.0.3`;
7. criar um adaptador para annotations TL++;
8. criar um adaptador para `WSRESTFUL`;
9. integrar, distribuir e demonstrar o uso da biblioteca.

Essa ordem não é um compromisso rígido. Novos experimentos podem alterar a arquitetura ou mostrar que alguma hipótese estava errada.

Esse é justamente o valor de publicar a jornada: registrar não apenas a solução final, mas as evidências, os limites e as decisões que levaram até ela.

## A decisão que encerrou a primeira investigação

Ao final dessa primeira investigação, o próximo marco estava definido: construir em TL++ um modelo pequeno, capaz de representar o contrato do Hello World e serializá-lo como OpenAPI `3.0.3` em JSON.

Esse primeiro núcleo ainda não descobriria annotations nem interpretaria `WSRESTFUL`. Antes dos adaptadores, o projeto precisava de uma representação independente e testável que pudesse receber dados das duas tecnologias.

O código, os planos técnicos e o diário dos experimentos estão disponíveis no [repositório Protheus OpenAPI](https://github.com/dirleiflsilva/protheus-openapi).

Nos próximos artigos, vou separar as partes que este texto apresentou em conjunto: a publicação dos endpoints, a investigação do gerador nativo, o diagnóstico do YAML real e, depois, a construção do primeiro núcleo em TL++ e os aprendizados encontrados durante sua implementação.

## Referências

- [Repositório Protheus OpenAPI](https://github.com/dirleiflsilva/protheus-openapi)
- [TLPP — TOTVS TDN](https://tdn.totvs.com/display/tec/TLPP)
- [REST server (tlppCore) — TOTVS TDN](https://tdn.totvs.com/display/tec/Rest)
- [Evolução do REST e REST 2.0 — TOTVS TDN](https://tdn.totvs.com/display/framework/Entendendo%2Bas%2Bnovidades%2Bdo%2BREST)
- [OpenAPI Specification 3.0.3](https://spec.openapis.org/oas/v3.0.3)
