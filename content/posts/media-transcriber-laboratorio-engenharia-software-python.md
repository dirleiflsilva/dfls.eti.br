---
title: "De uma ideia abandonada a um laboratório de Engenharia de Software com Python"
date: 2026-07-20
draft: false
toc: true
slug: "media-transcriber-laboratorio-engenharia-software-python"
description: "Conheça a origem do Media Transcriber, um laboratório prático para construir e evoluir uma aplicação Python com testes, arquitetura e CI/CD."
tags:
  - python
  - engenharia de software
  - testes
  - arquitetura
  - gitlab
  - ci-cd
categories:
  - Projetos & Labs
---

Alguns projetos começam com um planejamento detalhado. Outros surgem de uma necessidade simples, recebem algumas linhas de código e acabam esquecidos em algum repositório.

O **Media Transcriber** se encaixa melhor no segundo caso.

Há algum tempo, criei um pequeno projeto chamado `mp4-audio-transcriber`. A ideia era relativamente simples: receber um arquivo MP4, extrair seu áudio e gerar uma transcrição utilizando Python e Whisper.

O projeto chegou a ganhar um repositório no GitHub e uma estrutura inicial, mas nunca evoluiu de fato. Ficou basicamente como uma prova de conceito de uma ideia que poderia ser desenvolvida algum dia.

Recentemente, enquanto pensava em possibilidades para desenvolver um projeto mais próximo de um produto real — talvez até um futuro SaaS — lembrei desse repositório.

Mas, ao revisitar a ideia, percebi que havia uma oportunidade mais interessante do que simplesmente terminar o script original.

Em vez de continuar aquele código, decidi começar novamente.

Desta vez, o objetivo não seria apenas construir um transcritor de arquivos de mídia.

O objetivo seria utilizar o projeto como um **laboratório prático de Engenharia de Software com Python**.

---

## A ideia original

O problema inicial era simples:

```text
Arquivo MP4
    ↓
Extração do áudio
    ↓
Transcrição
    ↓
Arquivo de texto
```

Para uma prova de conceito, isso poderia ser resolvido com poucas bibliotecas e algumas funções.

Mas uma aplicação real rapidamente levanta outras questões.

Como validar os arquivos recebidos?

Como tratar erros do FFmpeg?

Como testar uma integração com um mecanismo de transcrição?

O que acontece quando o processamento leva vários minutos?

Como acompanhar o estado de uma transcrição?

Como armazenar o histórico dos processamentos?

Como trocar o mecanismo de transcrição sem reescrever toda a aplicação?

Como executar vários trabalhos simultaneamente?

Como observar o comportamento da aplicação em produção?

Essas perguntas transformam um pequeno script em um problema muito mais interessante de Engenharia de Software.

Foi justamente aí que o projeto ganhou um novo propósito.

---

## Por que não continuar o repositório antigo?

Uma possibilidade seria simplesmente retomar o `mp4-audio-transcriber` e começar a refatorá-lo.

Tecnicamente, isso seria perfeitamente possível.

Mas o projeto original nunca chegou a evoluir de forma significativa. Não havia um produto em produção, usuários, histórico relevante ou decisões arquiteturais que precisassem ser preservadas.

Por isso, optei por excluir o repositório anterior e criar um novo projeto do zero, preservando apenas a ideia original.

O novo projeto recebeu o nome:

```text
media-transcriber
```

A mudança também remove uma limitação conceitual do nome anterior.

O objetivo não precisa ficar restrito a arquivos MP4. No futuro, a aplicação poderá processar diferentes formatos de áudio e vídeo.

Mais importante do que o novo nome, porém, é a possibilidade de construir o projeto novamente de maneira incremental e registrar essa evolução desde o início.

---

## Por que GitLab?

