---
title: "TDD com PROBAT e aprendizados de TL++"
date: 2026-11-18
draft: false
toc: true
slug: "tdd-probat-aprendizados-tlpp"
description: "TDD com PROBAT no Protheus OpenAPI: ciclos RED/GREEN, preservação do estado após falhas e aprendizados sobre compilação, coleções e encoding em TL++."
tags:
  - protheus
  - tlpp
  - advpl
  - probat
  - tdd
  - testes
  - openapi
topics:
  - Protheus e AdvPL
  - Engenharia de Software
series:
  - Protheus OpenAPI
series_order: 6
---

No [artigo anterior](/posts/por-que-criar-modelo-openapi-independente/), apresentei a decisão de separar descoberta, modelo e serialização no Protheus OpenAPI. O primeiro experimento foi pequeno: representar manualmente o contrato do Hello World e produzir um documento JSON sem depender de `tlpp.doc.generate()`.

Para implementar esse núcleo, precisei aprender como testar as regras em TL++ dentro do ambiente Protheus. Antes de construir o documento inteiro, havia uma pergunta mais básica: **como comprovar que o teste está sendo executado e consegue detectar uma falha?**

Neste artigo, mostro o caminho entre essa primeira verificação com PROBAT e os testes de composição do modelo. O recorte é o núcleo mínimo desenvolvido em agosto de 2026, com evidências preservadas no [diário técnico do experimento](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/docs/experiments/openapi-core-model.md).

## Primeiro, testar o próprio caminho de execução

O primeiro passo foi preparar o harness: a estrutura mínima para o PROBAT encontrar e executar os testes. Neste experimento, o fixture é a função `OApiTst`, que reúne a preparação dos objetos e as asserções sobre seu comportamento. Cada asserção compara um resultado observado com o esperado.

