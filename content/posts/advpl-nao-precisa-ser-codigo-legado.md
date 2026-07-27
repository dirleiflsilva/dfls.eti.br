---
title: "AdvPL não precisa ser código legado: Engenharia de Software aplicada ao Protheus"
date: 2026-07-27
draft: false
toc: true
slug: "advpl-nao-precisa-ser-codigo-legado"
description: "AdvPL é associado a sistemas legados, mas muitos problemas atribuídos à linguagem resultam de decisões de arquitetura, organização e manutenção."
tags:
  - advpl
  - protheus
  - engenharia de software
  - código legado
  - arquitetura
categories:
  - Engenharia de Software com AdvPL
---

AdvPL é frequentemente associado a código legado.

A associação não surgiu por acaso. Existem customizações Protheus desenvolvidas há muitos anos, funções extensas, dependência de estado compartilhado, regras de negócio misturadas com interface, acesso direto a tabelas e poucos testes automatizados.

Também existem projetos sem documentação, sem estratégia clara de versionamento e com alterações realizadas diretamente em código antigo, porque ninguém conhece completamente os efeitos de uma mudança.

Mas existe uma distinção importante:

> Uma linguagem com muitos sistemas antigos não é, por definição, uma linguagem incapaz de produzir software bem estruturado.

O problema não está necessariamente no AdvPL. Muitas vezes, está na forma como o software foi projetado, desenvolvido, mantido e evoluído.

## O que realmente caracteriza um código legado?

É comum definir código legado apenas como código antigo.

Essa definição é insuficiente.

Um código pode ter muitos anos e continuar relativamente seguro de manter. Outro pode ter sido criado na semana passada e já apresentar sérios problemas de manutenção.

Não existe uma única definição, mas, na prática, código legado costuma apresentar características como:

- comportamento difícil de compreender;
- alto risco de regressão;
- dependências ocultas;
- acoplamento excessivo;
- ausência de testes;
- ausência de documentação;
- dificuldade para reproduzir o ambiente;
- medo de alterar qualquer trecho;
- regras de negócio espalhadas por diferentes pontos do sistema.

Portanto, a idade é apenas um dos fatores.

A principal característica do código legado é o custo e o risco de modificá-lo.

## Por que isso aparece tanto em ambientes Protheus?

O Protheus é um ERP extenso, utilizado em contextos empresariais complexos.

Customizações podem envolver:

- regras fiscais;
- processos financeiros;
- integrações;
- faturamento;
- estoque;
- documentos eletrônicos;
- rotinas específicas de cada empresa;
- pontos de entrada;
- atualizações do produto padrão.

Em muitos casos, uma customização inicialmente pequena cresce ao longo dos anos.

Uma validação vira uma rotina. A rotina ganha uma integração. A integração passa a consultar várias tabelas. Depois surgem exceções, parâmetros e tratamentos específicos.

Quando não existe uma preocupação contínua com arquitetura, a complexidade cresce de forma acumulativa.

Além disso, durante muito tempo, o foco de diversos projetos Protheus foi resolver rapidamente a necessidade operacional.

A pergunta principal era:

> A rotina funciona?

Questões como testabilidade, separação de responsabilidades, observabilidade e evolução arquitetural nem sempre recebiam a mesma atenção.

## AdvPL impõe limitações?

Sim.

Toda linguagem e todo ecossistema possuem limitações.

Em comparação com ecossistemas mais recentes, o desenvolvimento AdvPL pode apresentar desafios relacionados a:

- ferramentas;
- testes automatizados;
- gerenciamento de dependências;
- documentação de bibliotecas;
- integração contínua;
- isolamento do ambiente;
- recursos da própria linguagem;
- dependência da plataforma Protheus.

Ignorar essas limitações seria pouco realista.

Isso não significa que o ecossistema esteja parado ou não ofereça ferramentas. O PROBAT, por exemplo, permite construir e automatizar testes em AdvPL e TL++. O desafio é incorporar esses recursos ao fluxo de desenvolvimento e, principalmente, criar pontos testáveis em bases que nasceram muito acopladas ao ambiente.

Por outro lado, reconhecer limitações não significa abandonar princípios básicos de Engenharia de Software.

Mesmo em AdvPL, podemos buscar:

- funções menores;
- nomes mais claros;
- separação de responsabilidades;
- encapsulamento;
- tratamento consistente de erros;
- logging;
- contratos entre módulos;
- isolamento de integrações;
- controle de versão;
- revisão de código;
- documentação;
- automação de validações.

