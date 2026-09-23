---
title: "TL++ versus WSRESTFUL: o que o gerador OpenAPI consegue descobrir"
date: 2026-09-23
draft: false
toc: true
slug: "tlpp-versus-wsrestful-descoberta-openapi"
description: "Comparando endpoints equivalentes em TL++ e AdvPL: ambos respondem por HTTP, mas a descoberta documental pelo REST-DOC apresentou resultados diferentes."
tags:
  - protheus
  - tlpp
  - advpl
  - openapi
  - rest
  - rest-doc
topics:
  - Protheus e AdvPL
  - Engenharia de Software
series:
  - Protheus OpenAPI
series_order: 3
---

No [Hello World REST em TL++](/posts/hello-world-rest-tlpp-annotations-rest-doc/), publicamos uma operação pequena e verificamos seus metadados no YAML produzido pelo REST-DOC. A etapa seguinte foi implementar uma resposta equivalente em AdvPL, usando `WSRESTFUL`, e repetir a exportação.

Os dois endpoints responderam corretamente às requisições autenticadas. Na documentação gerada, porém, o resultado foi diferente: a operação TL++ apareceu; a operação AdvPL não foi encontrada.

Essa comparação ajuda a delimitar o problema que o Protheus OpenAPI pretende investigar. Publicar um serviço e descobrir seus metadados são capacidades que precisam ser verificadas separadamente.

O artigo usa os fontes e o [diário do experimento na referência 65d8566](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/docs/experiments/hello-world.md). As execuções comparativas foram registradas em 21/08/2026; a referência também contém incrementos posteriores, que não fazem parte dessa validação.

## Uma comparação no mesmo ambiente

A proposta foi manter o comportamento das duas operações simples: receber um GET e devolver um JSON com mensagem, linguagem e status.

| Componente | Ambiente registrado |
|---|---|
| Protheus | `12.1.2510` |
| AppServer | `24.3.1.5`, build `7.00.240223P` |
| LIB | `20251006 - 20250923_19220` |
| TLPPCore | `01.06.01 — TLPP PANTHERA ONCA` |
| Base REST informada no roteiro | `http://localhost:8084/rest` |

As rotas publicadas foram `GET /api/v1/hello`, em TL++, e `GET /api/v1/hello-advpl`, em AdvPL. Elas tinham caminhos distintos para coexistir no mesmo ambiente e contratos equivalentes, com o campo `language` identificando a implementação.

Isso permite comparar publicação e descoberta documental sem introduzir regras de negócio, acesso a tabelas ou diferenças de processamento.

## O endpoint AdvPL

O [fonte hello-api-advpl.prw](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/examples/hello-world/hello-api-advpl.prw) declara o serviço com `WSRESTFUL` e descreve a operação por meio de `DESCRIPTION`, `WSSYNTAX`, `PATH` e `PRODUCES`:

```advpl
#include "totvs.ch"
#include "restful.ch"

WSRESTFUL api DESCRIPTION "Hello World AdvPL" FORMAT APPLICATION_JSON
    WSMETHOD GET Hello;
        DESCRIPTION "Retorna uma mensagem Hello World gerada por um endpoint AdvPL.";
        WSSYNTAX "/v1/hello-advpl";
        PATH "/v1/hello-advpl";
        PRODUCES APPLICATION_JSON
END WSRESTFUL
```

O método monta a resposta e a entrega ao serviço REST:

```advpl
WSMETHOD GET Hello WSSERVICE api

    Local lRet   := .T.
    Local jResp  := JsonObject():New()
    Local cResp  := ""

    jResp["message"]  := "Hello World"
    jResp["language"] := "AdvPL"
    jResp["status"]   := "success"
    cResp := jResp:ToJson()

    Self:SetContentType("application/json")
    Self:SetResponse(cResp)

Return lRet
```