O [fixture do núcleo inicial](https://github.com/dirleiflsilva/protheus-openapi/blob/c7739f0/tests/openapi-core/custom.openapi.core.test.tlpp) usa os includes de TL++ e PROBAT, declara seu namespace e identifica a função com `@TestFixture()`. Abaixo está uma redução dessa estrutura para mostrar apenas a verificação inicial; o fixture completo inclui as classes e os demais cenários:

```tlpp
#include "tlpp-core.th"
#include "tlpp-probat.th"
#include "totvs.ch"

namespace custom.openapi.core.test

using namespace tlpp.probat

@TestFixture()
User Function OApiTst() as Logical

    assertEquals(.T., .T., "O harness PROBAT deve aceitar valores iguais.")

Return .T.
```

Uma asserção que compara dois valores iguais ajuda a verificar o caminho de sucesso. Para conferir a detecção de falhas, o experimento começou com uma comparação deliberadamente incorreta.

Em 24/08, o console registrou `ok: 0` e `err: 1`. Depois da correção, a execução terminou sem erro de assert. Essa sequência ficou associada ao commit `f25a72a`.

A falha intencional tinha uma finalidade: verificar que o fluxo observava o teste executado. Um resultado sem erros só seria útil depois de demonstrar que esse mesmo caminho também acusava um erro conhecido.

## Do RED inicial ao comportamento esperado

TDD é o desenvolvimento guiado por testes: escrever uma expectativa e observar sua falha (**RED**), implementar o necessário para atendê-la (**GREEN**) e refatorar mantendo os testes passando. O diário usado neste artigo registra os ciclos RED/GREEN; não detalha uma etapa de refatoração em cada incremento.

Com o harness conferido, a implementação avançou por partes: informações da API, respostas, operações, paths, documento e serializador.

O ciclo começava com uma expectativa expressa no teste. A execução falhava, a implementação era acrescentada e o fixture era executado novamente no RPO. O diário preserva os seguintes marcos:

| Etapa | Evidência de RED | Evidência de GREEN |
|---|---|---|
| Harness | Falha deliberada com `ok: 0`, `err: 1` | Execução sem erro de assert |
| Informações da API | `invalid class OAPIINFO` | Getters e validação de informações conferidos |
| Respostas | `invalid class OAPIRESP` | Preservação dos dados e pendências conferidas |
| Operações e paths | Classes ainda inexistentes | Inclusões válidas e rejeição de conflitos conferidas |
| Documento | Revisão voltou ao RED com sete asserts | Duplicidade, reutilização e validação transitiva conferidas |
| Serialização | `invalid class OAPIJSON` | Estrutura JSON e cenários com múltiplos elementos conferidos |

Um erro como `invalid class OAPIINFO` demonstra que o teste tentou usar uma classe ainda ausente. Ele confirma o primeiro RED, mas não basta para exercitar uma regra de negócio. Depois que a classe existe, o teste precisa distinguir uma implementação correta de uma que apenas permite instanciar o objeto. Uma execução que falha por configuração ou include ausente também não comprova a regra pretendida: é preciso conferir a causa da falha.

No caso de `OApiInfo`, por exemplo, o fixture verifica preservação de título, descrição e versão, além das pendências geradas quando título e versão estão vazios. Para operações, acrescenta normalização do verbo e rejeição de respostas duplicadas.

O ciclo RED/GREEN ajudou a construir a API pública em incrementos pequenos. A revisão dos próprios testes foi necessária para tornar essa proteção mais exigente.

## Lançar um erro é apenas parte do contrato

Uma regra do núcleo determina que duas respostas com o mesmo código não podem ser registradas na mesma operação. A segunda inclusão precisa falhar sem substituir a primeira.

Seria possível escrever um teste que verificasse somente a ocorrência da exceção. Esse teste deixaria uma pergunta aberta: o objeto continuou correto depois da tentativa?

O fixture verifica o diagnóstico e consulta novamente a coleção. Este é um trecho do teste, executado depois de já existir uma resposta `200` em `oOper`:

```tlpp
oDupResp := OApiResp():new("200", "Resposta que não deve substituir a original.")

Try
    oOper:addResp(oDupResp)
Catch oError
    lDupErr := .T.
    cDupErr := oError:Description
EndTry

assertEquals(.T., lDupErr, "Resposta duplicada deve falhar imediatamente.")
assertEquals("Resposta duplicada: 200.", cDupErr, "O erro deve diagnosticar o código duplicado.")

aResps := oOper:getResps()
assertEquals(1, Len(aResps), "A falha não deve incluir nem substituir a resposta original.")
If Len(aResps) >= 1
    assertEquals("Resposta retornada com sucesso.", aResps[1]:getDesc(), "A resposta original deve permanecer inalterada.")
EndIf
```

No fixture completo, as variáveis são declaradas no início da função e `lDupErr` começa com `.F.`. O trecho pressupõe que a resposta original foi criada com a descrição `Resposta retornada com sucesso.`. Conferir apenas o tamanho do array não detectaria uma substituição indevida: ele poderia continuar com um elemento, mas conter a resposta errada.

Depois da rejeição, o teste inclui uma nova resposta válida, com código `201`, e confere sua presença. Assim, também verifica se o objeto continua utilizável.

São três comportamentos ligados: recusar a duplicidade, preservar o estado anterior e continuar aceitando inclusões válidas. A mesma preocupação aparece nos testes de operações e paths.

Esse foi um aprendizado importante do experimento: quando uma operação pode falhar durante a composição, o contrato deve dizer o que acontece com o objeto após a falha.

## A revisão também pode começar outro RED

Na etapa do documento, a revisão acrescentou sete asserts para verificar duplicidade, reutilização e validação transitiva. O trabalho voltou ao RED e chegou a um novo GREEN em 25/08, registrado no commit `afcedd9`.

A validação transitiva verifica se uma pendência de um objeto interno chega ao documento com contexto suficiente. Uma operação sem respostas, por exemplo, precisa produzir um diagnóstico que identifique seu path e verbo.

Também foram exercitados múltiplos paths e a ordem determinística das pendências. Isso evita depender apenas do caso mais simples, no qual existe um único objeto em cada nível.

No serializador, a mesma ideia levou a cenários com dois paths, duas operações em um mesmo path e múltiplas respostas. Os testes interpretam o JSON e verificam sua estrutura, sem depender da ordem textual das propriedades.

O objetivo dessas verificações era proteger regras observáveis pelo cliente da biblioteca. A quantidade de asserts, isoladamente, não explica essa proteção.

## O que a compilação e o runtime ensinaram sobre TL++

Além das regras do modelo, o desenvolvimento encontrou detalhes que só uma leitura do código não resolveria.

### Um nome de atributo pode conflitar com o preprocessador

O identificador interno planejado como `cVer` conflitou com uma macro existente em `sigawin.ch`. O campo foi renomeado para `cApiVer`, preservando o método público `getVer()`.

A ocorrência mostrou por que a compilação no ambiente de destino faz parte da validação. Um nome aparentemente adequado dentro da classe pode ter outro significado depois da expansão dos includes.

A correção ficou no detalhe interno. Para quem usa o objeto, o acesso à versão continuou pelo mesmo método público.

### Devolver uma coleção exige definir o alcance da cópia

Os getters de coleções usam `AClone()` para proteger a composição dos arrays internos. O fixture altera o array devolvido, consulta o getter novamente e verifica que a inclusão externa não alterou a coleção mantida pelo objeto.

Essa proteção tem um limite: os objetos contidos continuam compartilhados. A cópia não transforma toda a árvore em objetos independentes nem torna o modelo imutável.

O teste precisa refletir essa promessa específica. Neste núcleo, a garantia é impedir alterações externas na composição dos arrays retornados.

### Encoding também faz parte do contrato dos fontes

Os fontes do experimento usam Windows-1252 sem BOM. O contrato estático verifica essa convenção, junto de includes, namespace e declarações esperadas.

Ao reproduzir o exemplo, é necessário preservar a convenção do projeto nos arquivos TL++. O Markdown deste artigo continua em UTF-8; copiar um trecho para um novo fonte exige atenção à codificação escolhida pelo editor.

## Cada verificação responde a uma pergunta

O experimento combinou verificações locais, compilação, PROBAT e chamadas HTTP. Cada uma forneceu um tipo diferente de evidência:

| Verificação | O que foi conferido no recorte |
|---|---|
| Contratos estáticos | Convenções dos fontes, encoding e dependências proibidas no núcleo |
| Compilação | Aceitação dos fontes e includes no ambiente Protheus |
| PROBAT no RPO | Comportamento das classes, rejeições e estrutura serializada |
| HTTP | Publicação da demonstração e comportamento de autenticação do AppServer |

O ambiente registrado foi Protheus `12.1.2510`, AppServer `24.3.1.5` e TLPPCore `01.06.01`. O PROBAT foi executado pelo fluxo disponível no TDS/AppServer. Os scripts locais não executam esses testes TL++ no RPO.

Os exemplos mostram o código do fixture, mas pressupõem um ambiente de compilação e execução já configurado. Os resultados relatados são os registros históricos de agosto; esta revisão do artigo não inclui uma nova execução no AppServer.

Para conferir os contratos locais no snapshot de referência, o diário orienta usar os scripts Python que substituíram os antigos arquivos PowerShell:

```bash
python tests/openapi-core/validate-sources.py
python scripts/validate-hello-openapi.py --path tests/openapi-core/fixtures/hello-core.json
```

Esses comandos devem ser executados na raiz do repositório Protheus OpenAPI. Eles não substituem a compilação e a execução do fixture `OApiTst` no ambiente configurado.

O [fixture histórico do núcleo mínimo](https://github.com/dirleiflsilva/protheus-openapi/blob/c7739f0/tests/openapi-core/custom.openapi.core.test.tlpp) contém 98 chamadas a `assertEquals()` no fonte, incluindo chamadas dentro de condicionais e de um laço. Essa contagem estática não corresponde necessariamente à quantidade de asserções executadas. O diário informa que várias execuções não preservaram a contagem final do PROBAT; por isso, esse número não deve ser apresentado como um relatório de 98 testes aprovados.

As evidências HTTP registram `401` sem autenticação e `200` com `application/json` na chamada autenticada. Elas complementam a validação do núcleo, mas não demonstram conformidade de qualquer documento com toda a especificação OpenAPI.

## O aprendizado que fica para o próximo incremento

O núcleo mínimo ofereceu um exercício concreto de TL++: representar objetos, definir regras de composição, testar falhas e produzir uma saída verificável. O PROBAT permitiu executar essas expectativas no ambiente em que as classes seriam usadas.

O processo também mostrou onde os testes precisavam melhorar. Depois de uma exceção, foi necessário verificar o estado preservado. Depois do primeiro objeto, foi necessário testar coleções com mais elementos. Depois do código escrito, foi necessário compilar com os includes reais.

Esse recorte ainda era manual: parâmetros, schemas e descoberta automática não faziam parte da primeira entrega. Os incrementos posteriores não mudam o que foi demonstrado nessa etapa.

Na próxima parte da série, vou detalhar a composição entre documento, paths, operações e respostas, incluindo a diferença entre conflitos rejeitados imediatamente e pendências acumuladas por `validate()`.

## Referências

- [Diário técnico: ciclos RED/GREEN, ambiente e aprendizados](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/docs/experiments/openapi-core-model.md)
- [Fixture histórico do núcleo mínimo, com 98 chamadas a assertEquals](https://github.com/dirleiflsilva/protheus-openapi/blob/c7739f0/tests/openapi-core/custom.openapi.core.test.tlpp)
- [Especificação e rastreabilidade CORE-01 a CORE-18](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/.specs/features/openapi-core-model/spec.md)
