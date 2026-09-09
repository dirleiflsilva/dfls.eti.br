---
title: "Hello World REST em TL++: annotations e geração nativa com REST-DOC"
date: 2026-09-09
draft: false
toc: true
slug: "hello-world-rest-tlpp-annotations-rest-doc"
description: "Publicando um Hello World REST em TL++, validando a resposta HTTP e investigando a geração nativa de OpenAPI com tlpp.doc.generate()."
tags:
  - protheus
  - tlpp
  - openapi
  - rest
  - rest-doc
topics:
  - Protheus e AdvPL
  - Engenharia de Software
series:
  - Protheus OpenAPI
series_order: 2
---

O primeiro experimento do Protheus OpenAPI começou com uma rota pequena: receber uma requisição GET e devolver um JSON com três campos.

Esse recorte permitiu investigar duas perguntas: consigo publicar um endpoint REST em TL++ no ambiente do laboratório? E quais informações desse endpoint aparecem na documentação produzida pelo gerador nativo?

No [artigo de apresentação](/posts/protheus-openapi-jornada-tlpp-documentar-apis-rest/), mostrei como essa investigação contribuiu para a proposta do projeto. Agora, vou detalhar o caminho entre o fonte TL++, a resposta HTTP e o artefato gerado pelo REST-DOC.