O path declarado no método participa da composição da rota do serviço. A rota registrada para o endpoint AdvPL foi `/api/v1/hello-advpl`. A base `http://localhost:8084/rest` é a referência do roteiro; ao reproduzir o experimento, confira o prefixo efetivamente publicado pelo seu serviço, uma pendência já apontada no artigo anterior.

A existência desses metadados no fonte motivou a investigação: quais deles o mesmo gerador usado com annotations TL++ conseguiria aproveitar?

## Primeiro, confirmar o funcionamento por HTTP

O diário registra a compilação do fonte AdvPL sem erros e sua execução com autenticação. O corpo retornado foi:

```json
{"message":"Hello World","language":"AdvPL","status":"success"}
```

A versão TL++ retornou o mesmo contrato, com `"language":"TL++"`.

| Verificação | TL++ | AdvPL com `WSRESTFUL` |
|---|---|---|
| Compilação no RPO REST | Concluída | Concluída |
| Requisição sem credenciais | HTTP `401` | HTTP `401` |
| Requisição autenticada | HTTP `200` | HTTP `200` |
| Corpo esperado | Confirmado | Confirmado |

A proteção observada veio da configuração `SECURITY=1` do ambiente. O resultado não demonstra que o documento OpenAPI descreve autenticação; demonstra que os dois endpoints foram exercitados sob a mesma exigência de credenciais.

Essa etapa também elimina uma explicação imediata para a ausência documental: o serviço AdvPL estava publicado e respondia à chamada.

## Depois, gerar novamente a documentação

Após publicar o endpoint AdvPL, o experimento acionou outra exportação com:

```tlpp
tlpp.doc.generate("swagger", "hello_openapi", {8084}, {"pt-br"})
```

O modo `swagger` produziu um arquivo YAML declarando OpenAPI `3.0.3`. O acionador retornou HTTP `200`, e o diário registra a atualização do arquivo às 15:36:11 de 21/08/2026, com 54.260 bytes.

Conferir a atualização do artefato importa: consultar apenas uma exportação anterior à compilação do AdvPL não permitiria avaliar sua descoberta.

A inspeção encontrou `/api/v1/hello`, com verbo, resumo, descrição e resposta `200`. A busca direcionada não encontrou `/api/v1/hello-advpl` nem os demais marcadores AdvPL registrados no diário.

| Informação no YAML nativo | TL++ com annotation | AdvPL com `WSRESTFUL` |
|---|---|---|
| Path da operação | Presente | Ausente |
| Verbo `get` | Presente | Ausente |
| Resumo | Presente | Ausente |
| Descrição | Presente | Ausente |
| Resposta `200` | Presente | Ausente |

Na coluna AdvPL, “Ausente” significa que a operação inteira não foi encontrada no YAML. A comparação não permite avaliar como cada metadado de `WSRESTFUL` seria convertido caso a operação fosse descoberta.

A conclusão é delimitada: **no ambiente testado, com TLPPCore `01.06.01`, a geração nativa descobriu a operação baseada em annotation TL++, mas não emitiu a operação AdvPL do experimento**. Isso não estabelece uma regra para todas as versões ou formas de integração do Protheus.

## Um segundo problema: paths duplicados

O documento agregado também continha problemas estruturais em rotas padrão. Foram registradas 232 declarações de path, correspondentes a 226 paths únicos. Cinco grupos repetiam chaves YAML, separando verbos HTTP sob o mesmo caminho.

As duas rotas TL++ do experimento — Hello World e exportador — apareciam uma vez cada. A duplicidade pertencia a outros paths do documento, mas comprometia a estrutura do arquivo completo.

O normalizador do projeto consolidou grupos com verbos distintos, incorporando seis operações e produzindo 226 paths únicos. Ele recusa casos ambíguos, como repetir o mesmo verbo ou apresentar campos compartilhados incompatíveis. O diário registra 15 testes aprovados para essa etapa.

A normalização preserva as operações existentes. Ela não acrescenta o endpoint AdvPL ausente, pois não há metadados dessa operação no YAML a serem reorganizados.