Nem sempre será possível aplicar esses pontos da mesma forma que seriam aplicados em Java, C#, Python ou Go.

Mas os princípios continuam relevantes.

## O primeiro problema: funções que fazem tudo

Um padrão comum em sistemas antigos é a função que:

1. lê parâmetros;
2. abre tabelas;
3. executa consultas;
4. aplica regras de negócio;
5. chama uma API;
6. atualiza registros;
7. mostra mensagens;
8. grava logs;
9. controla a transação.

O código pode funcionar, mas qualquer mudança se torna arriscada.

Os exemplos a seguir são intencionalmente simplificados: ilustram a organização do código, não implementações completas. Considere esta primeira representação:

```advpl
User Function ProcessaPedido()

    Local cPedido := ""
    Local nTotal  := 0
    Local lOk     := .T.

    // Leitura de dados
    // Validações
    // Cálculos
    // Comunicação com API
    // Atualização do banco
    // Mensagens ao usuário
    // Logs

Return lOk
```

O problema não é a quantidade de linhas por si só.

O problema é a quantidade de motivos diferentes para alterar a função.

Uma mudança na API afeta o mesmo bloco que contém regras comerciais. Uma alteração na interface pode tocar o fluxo de persistência. Um novo tratamento de erro pode modificar toda a rotina.

## Separar responsabilidades também é possível em AdvPL

Uma primeira evolução seria decompor o processo:

```advpl
User Function ProcessaPedido()

    Local oPedido  := CarregaPedido()
    Local aErros   := ValidaPedido(oPedido)
    Local lEnviado := .F.

    If Len(aErros) > 0
        ExibeErros(aErros)
        Return .F.
    EndIf

    lEnviado := EnviaPedido(oPedido)

    If lEnviado
        AtualizaStatusPedido(oPedido)
    EndIf

Return lEnviado
```

Esse exemplo ainda é simples, mas já explicita responsabilidades diferentes:

- carregar;
- validar;
- enviar;
- persistir;
- apresentar erros.

Cada parte pode evoluir com menor impacto sobre as demais.

Não é necessário transformar toda rotina em uma arquitetura complexa. Muitas vezes, apenas identificar responsabilidades já melhora bastante a manutenção.

## Código procedural não significa código desorganizado

Outra confusão comum é considerar que somente código orientado a objetos pode ser bem estruturado.

Orientação a objetos pode ajudar, especialmente com os recursos disponíveis no TL++. Mas organização não depende exclusivamente dela.

Código procedural também pode possuir:

- módulos coesos;
- funções pequenas;
- parâmetros explícitos;
- retornos previsíveis;
- baixo acoplamento;
- nomes claros;
- fronteiras bem definidas.

Uma função como:

```advpl
Static Function CalculaTotal(aItens)
```

é mais fácil de compreender do que uma função que depende implicitamente de áreas abertas, variáveis privadas e estados globais.

O ponto central é tornar dependências e responsabilidades mais visíveis.

## Variáveis `Private` e estado oculto

Estado compartilhado é uma das principais fontes de dificuldade em sistemas legados.

Em AdvPL, uma variável `Private` é visível na rotina que a criou e nas rotinas chamadas por ela. Quando uma função depende desse contexto sem receber os dados como parâmetros, seu comportamento deixa de ser evidente.

Considere:

```advpl
Private cFilial   := ""
Private cPedido   := ""
Private lProcessa := .F.
```

Uma função executada posteriormente pode depender dessas variáveis sem recebê-las como parâmetros.

Isso cria algumas perguntas:

- Quem inicializou o valor?
- Ele ainda é válido?
- Outra função pode alterá-lo?
- O que acontece quando a rotina é chamada em outro contexto?
- É possível testar essa função isoladamente?

Sempre que possível, dependências devem ser explícitas:

```advpl
Static Function ProcessaItem(cFilial, cPedido, oItem)
```

Essa mudança pode parecer pequena, mas reduz a quantidade de conhecimento externo necessária para compreender a função.

## Acesso ao banco espalhado pelo sistema

Outro problema recorrente é encontrar lógica de acesso a dados misturada com regras de negócio.

Por exemplo, uma função pode:

- posicionar uma tabela;
- ler campos;
- decidir se uma operação é permitida;
- atualizar registros;
- chamar uma integração.

Esse acoplamento dificulta mudanças.

Mesmo sem implementar formalmente um Repository Pattern, podemos criar uma camada mínima de isolamento:

```advpl
Static Function BuscaPedido(cFilial, cNumero)
    Local oPedido := Nil

    // Acesso ao banco
Return oPedido

Static Function PedidoPodeSerEnviado(oPedido)
    Local lPode := .F.

    // Regra de negócio
Return lPode

Static Function AtualizaPedidoEnviado(oPedido)
    Local lOk := .F.

    // Persistência
Return lOk
```

O objetivo não é adicionar abstrações desnecessárias.

É impedir que cada parte do sistema precise conhecer todos os detalhes de persistência e regra ao mesmo tempo.

## Integrações precisam de fronteiras claras

Integrações com APIs externas são cada vez mais comuns em projetos Protheus.

Quando o código HTTP, a autenticação, o tratamento de erros e a regra de negócio ficam misturados, a manutenção se torna difícil.

Uma alternativa é criar uma função ou classe responsável pela comunicação:

```advpl
Static Function EnviaContrato(oContrato)

    Local oClient   := CriaClienteHttp()
    Local cPayload  := MontaPayload(oContrato)
    Local oResposta := Nil

    oResposta := oClient:Post(cPayload)

Return TrataResposta(oResposta)
```

A rotina principal não precisa conhecer todos os detalhes da API.

Isso facilita futuras alterações de endpoint, autenticação, timeout, payload ou biblioteca de comunicação.

## Tratamento de erros não pode ser apenas uma mensagem

Em sistemas corporativos, exibir uma mensagem para o usuário raramente é suficiente.

Quando ocorre uma falha, precisamos conseguir responder:

- qual operação estava sendo executada;
- quais dados estavam envolvidos;
- em qual etapa ocorreu;
- qual serviço foi chamado;
- qual resposta foi recebida;
- se a operação pode ser repetida;
- se ocorreu alteração parcial de dados.

Um tratamento adequado combina:

- mensagem compreensível ao usuário;
- registro técnico;
- contexto da operação;
- proteção de dados sensíveis;
- estratégia de recuperação;
- controle transacional quando necessário.

Código legado não é apenas aquele que falha. É também aquele que falha sem explicar o que aconteceu.

## Git não moderniza o código sozinho

Colocar o código em um repositório Git é uma evolução importante, mas não resolve automaticamente os problemas de arquitetura.

Git ajuda a:

- preservar histórico;
- comparar alterações;
- trabalhar com branches;
- revisar mudanças;
- reverter versões;
- integrar equipes.

Entretanto, um código altamente acoplado continua altamente acoplado dentro do Git.

O controle de versão é parte da Engenharia de Software, não um substituto para ela.

O ideal é combinar:

- versionamento;
- convenções;
- revisão;
- documentação;
- automação;
- melhoria gradual do código.

## Modernização não precisa ser uma reescrita

Diante de um sistema antigo, a primeira ideia pode ser reescrever tudo.

Na maioria dos ambientes corporativos, isso não é viável.

O sistema contém regras acumuladas, exceções, integrações e comportamentos que nem sempre estão documentados.

Uma estratégia mais segura é a modernização incremental.

Ela pode começar por ações pequenas:

1. colocar o código sob controle de versão;
2. documentar as rotinas críticas;
3. identificar dependências;
4. reduzir funções excessivamente grandes;
5. encapsular integrações;
6. padronizar logs;
7. criar testes onde for possível;
8. migrar componentes específicos para TL++;
9. automatizar validações;
10. melhorar continuamente.

Cada alteração deve reduzir um pouco o risco da próxima.

## Onde o TL++ entra nessa discussão?

TL++ oferece recursos que podem ajudar na organização de projetos, como tipagem de variáveis, funções e parâmetros, namespaces e recursos adicionais de orientação a objetos.

Ele pode ser uma parte importante da evolução do ecossistema Protheus.

Mas apenas migrar código para TL++ não garante qualidade.

É possível escrever código altamente acoplado e difícil de manter em qualquer linguagem.

A modernização técnica precisa ser acompanhada por uma modernização das práticas:

- responsabilidades claras;
- contratos;
- testes;
- documentação;
- revisão;
- observabilidade;
- automação.

A linguagem pode fornecer ferramentas melhores. A Engenharia de Software determina como elas serão usadas.

## O conhecimento do negócio continua sendo essencial

Existe também um risco no sentido oposto: aplicar abstrações e padrões sem compreender o contexto do ERP.

Uma arquitetura tecnicamente elegante pode ser inadequada se ignorar:

- comportamento das tabelas;
- transações;
- pontos de entrada;
- dicionário de dados;
- filial;
- ambientes;
- processos fiscais;
- atualizações do produto;
- características do AppServer e DBAccess.

Modernizar não significa tratar o Protheus como se fosse uma aplicação criada do zero em uma plataforma genérica.

A experiência no ecossistema continua sendo indispensável.

O desafio é unir esse conhecimento acumulado às práticas atuais de desenvolvimento.

## Engenharia de Software pragmática

Nem toda função precisa virar uma classe.

Nem todo acesso a dados precisa receber uma camada sofisticada.

Nem toda rotina antiga precisa ser imediatamente refatorada.

O objetivo não é aplicar padrões para tornar o código mais impressionante.

O objetivo é reduzir riscos e melhorar a capacidade de evolução.

Antes de criar uma abstração, devemos perguntar:

- Qual problema ela resolve?
- Qual dependência ela reduz?
- Qual mudança futura ela facilita?
- O time conseguirá mantê-la?
- O custo é proporcional ao benefício?

Essa postura é especialmente importante em sistemas corporativos com décadas de evolução.

## Leituras relacionadas

Os livros abaixo ampliam alguns dos temas discutidos neste artigo, como refatoração, testes, acoplamento, coesão e tomada de decisões arquiteturais.

{{< book
    label="Leitura relacionada"
    title="Fundamentos da Engenharia de Software: de programador a engenheiro de software"
    authors="Nathaniel Schutta e Dan Vega"
    description="Apresenta uma visão abrangente da Engenharia de Software, incluindo leitura e refatoração de código, testes, arquitetura, implantação confiável e escolha de ferramentas."
    url="https://link.amazon/B003SiOMg"
>}}

{{< book
    label="Leitura relacionada"
    title="Fundamentos da Arquitetura de Software — 2ª edição"
    authors="Mark Richards e Neal Ford"
    description="Aprofunda características e decisões arquiteturais, componentes, acoplamento, coesão e os critérios usados para avaliar diferentes soluções."
    url="https://link.amazon/B0aJV5RY7"
>}}

> **Transparência:** os links para os livros acima são links de afiliados. Posso receber uma comissão por compras realizadas por meio deles, sem custo adicional para você.

## Uma nova série para o blog

Este artigo inicia uma série sobre Engenharia de Software aplicada ao AdvPL e ao ecossistema Protheus.

Alguns dos próximos temas serão:

- funções pequenas e responsabilidade única;
- acoplamento;
- separação entre regra de negócio e persistência;
- tratamento de erros;
- logging estruturado;
- padrões em integrações;
- testabilidade;
- Git e fluxo de desenvolvimento;
- migração gradual para TL++.

A proposta não é apresentar soluções universais.

É discutir como princípios de Engenharia de Software podem ser adaptados à realidade do Protheus de forma prática.

## Conclusão

AdvPL está presente em muitos sistemas antigos, mas isso não significa que todo código escrito em AdvPL precise nascer legado.

As limitações da linguagem e do ecossistema existem. Ainda assim, práticas como separação de responsabilidades, dependências explícitas, modularização, logging, versionamento e documentação continuam disponíveis.

O caminho mais realista não é negar a existência do legado nem prometer uma reescrita completa.

É melhorar gradualmente.

Um módulo por vez. Uma integração por vez. Uma função por vez.

A modernização do Protheus não depende apenas da adoção de uma nova linguagem. Ela começa quando passamos a tratar suas customizações como software que precisa ser compreendido, testado, operado e evoluído com segurança.

## Conteúdos relacionados

- [DBOrderNickname no Protheus: um recurso pouco conhecido do AdvPL](/posts/dbordernickname-advpl-protheus/)
- [Construindo um laboratório Protheus com Docker](/posts/construindo-um-laboratorio-protheus-com-docker/)

## Referências

- [TOTVS TDN — Funções AdvPL](https://tdn.totvs.com/pages/viewpage.action?pageId=23888829)
- [TOTVS TDN — Estrutura da Linguagem AdvPL](https://tdn.totvs.com/display/framework/Estrutura+da+Linguagem)
- [TOTVS TDN — O contexto de variáveis dentro de um programa](https://tdn.totvs.com/pages/viewpage.action?pageId=6063098)
- [TOTVS TDN — Construindo testes com PROBAT](https://tdn.totvs.com/display/tec/5+-+Construindo+Testes)
- [TOTVS TDN — TLPP x AdvPL](https://tdn.totvs.com/display/tec/TLPP+x+AdvPL)