A implementação e os resultados apresentados aqui estão registrados no [diário do experimento Hello World](https://github.com/dirleiflsilva/protheus-openapi/blob/d90f297f7927303672e58c902c44f0906780378f/docs/experiments/hello-world.md). Este artigo usa o repositório na referência `d90f297` e acompanha uma etapa inicial da jornada, mesmo que o código já contenha incrementos posteriores.

## O ambiente em que o experimento foi executado

O laboratório utilizou um serviço REST existente no Protheus, com segurança habilitada e compilação dos fontes no RPO do ambiente REST.

| Componente | Versão ou configuração registrada |
|---|---|
| Protheus | `12.1.2510` |
| AppServer | `24.3.1.5`, build `7.00.240223P` |
| LIB | `20251006 - 20250923_19220` |
| TLPPCore | `01.06.01 - TLPP PANTHERA ONCA` |
| Serviço REST | Porta `8084`, base informada no roteiro: `/rest` |
| Segurança | `SECURITY=1` |

Essas versões delimitam a evidência do artigo. A compilação, a descoberta das annotations e a saída do gerador foram observadas nessa combinação.

Para acompanhar o roteiro, é necessário ter um ambiente Protheus com REST configurado, includes TL++ disponíveis e acesso à compilação no RPO correspondente. O repositório não distribui o ambiente Protheus nem uma configuração completa de AppServer.

Os fontes usados nesta etapa estão em:

```text
examples/hello-world/
├── hello-api.tlpp
└── openapi-export.tlpp
```

O primeiro implementa a resposta da API. O segundo aciona a exportação nativa no laboratório.

## Definindo um contrato pequeno

A operação escolhida foi `GET /api/v1/hello`, com resposta HTTP `200`, conteúdo `application/json` e este corpo:

```json
{
  "message": "Hello World",
  "language": "TL++",
  "status": "success"
}
```

O exemplo não consulta tabelas nem depende de regras de negócio. Isso reduz as variáveis durante a investigação: consigo observar publicação da rota, autenticação, serialização e descoberta documental sem precisar preparar dados de aplicação.

O contrato também fornece uma referência objetiva para o teste. Receber HTTP `200` é uma verificação; confirmar o tipo de conteúdo e os valores do JSON é outra.

## Implementando o endpoint com annotation

O fonte `hello-api.tlpp`, omitindo apenas o comentário ProtheusDOC, contém:

```tlpp
#include "tlpp-core.th"
#include "tlpp-rest.th"

@Get(;
    endpoint="/api/v1/hello",;
    title="Hello World",;
    description="Retorna uma mensagem Hello World gerada por um endpoint TL++.",;
    responses='[{"statusCode":200,"description":"Hello World retornado com sucesso."}]';
)
User Function HloApi() as Logical

    Local jResp := JsonObject():New() as Json
    Local cResp := "" as Character

    jResp["message"]  := "Hello World"
    jResp["language"] := "TL++"
    jResp["status"]   := "success"
    cResp := jResp:ToJson()

    oRest:SetStatusCode(200)
    oRest:SetKeyHeaderResponse("Content-Type", "application/json")

Return oRest:SetResponse(cResp)
```

A annotation `@Get` reúne a rota e os metadados documentais próximos da função que atende à requisição.

| Campo | Valor ou papel neste exemplo |
|---|---|
| `endpoint` | Caminho `/api/v1/hello` |
| `title` | Título usado como resumo da operação gerada |
| `description` | Explicação da operação |
| `responses` | Array JSON textual com status e descrição da resposta |

O campo `responses` merece atenção: seu conteúdo é uma string contendo JSON. Neste exemplo, as aspas simples delimitam a string TL++ e as aspas duplas pertencem ao JSON interno.

A implementação constrói o corpo com `JsonObject()` e o serializa com `ToJson()`. Depois, define o status HTTP, o cabeçalho de conteúdo e envia a resposta por `oRest:SetResponse()`.

Há duas responsabilidades visíveis no fonte: os metadados descrevem a operação, enquanto o corpo da função produz a resposta. Alterar um lado exige conferir o outro para preservar a coerência do contrato.

Por exemplo, a annotation informa que existe uma resposta `200`, mas não descreve o schema dos campos `message`, `language` e `status`. O experimento comprova a descoberta dos metadados declarados; ele não demonstra inferência automática da estrutura do payload.

## Compilação e verificação HTTP

Os dois fontes TL++ foram compilados no RPO REST em 21/08/2026, conforme o diário técnico. Os arquivos do repositório usam Windows-1252 sem BOM, convenção também verificada pelos contratos locais do projeto.

Antes de reproduzir a compilação, confira o encoding no editor e o RPO de destino. Um fonte disponível no repositório ainda precisa ser compilado e carregado no ambiente que atende à requisição.

Para a chamada, use a URL efetivamente publicada pelo seu serviço. Os comandos abaixo adotam a base `http://localhost:8084/rest`, informada no roteiro. O diário ainda registra como pendente a confirmação do prefixo real de publicação e do endereço da interface de documentação; ajuste a URL conforme a configuração do seu ambiente.

Primeiro, faça a chamada sem credenciais para verificar o comportamento do serviço com segurança habilitada:

```powershell
curl.exe --include "http://localhost:8084/rest/api/v1/hello"
```

Depois, repita a chamada com autenticação:

```powershell
curl.exe --user "USUARIO_PROTHEUS" --include "http://localhost:8084/rest/api/v1/hello"
```

Substitua `USUARIO_PROTHEUS` pelo seu usuário e informe a senha quando o cliente solicitar.

As verificações registradas no experimento foram:

| Chamada | Resultado observado |
|---|---|
| Sem credenciais | HTTP `401` |
| Com autenticação | HTTP `200` |
| Tipo de conteúdo autenticado | `application/json` |
| Corpo autenticado | Os três campos e valores definidos no contrato |

A autenticação foi herdada da configuração do serviço. Não há lógica de autenticação implementada na função `HloApi()`.

Esse primeiro resultado confirma o comportamento HTTP observado. A etapa seguinte verifica o que o mecanismo de documentação consegue extrair da operação.

## Acionando o gerador nativo

O segundo fonte declara uma rota de laboratório, `GET /api/v1/openapi/export`, que chama:

```tlpp
tlpp.doc.generate("swagger", "hello_openapi", {8084}, {"pt-br"})
```

Na chamada usada pelo projeto, os argumentos selecionam o formato `swagger`, o nome base `hello_openapi`, a porta REST `8084` e o idioma `pt-br`.

O corpo da função exportadora é:

```tlpp
User Function GenOApi() as Logical

    Local lOk   := .T. as Logical
    Local jResp := JsonObject():New() as Json
    Local cResp := "" as Character

    Begin Sequence
        tlpp.doc.generate("swagger", "hello_openapi", {8084}, {"pt-br"})
    Recover
        lOk := .F.
    End Sequence

    If lOk
        jResp["success"] := .T.
        jResp["message"] := "Exportação OpenAPI solicitada com sucesso."
        oRest:SetStatusCode(200)
    Else
        jResp["success"] := .F.
        jResp["message"] := "Falha ao solicitar a exportação OpenAPI."
        oRest:SetStatusCode(500)
    EndIf

    cResp := jResp:ToJson()
    oRest:SetKeyHeaderResponse("Content-Type", "application/json")

Return oRest:SetResponse(cResp)
```

O fonte completo, incluindo includes e annotation, está em [openapi-export.tlpp](https://github.com/dirleiflsilva/protheus-openapi/blob/d90f297f7927303672e58c902c44f0906780378f/examples/hello-world/openapi-export.tlpp).

Após compilar o fonte, acione a exportação com o mesmo usuário e a base REST conferida na etapa anterior:

```powershell
curl.exe --user "USUARIO_PROTHEUS" --include "http://localhost:8084/rest/api/v1/openapi/export"
```

Essa rota foi criada como acionador experimental. Ela executa uma geração de arquivo no servidor, e a porta está fixada no fonte para o cenário do lab. Seu uso como interface operacional em outro contexto exigiria avaliar acionamento, autorização e tratamento de falhas.

A função devolve JSON informando que a exportação foi solicitada. Ela não devolve o documento OpenAPI no corpo da resposta e não valida o conteúdo do arquivo gerado.

O `Begin Sequence` e o `Recover` tratam falhas que acionem esse mecanismo de recuperação. Assim, o retorno `success: true` indica apenas que a execução não passou pelo `Recover`; ainda é necessário localizar e validar o YAML.

## O aprendizado com os formatos `json` e `swagger`

A primeira tentativa utilizou o modo `json`. O console registrou mensagens de conteúdo JSON documental inválido, e o artefato produzido representava a estrutura interna do REST-DOC, com problemas de escape em valores aninhados como `responses`.

Na investigação registrada pelo projeto, foi necessário mudar o primeiro argumento para `swagger` para obter a especificação em YAML.

Depois da correção, recompilação e execução, o arquivo declarou:

```yaml
openapi: 3.0.3
```

O nome do modo de exportação, portanto, não foi suficiente para determinar a versão da especificação. A versão foi confirmada no artefato efetivamente produzido.

No ambiente testado, o arquivo recebeu o nome `hello_openapi_8084.yaml` e foi gravado em `protheus_data/system`. A localização é um resultado observado no laboratório; confira a saída do seu AppServer ao reproduzir a chamada.

## O que apareceu na documentação

O gerador incluiu `GET /api/v1/hello`, com o resumo, a descrição e a resposta `200` definidos na annotation. A rota TL++ de exportação também foi descoberta.

O trecho abaixo é uma representação didática dos metadados confirmados no diário, e não uma cópia integral do YAML bruto:

```yaml
paths:
  /api/v1/hello:
    get:
      summary: Hello World
      description: Retorna uma mensagem Hello World gerada por um endpoint TL++.
      responses:
        '200':
          description: Hello World retornado com sucesso.
```

Esse resultado liga a declaração no fonte ao conteúdo documental. Ele também deixa claro o alcance do primeiro incremento: temos uma operação identificada e uma resposta descrita, ainda sem demonstrar um contrato completo de payload e segurança.

O HTTP `401` observado no teste, por exemplo, não aparece no array `responses` do Hello World. Registrar o comportamento de runtime e verificar a documentação são atividades complementares.

## O arquivo completo trouxe uma segunda camada de validação

Embora as rotas do experimento tenham sido documentadas, o YAML agregado apresentou paths duplicados de outras rotas do ambiente.

O diário registra 232 declarações para 226 paths únicos. Cinco grupos continham chaves repetidas, tornando o documento bruto inválido. Um dos paths apareceu três vezes, o que explica as seis declarações excedentes. O arquivo também foi gravado em Windows-1252, o que exige atenção ao abri-lo em um editor configurado para UTF-8.

São problemas diferentes: interpretar os caracteres com o encoding correto não resolve a repetição de chaves.

Esse resultado impõe uma distinção prática entre três verificações:

1. o exportador respondeu à requisição;
2. o documento contém os metadados esperados do Hello World;
3. o documento completo pode ser consumido corretamente.

O experimento obteve evidência para as duas primeiras, mas identificou um problema na terceira. O projeto passou então a preservar o arquivo bruto e trabalhar com uma saída normalizada separada.

A normalização e seus critérios ficam para um artigo próprio. Nesta etapa, o aprendizado é verificar o artefato completo antes de considerar encerrada a geração documental.

## As verificações disponíveis no repositório

Os contratos estáticos dos dois fontes podem ser executados a partir da raiz do projeto, em um ambiente com Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/hello-world/validate-sources.ps1 -Target hello
powershell -NoProfile -ExecutionPolicy Bypass -File tests/hello-world/validate-sources.ps1 -Target export
```

Esses scripts verificam convenções de encoding, declarações e padrões esperados nos fontes, incluindo o JSON de `responses`. Eles não substituem o compilador TL++ nem a chamada HTTP ao AppServer.

O próximo comando depende da saída normalizada, que não vem pronta no repositório. Prepare-a seguindo a seção [Normalização segura do YAML completo no diário](https://github.com/dirleiflsilva/protheus-openapi/blob/d90f297f7927303672e58c902c44f0906780378f/docs/experiments/hello-world.md#normalização-segura-do-yaml-completo) e, depois, verifique o contrato documental:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-hello-openapi.ps1 -Path artifacts/local/hello-openapi-normalized.yaml
```

O validador do projeto procura os metadados esperados da operação e rejeita paths duplicados. Seu escopo é o contrato do experimento; ele não implementa uma validação completa de toda a especificação OpenAPI.

O arquivo bruto do ambiente permanece fora do Git. As fixtures versionadas servem aos testes e não devem ser confundidas com uma exportação real. O snapshot sanitizado é uma saída prevista no roteiro, mas não está presente na referência do repositório utilizada neste artigo.

Para reproduzir a investigação, a sequência é compilar os fontes, confirmar a resposta HTTP, acionar a geração, localizar o arquivo e avaliar seu conteúdo. Cada etapa oferece uma evidência diferente.

## O resultado desta etapa

O Hello World mostrou que, no ambiente documentado, a annotation TL++ permitiu publicar a operação e fornecer metadados reconhecidos pelo REST-DOC. A exportação em modo `swagger` produziu YAML declarando OpenAPI `3.0.3`, com o path e a resposta esperados.

A investigação também mostrou por que o retorno do acionador precisa ser acompanhado da inspeção do arquivo: o documento agregado continha problemas estruturais, apesar de as rotas TL++ do experimento terem sido descobertas.

Com essa referência estabelecida, a próxima pergunta da série será como um endpoint equivalente em AdvPL, construído com `WSRESTFUL`, se comporta diante da mesma descoberta documental.

O código e as evidências desta etapa estão no [experimento Hello World do Protheus OpenAPI](https://github.com/dirleiflsilva/protheus-openapi/tree/d90f297f7927303672e58c902c44f0906780378f/examples/hello-world). A visão geral da jornada está na [página do projeto](/projects/protheus-openapi/).
