---
title: "Funções pequenas e responsabilidade única em AdvPL"
date: 2026-09-21
draft: false
toc: true
slug: "funcoes-pequenas-responsabilidade-unica-advpl"
description: "Como separar regras, apresentação e efeitos em rotinas AdvPL, com contratos explícitos e uma refatoração pequena que preserva o comportamento."
tags:
  - advpl
  - protheus
  - engenharia de software
  - refatoração
  - testabilidade
topics:
  - Protheus e AdvPL
  - Engenharia de Software
---

Uma validação começa com poucas condições. Depois recebe uma mensagem na tela, uma consulta de parâmetro, uma atualização de registro e uma exceção para determinado processo. Quando alguém precisa mudar a regra, já é difícil saber quais outros comportamentos serão afetados.

No artigo [AdvPL não precisa ser código legado](/posts/advpl-nao-precisa-ser-codigo-legado/), discuti como decisões de organização influenciam o custo de manutenção. Aqui, vamos trabalhar uma dessas decisões: separar responsabilidades dentro de uma rotina sem transformar uma alteração pequena em uma reescrita.

O tamanho de uma função ajuda a perceber problemas, mas a quantidade de linhas não é um critério suficiente. O que precisamos entender é quais decisões ela concentra, de quais informações depende e quais efeitos produz.

## Uma função curta também pode misturar responsabilidades

Considere uma regra didática: o desconto deve estar entre zero e o limite recebido pela rotina, incluindo os extremos. Além disso, o valor do pedido precisa ser positivo.

Os exemplos são didáticos, sem acesso a tabelas ou execução registrada em AppServer. A regra é fictícia e não reproduz uma rotina padrão do Protheus. Consideramos três parâmetros numéricos: `nValor` é o valor do pedido, `nPerc` é o percentual de desconto e `nLimite` é o percentual máximo permitido, entre `0` e `100`. Um desconto de 10% é informado como `10`. O chamador deve validar os tipos e a configuração antes de acionar a regra.

O exemplo abaixo valida os valores e apresenta uma mensagem em caso de rejeição:

```advpl
Static Function VldDesc(nValor, nPerc, nLimite)

    If nValor <= 0
        MsgStop("O valor do pedido deve ser positivo.")
        Return .F.
    EndIf

    If nPerc < 0 .Or. nPerc > nLimite
        MsgStop("Desconto fora do limite permitido.")
        Return .F.
    EndIf

Return .T.
```

São poucas linhas, mas há duas decisões distintas: quando rejeitar os dados e como comunicar a rejeição. Uma mudança na regra comercial e uma mudança na apresentação alcançam a mesma função.

Se amanhã essa validação for necessária em uma integração, a mensagem de tela deixa de ser uma forma adequada de devolver o problema. A regra continua útil; sua dependência da interface dificulta o reaproveitamento.

## Separando a decisão da mensagem

Uma primeira extração é devolver o resultado da regra sem apresentar nada na tela:

```advpl
Static Function RegDesc(nValor, nPerc, nLimite)

    Local cErro := ""

    If nValor <= 0
        cErro := "VALOR_INVALIDO"
    ElseIf nPerc < 0 .Or. nPerc > nLimite
        cErro := "DESCONTO_INVALIDO"
    EndIf

Return cErro
```

O contrato é pequeno: retorna uma string vazia quando os valores atendem à regra e um código quando há rejeição. A função não consulta parâmetros, não altera registros e não abre mensagens.

A escolha por códigos permite que o chamador decida como apresentar o resultado. Uma interface pode mostrar texto; uma integração pode mapear o mesmo código para uma resposta adequada ao seu contrato.

Para manter o comportamento da função anterior, seu corpo passa a usar a regra extraída:

```advpl
Static Function VldDesc(nValor, nPerc, nLimite)

    Local cErro := RegDesc(nValor, nPerc, nLimite)

    Do Case
    Case cErro == "VALOR_INVALIDO"
        MsgStop("O valor do pedido deve ser positivo.")
    Case cErro == "DESCONTO_INVALIDO"
        MsgStop("Desconto fora do limite permitido.")
    EndCase

Return cErro == ""
```

As comparações de `cErro` usam `==`, operador de igualdade exata de strings em AdvPL. Isso inclui a comparação com `""`: o sucesso exige uma string realmente vazia. A distinção entre `=` e `==` está descrita na [documentação de operadores da TOTVS](https://tdn.totvs.com/display/tec/Operadores+Comuns).

Esse segundo bloco substitui a primeira versão de `VldDesc`; não são duas funções para manter com o mesmo nome no fonte. A função `RegDesc` fica no mesmo arquivo.

O fluxo que já chama `VldDesc` continua recebendo um lógico e vendo as mesmas mensagens. Agora, quem precisa somente da decisão pode usar `RegDesc` dentro desse fonte.

A declaração `Static Function` restringe a chamada às funções do mesmo arquivo `.PRW`, conforme a [documentação de funções AdvPL da TOTVS](https://tdn.totvs.com/display/framework/FUNCTION). Essa visibilidade atende ao exemplo; compartilhar a regra entre fontes exigiria escolher uma interface apropriada ao projeto.

## O contrato inclui a ordem das rejeições

Separar funções só é uma refatoração se o comportamento que queremos preservar continuar o mesmo.

Na versão inicial, um pedido com valor inválido retorna antes da verificação de desconto. A versão extraída mantém essa prioridade com `ElseIf`. Se os dois valores estiverem incorretos, o resultado continua sendo `VALOR_INVALIDO`.

Também preservamos os limites: desconto zero é aceito, e desconto exatamente igual ao limite é aceito. Trocar `>` por `>=` durante a extração mudaria a regra.

Alguns casos úteis para conferir o contrato são:

| Valor do pedido | Desconto (%) | Limite (%) | Retorno esperado de `RegDesc` |
|---:|---:|---:|---|
| 100 | 0 | 10 | String vazia |
| 100 | 5 | 10 | String vazia |
| 100 | 10 | 10 | String vazia |
| 100 | 11 | 10 | `DESCONTO_INVALIDO` |
| 100 | -1 | 10 | `DESCONTO_INVALIDO` |
| 0 | 5 | 10 | `VALOR_INVALIDO` |
| -1 | 11 | 10 | `VALOR_INVALIDO` |
| 100 | 0 | 0 | String vazia |
| 100 | 1 | 0 | `DESCONTO_INVALIDO` |
| 100 | 100 | 100 | String vazia |

São resultados esperados pela regra apresentada, não uma evidência de testes executados. Antes de usar o código em uma customização, compile no ambiente de desenvolvimento e transforme os casos relevantes em verificações reproduzíveis.

Na função `VldDesc`, confira também o retorno lógico e a apresentação: casos aceitos retornam `.T.` sem mensagem; casos rejeitados retornam `.F.` com a mesma mensagem da versão inicial. Quando valor e desconto são inválidos, apenas a mensagem sobre o valor do pedido deve aparecer.

Se novos códigos forem acrescentados a `RegDesc`, seus consumidores também precisam tratar esses resultados. Um contrato explícito facilita localizar esse trabalho, mas não elimina a necessidade de mantê-lo consistente.

## De onde vêm os dados também importa

No exemplo, `nLimite` chega como argumento. Assim, a regra não precisa descobrir se o valor veio de um parâmetro, de uma configuração ou de uma consulta.

Uma função pode ser curta e ainda depender de informações que sua assinatura não revela: variável compartilhada, alias selecionado, registro corrente ou contexto de filial. Extrair esse código sem identificar essas dependências apenas muda o problema de lugar.

Ao revisar uma rotina real, anote o que ela lê e o que modifica. A pergunta prática é: consigo entender os dados necessários para chamar esta função sem reconstruir todo o fluxo anterior?

Nem sempre será possível remover de imediato uma dependência do ambiente. Nesse caso, explicite-a e mantenha a adaptação próxima da fronteira que conhece o Protheus. A regra isolada deve receber os dados de que realmente precisa.

## Responsabilidade única não significa uma linha por função

Responsabilidade única ajuda a agrupar o que muda pelo mesmo motivo. Neste recorte, as condições comerciais ficam em `RegDesc`, e a apresentação da rejeição fica em `VldDesc`.

`RegDesc` verifica valor e desconto porque ambos fazem parte da decisão definida para esse exemplo. Criar uma função para cada comparação não acrescentaria necessariamente clareza.

A extração se torna útil quando dá nome a uma decisão, permite verificá-la separadamente ou delimita uma dependência que muda por outra razão. Já uma sequência de funções com nomes genéricos, que exigem navegar por vários arquivos para entender uma condição simples, pode piorar a leitura.

Também é legítimo ter uma função que coordena o processo. Ela pode carregar dados, chamar uma regra e encaminhar o resultado, desde que deixe os detalhes dessas etapas nos lugares adequados.

O critério é a coesão: as instruções reunidas ali contribuem para uma responsabilidade compreensível? Uma alteração na forma de mostrar erros deveria exigir rever a regra de desconto? Uma alteração no acesso a dados deveria mudar os casos que validam essa regra?

## E quando existe gravação no banco?

Uma rotina de negócio real costuma ter efeitos além de mensagens. Pode abrir consultas, bloquear registros, gravar dados ou controlar uma transação.

Esses limites precisam ser preservados durante a refatoração. Mover um trecho de gravação para outra função não autoriza alterar quando o bloqueio é adquirido, quando a transação termina ou como o erro retorna ao chamador.

Comece pela parte que permite uma mudança pequena e verificável. Isolar uma decisão que trabalha sobre valores recebidos costuma oferecer um recorte mais simples do que reorganizar simultaneamente persistência, interface e integração.

A validação isolada também não garante que os dados continuarão válidos no momento de gravar. Quando há concorrência, a rotina precisa considerar o estado efetivo dentro do fluxo de atualização. Essa responsabilidade permanece no desenho da operação.

## Uma sequência prática para refatorar

Antes de editar, descreva o comportamento atual, incluindo as exceções que precisam continuar existindo. Depois:

1. Identifique uma regra ou dependência que possa ser separada com um contrato pequeno.
2. Registre entradas, saídas, prioridade dos erros e efeitos observáveis.
3. Extraia o trecho, mantendo a função original como ponto de entrada quando isso reduzir o impacto.
4. Confira casos normais, limites e rejeições, além dos efeitos que devem permanecer iguais.
5. Compile e valide o fluxo no ambiente apropriado antes de ampliar a mudança.

Evite aproveitar a mesma extração para trocar mensagens, corrigir regras comerciais e reorganizar transações. Mudanças desse tipo podem ser necessárias, mas avaliá-las separadamente torna mais fácil entender qual comportamento mudou e por quê.

## O ganho aparece na próxima alteração

Depois da extração, uma mudança na regra de desconto tem um lugar definido e casos concretos para comparação. Uma mudança na apresentação pode acontecer no chamador. O fluxo existente continua tendo um ponto de entrada conhecido.

Esse é um resultado útil mesmo sem criar classes ou uma arquitetura nova. Funções pequenas ajudam quando tornam decisões e dependências mais fáceis de compreender; o objetivo é facilitar a próxima mudança com um risco que consiga ser avaliado.

## Referências

- [TOTVS TDN: declaração e visibilidade de funções AdvPL](https://tdn.totvs.com/display/framework/FUNCTION)
- [TOTVS TDN: operadores comuns, incluindo comparação de strings](https://tdn.totvs.com/display/tec/Operadores+Comuns)
- [AdvPL não precisa ser código legado](/posts/advpl-nao-precisa-ser-codigo-legado/)
