---
title: "DBOrderNickname no Protheus: um recurso pouco conhecido do AdvPL"
date: 2026-03-15
draft: false
toc: true
categories:
  - Protheus
  - AdvPL
tags:
  - advpl
  - protheus
  - totvs
  - índice
  - DBOrderNickname
description: "Aprenda a utilizar DBOrderNickname no AdvPL para tornar seu código Protheus mais seguro e legível."
---

Durante o desenvolvimento de rotinas no **TOTVS Protheus**, é comum trabalhar com múltiplos índices em uma tabela.

Normalmente utilizamos `DBSetOrder()` informando apenas o **número do índice**, mas existe uma alternativa mais segura e legível: **`DBOrderNickname()`**.

Surpreendentemente, muitos desenvolvedores não sabem que esse recurso existe.

Neste post vou mostrar como utilizar essa função e por que ela pode tornar seu código mais robusto.

---

## O problema do `DBSetOrder()`

O uso tradicional funciona assim:

```advpl
dbSelectArea("SBM")
dbSetOrder(3)
```

O problema dessa abordagem é que o número do índice pode mudar.

Se alguém alterar o dicionário ou incluir novos índices, o código pode passar a apontar para outro índice sem que você perceba.

Isso torna o código:

- frágil
- difícil de manter
- dependente da posição do índice

Em projetos grandes ou mantidos por várias pessoas, isso pode gerar erros difíceis de identificar. Outra situação muito comum de ocorrer esse problema, é na atualização do Protheus, o famoso `UPDDISTR`, onde novos índices tem prioridade sobre os índices customizados, "empurrando" o índice customizado para o final da fila na SIX, alterando o sequencial.

---

## Comparação entre `DBSetOrder()` e `DBOrderNickname()`

| Método | Exemplo | Problema |
|------|------|------|
| `DBSetOrder()` | `DBSetOrder(3)` | Depende da posição do índice |
| `DBOrderNickname()` | `DBOrderNickname("XSTATUS")` | Independente da posição |

Em projetos maiores, utilizar `DBOrderNickname()` evita erros quando novos índices são criados no dicionário.

---

## O que é `DBOrderNickname()`

A função `DBOrderNickname()` permite selecionar um índice utilizando o nickname definido no dicionário de dados.

Exemplo:

```advpl
DBOrderNickname("XSTATUS")
```

Dessa forma, o código fica independente da posição do índice no dicionário.

Mesmo que novos índices sejam criados ou alterados, o código continuará funcionando corretamente.

---

## Como configurar o nickname

No dicionário de dados do Protheus, ao criar um índice (SIX), é possível definir um nickname.

Exemplo de índice na tabela SBM:

```text
BM_FILIAL + BM_XSTATUS
```

Nickname definido:

```text
XSTATUS
```

Esse nickname passa a ser a referência lógica do índice.

![Cadastro do índice SIX com nickname](/images/posts/dbordernickname/nickname-index.png)

---

## Usando no código AdvPL

Depois de configurado no dicionário, basta utilizar no código:

```advpl
dbSelectArea("SBM")
DBOrderNickname("XSTATUS")

If dbSeek(xFilial("SBM") + cCodigo)
    // registro encontrado
EndIf
```

Observe como o código fica mais expressivo e legível.

Quem ler esse código saberá imediatamente qual índice está sendo utilizado.

---

## Vantagens dessa abordagem

Principais benefícios de utilizar `DBOrderNickname()`:

- Código mais legível
- Independência da posição do índice
- Menor risco de erro em manutenção futura
- Melhor documentação implícita do código

Em equipes maiores ou projetos longos, pequenas práticas como essa fazem uma grande diferença.

---

## Resumo rápido

| Situação | Melhor prática |
|---|---|
| Selecionar índice por posição | Evitar quando possível |
| Selecionar índice por nickname | Preferir com `DBOrderNickname()` |
| Manutenção de longo prazo | Usar nomes semânticos no dicionário |

---

## Conclusão

Embora seja um recurso simples, o uso de `DBOrderNickname()` melhora bastante a qualidade do código AdvPL.

Sempre que possível, prefira utilizar o nickname do índice em vez da posição numérica.

Essa é uma pequena prática que ajuda a tornar o código mais robusto, mais claro e mais fácil de manter ao longo do tempo.

Se você trabalha com Protheus / AdvPL, vale a pena revisar seus projetos e considerar essa abordagem.

---

Referência oficial:  
https://tdn.totvs.com/display/tec/DBOrderNickname
https://tdn.totvs.com/pages/releaseview.action?pageId=271415266