O resultado normalizado foi aceito pelo validador do experimento. Esse validador tem escopo próprio e não equivale a uma verificação completa de todos os requisitos da especificação OpenAPI.

## O que conseguimos afirmar com essas evidências

A comparação separa três verificações:

1. **Execução:** o endpoint foi compilado e respondeu por HTTP.
2. **Descoberta:** seus metadados apareceram no arquivo exportado.
3. **Estrutura documental:** o conjunto de operações pôde ser processado sem as duplicidades detectadas.

O AdvPL passou pela primeira verificação, mas sua descoberta não foi observada. O TL++ teve execução e descoberta confirmadas, enquanto o documento agregado precisou de normalização por problemas em outras rotas.

O arquivo bruto e a saída normalizada permanecem locais, fora do Git. A base pública para o artigo é o registro técnico da execução e os fontes versionados; as fixtures de teste não devem ser apresentadas como exportações reais do ambiente.

## Como repetir a investigação

O [roteiro do experimento](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/docs/experiments/hello-world.md#roteiro-operacional) detalha os scripts de exportação, normalização e validação. Para repetir a comparação, mantenha a ordem das evidências:

1. Compile os dois endpoints e o acionador de exportação no RPO REST do ambiente.
2. Confirme os códigos HTTP e os corpos retornados pelas duas operações, com e sem autenticação.
3. Acione uma nova exportação depois da publicação dos fontes.
4. Confira se o arquivo foi atualizado e procure os dois paths e seus metadados.
5. Verifique duplicidades e, se necessário, normalize para outro arquivo, preservando o bruto.
6. Registre a versão do ambiente e os resultados encontrados.

As verificações estáticas em PowerShell ajudam a conferir os fontes, mas não substituem compilação nem chamadas HTTP. Da mesma forma, o retorno `200` do exportador precisa ser acompanhado da inspeção do documento produzido.

## O que essa lacuna significa para o projeto

O resultado sustenta uma direção para o Protheus OpenAPI: estudar uma forma de representar operações `WSRESTFUL` no modelo documental, preservando o comportamento dos serviços existentes.

Isso exige distinguir a coleta dos metadados da organização e serialização do contrato. Um modelo OpenAPI pode representar paths e respostas, mas ainda precisa receber as informações de cada operação por algum mecanismo.

Os commits de 10/09 avançaram nesse modelo com parâmetros, corpo da requisição, schemas e componentes reutilizáveis. O [diário desse incremento](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/docs/experiments/openapi-parameters-schemas.md) registra código e verificações estáticas, mas informa que compilação, PROBAT e testes HTTP reais ainda estavam pendentes naquela etapa.

Na referência analisada, a montagem do documento ainda era manual, e os adaptadores de descoberta automática de annotations e de leitura de `WSRESTFUL` estavam planejados. Portanto, esse avanço ainda não demonstra que a ausência observada na comparação foi resolvida.

## O aprendizado desta etapa

Os endpoints equivalentes permitiram observar uma diferença concreta entre execução e descoberta documental. A resposta HTTP confirmou os dois serviços; a inspeção da exportação mostrou qual deles o gerador conseguiu representar naquele ambiente.

Essa evidência orienta o próximo passo do laboratório: construir e validar os mecanismos necessários para documentar as operações que a geração nativa não incluiu, sem confundir código implementado com comportamento já comprovado em execução.

## Referências

- [Diário Hello World: ambiente, comparação e resultados](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/docs/experiments/hello-world.md)
- [Endpoint TL++](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/examples/hello-world/hello-api.tlpp)
- [Endpoint AdvPL com WSRESTFUL](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/examples/hello-world/hello-api-advpl.prw)
- [Parâmetros e schemas: implementação e validações pendentes](https://github.com/dirleiflsilva/protheus-openapi/blob/65d8566b84418cac3ef0a4a01ba04cbf65246adf/docs/experiments/openapi-parameters-schemas.md)