O novo projeto foi criado como um [repositório público no GitLab](https://gitlab.com/dirleiflsilva/media-transcriber).

A escolha faz parte do próprio objetivo de aprendizado.

Além de hospedar o código, pretendo utilizar recursos como:

* Issues;
* Milestones;
* Merge Requests;
* pipelines de CI/CD;
* releases.

A ideia é tratar o desenvolvimento como um projeto real, mesmo sendo inicialmente um laboratório individual.

O fluxo deverá começar de maneira simples:

```text
Issue
   ↓
Branch
   ↓
Implementação
   ↓
Testes
   ↓
Merge Request
   ↓
Pipeline
   ↓
Merge
```

Não pretendo adicionar processos complexos apenas para simular uma grande equipe.

O objetivo é utilizar práticas que tragam rastreabilidade, qualidade e aprendizado, sem transformar o processo em burocracia.

---

## Por que não começar diretamente como SaaS?

A ideia de um SaaS foi justamente o que me fez lembrar do projeto original.

Ainda assim, começar implementando autenticação, planos, pagamentos, multi-tenancy e infraestrutura em nuvem provavelmente desviaria o foco do problema principal.

Antes de existir um SaaS, precisa existir uma aplicação que resolva um problema.

Por isso, a evolução planejada é mais próxima de:

```text
CLI
 ↓
Aplicação testável
 ↓
Arquitetura modular
 ↓
Container
 ↓
API
 ↓
Persistência
 ↓
Processamento assíncrono
 ↓
Observabilidade
 ↓
Aplicação self-hosted
 ↓
Possível produto
 ↓
Possível SaaS
```

Nem todas essas etapas estão garantidas.

O projeto poderá mudar de direção conforme novos problemas e aprendizados surgirem.

Essa é uma decisão importante: o roadmap representa uma direção, não um compromisso de adicionar tecnologias apenas porque elas estavam previstas.

---

## Engenharia de Software antes da arquitetura sofisticada

Um dos riscos de projetos criados para estudo é tentar utilizar todos os conceitos desde o primeiro commit.

É fácil começar pensando em:

* Clean Architecture;
* Domain-Driven Design;
* microsserviços;
* filas;
* eventos;
* Kubernetes;
* dezenas de abstrações.

Mas isso pode criar uma arquitetura complexa antes mesmo de existir um problema que justifique essa complexidade.

No Media Transcriber, a proposta será diferente.

O projeto começará pequeno.

A arquitetura deverá evoluir conforme as necessidades aparecerem.

Isso significa que conceitos como SOLID, Design Patterns, Clean Architecture e DDD não serão utilizados como uma lista de requisitos obrigatórios.

Eles serão aplicados quando ajudarem a resolver problemas concretos.

Por exemplo, inicialmente pode existir apenas um mecanismo de transcrição.

Quando surgir a necessidade de suportar diferentes mecanismos, talvez faça sentido definir um contrato comum entre eles.

A abstração surgirá da necessidade.

Não o contrário.

---

## A primeira fase não terá transcrição

Pode parecer estranho criar um projeto chamado Media Transcriber e passar a primeira etapa sem transcrever nenhum arquivo.

Mas a primeira etapa planejada será:

```text
v0.1.0 — Project Foundation
```

O objetivo será estabelecer a base de desenvolvimento.

Entre os primeiros itens planejados estão:

* estrutura moderna de projeto Python;
* `pyproject.toml`;
* `src layout`;
* testes com pytest;
* análise de código com Ruff;
* análise estática de tipos;
* cobertura de testes;
* pre-commit;
* primeira pipeline no GitLab CI.

Ao final dessa etapa, a aplicação ainda não fará praticamente nada útil para um usuário.

Mas o projeto estará preparado para evoluir com verificações automatizadas desde o início.

A partir daí, cada nova funcionalidade poderá ser desenvolvida sobre uma base que já executa testes e validações de qualidade continuamente.

---

## O projeto como laboratório

O Media Transcriber não será apenas um projeto sobre transcrição.

A transcrição é o domínio escolhido para criar problemas reais de Engenharia de Software.

Ao longo da evolução do projeto, pretendo explorar temas como:

```text
Software Engineering
├── Clean Code
├── SOLID
├── Testing
├── TDD
└── Architecture

Application
├── CLI
├── API
├── Media Processing
└── Speech-to-Text

Platform
├── PostgreSQL
├── Asynchronous Processing
├── Containers
└── Observability

DevOps
├── Git
├── GitLab
├── CI/CD
└── Automation
```

Isso também cria uma ligação interessante com outros estudos e projetos que venho desenvolvendo.

Enquanto o **PostgreSQL Reliability Lab** está mais relacionado à operação, confiabilidade e evolução de uma plataforma de dados, o Media Transcriber terá outro papel:

> construir e evoluir uma aplicação real utilizando práticas de Engenharia de Software.

Os dois projetos acabam explorando lados diferentes de problemas que, em ambientes reais, frequentemente se encontram.

---

## Aprender construindo algo que pode evoluir

Poderia ter escolhido desenvolver mais um CRUD para estudar arquitetura, testes ou APIs.

Mas existe uma diferença importante quando o projeto possui um problema que realmente desperta interesse.

Processamento de mídia envolve dependências externas, operações demoradas, arquivos, concorrência, persistência, falhas e consumo de recursos.

Isso cria oportunidades naturais para estudar problemas que vão além das operações tradicionais de cadastro, consulta, alteração e exclusão.

Além disso, existe a possibilidade de o projeto evoluir para algo útil.

Talvez uma ferramenta self-hosted.

Talvez uma plataforma voltada à geração de legendas.

Talvez uma ferramenta para transformar vídeos técnicos em documentação.

Talvez um produto.

Ou talvez continue sendo apenas um excelente laboratório.

Neste momento, não é necessário decidir.

---

## Próximos passos

O primeiro passo será construir a fundação do projeto.

A etapa `v0.1.0 — Project Foundation` deverá estabelecer o ambiente de desenvolvimento, as ferramentas de qualidade e a primeira pipeline de integração contínua.

Depois disso, a aplicação começará a receber suas primeiras funcionalidades reais.

A intenção é documentar essa evolução em uma série de artigos, incluindo os acertos, as decisões que precisarem ser revistas e os problemas encontrados durante o desenvolvimento.

O próximo artigo da série será sobre a construção dessa fundação:

> **Criando a fundação de um projeto Python com qualidade e CI desde o primeiro commit**

Mais do que mostrar uma aplicação pronta, a proposta desta série será registrar o caminho entre uma ideia simples e um software progressivamente mais estruturado.

Porque, neste projeto, o resultado final importa.

Mas o processo de construção é justamente a parte que pretendo estudar.

O código e o roadmap podem ser acompanhados no [repositório do Media Transcriber](https://gitlab.com/dirleiflsilva/media-transcriber).
