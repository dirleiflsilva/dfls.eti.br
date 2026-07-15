---
title: "DevOps além das ferramentas: lições de um estudo de caso sobre CALMS e as Três Maneiras"
date: 2026-06-06
draft: false
toc: true
slug: "devops-alem-das-ferramentas-calms-tres-maneiras"
description: "Lições de um estudo de caso sobre transformação DevOps, usando o modelo CALMS e as Três Maneiras para melhorar cultura, fluxo, feedback e aprendizado."
tags:
  - devops
  - calms
  - sre
  - dbre
  - engenharia de software
categories:
  - DevOps
  - Projetos & Labs
---

Recentemente, participei de um desafio do curso de DevOps da Rocketseat. O objetivo era analisar o cenário de uma empresa fictícia e propor melhorias com base no modelo **CALMS** e nas **Três Maneiras do DevOps**.

À primeira vista, o exercício parecia ser sobre automação, CI/CD e deploys. Porém, ao analisar o caso, ficou claro que os principais problemas não estavam relacionados à falta de ferramentas, mas à forma como as equipes trabalhavam.

Essa conclusão pode parecer óbvia para quem já atua na área. Ainda assim, é comum associar DevOps apenas a tecnologias e esquecer que sua base está em cultura, colaboração e aprendizado contínuo.

A proposta completa que desenvolvi está disponível no GitHub:

👉 [devops-transformation-case-study](https://github.com/dirleiflsilva/devops-transformation-case-study)

---

## O cenário

A empresa fictícia possuía duas equipes principais: Desenvolvimento e Operações.

O fluxo de entrega era bastante tradicional:

```text
Desenvolvimento
      ↓
Pacote de deploy
      ↓
Operações
      ↓
Deploy manual
      ↓
Testes manuais
      ↓
Monitoramento manual
```

Os indicadores apresentados eram:

| Métrica                      | Valor        |
| ---------------------------- | ------------ |
| Tempo entre entrega e deploy | 2 dias       |
| Taxa de sucesso dos deploys  | 80%          |
| Incidentes pós-deploy        | 2 por semana |
| MTTR                         | 4 horas      |

Embora os números não fossem catastróficos, eles evidenciavam um ambiente altamente dependente de atividades manuais, com pouca integração entre as equipes e ciclos de feedback lentos.

---

## O erro mais comum

Ao observar um cenário como esse, é comum pensar imediatamente em soluções técnicas:

- implantar Docker
- adotar Kubernetes
- implementar CI/CD
- migrar para a nuvem

Essas iniciativas podem ser importantes, mas nenhuma delas resolve o problema principal se a organização continuar trabalhando em silos.

O maior problema da empresa não era apenas o deploy manual. Era o fato de Desenvolvimento e Operações não enxergarem o processo como um único fluxo de entrega de valor.

Esse diagnóstico mudou a direção da proposta: antes de escolher ferramentas, era necessário melhorar a colaboração, reduzir repasses e criar responsabilidade compartilhada pelo resultado.

---

## O que aprendi com CALMS

O modelo CALMS organiza cinco pilares importantes de uma transformação DevOps: **Culture, Automation, Lean, Measurement e Sharing**.

Durante o desafio, relacionei esses pilares com conceitos que encontrei nas minhas leituras sobre DevOps. O **Projeto Fênix** ajuda a visualizar os problemas causados por silos, gargalos e conflitos entre equipes. Já o **Manual de DevOps** aprofunda as práticas necessárias para melhorar o fluxo, ampliar o feedback e criar uma cultura de aprendizado contínuo.

### Culture: responsabilidade compartilhada

A cultura é a base da transformação.

Sem colaboração entre equipes, qualquer iniciativa de automação corre o risco de apenas acelerar um processo mal definido. A comunicação entre Desenvolvimento e Operações precisa deixar de ser baseada em repasses e passar a ser baseada em responsabilidade compartilhada.

No estudo de caso, isso significa envolver as duas equipes ao longo de todo o ciclo de entrega, desde o planejamento até a análise de incidentes.

### Automation: reduzir trabalho manual

A automação reduz atividades repetitivas, diminui a possibilidade de erro humano e torna os processos mais consistentes.

Automatizar build, testes e deploy ajudaria a reduzir o tempo de entrega e aumentar a confiabilidade das implantações. Porém, a automação deve vir depois da revisão do processo:

> **Automatizar um processo ruim apenas faz com que ele produza problemas mais rapidamente.**

### Lean: eliminar desperdícios

O pensamento Lean ajuda a identificar atividades que consomem tempo sem gerar valor para o cliente.

No cenário analisado, alguns desperdícios eram claros:

- espera entre equipes
- retrabalho após falhas
- testes executados manualmente
- correções realizadas apenas depois do deploy

Reduzir esses desperdícios melhora o fluxo de entrega sem depender, necessariamente, de uma transformação tecnológica ampla.

### Measurement: orientar a melhoria

Sem métricas, não há como saber se uma mudança realmente produziu resultado.

A empresa já possuía indicadores relevantes:

- tempo entre entrega e deploy
- taxa de sucesso dos deploys
- quantidade de incidentes
- MTTR

Esses números formam uma linha de base. Depois de cada melhoria, eles permitem avaliar o impacto e decidir o próximo passo com mais clareza.

### Sharing: distribuir conhecimento

Um aspecto que me chamou atenção foi a dependência de conhecimento especializado.

Em ambientes reais, é comum encontrar sistemas em que apenas uma pessoa conhece determinada tecnologia, processo ou aplicação. Isso cria riscos operacionais e dificulta a colaboração.

Documentação, revisão entre pares, sessões de compartilhamento e análises de incidentes ajudam a distribuir conhecimento e aumentar a resiliência das equipes.

---

## As Três Maneiras do DevOps

As Três Maneiras complementam o modelo CALMS e ajudam a entender como as melhorias devem acontecer no sistema como um todo.

Conheci esses princípios inicialmente por meio do **Projeto Fênix**, que os apresenta dentro da transformação de uma organização fictícia. O **Manual de DevOps** expande essa base com práticas, exemplos e estudos de caso aplicáveis a organizações reais.

### Primeira Maneira: acelerar o fluxo

A Primeira Maneira busca melhorar o fluxo de trabalho da ideia até a entrega de valor ao cliente.

Isso envolve remover gargalos, reduzir lotes de mudança, eliminar etapas desnecessárias e automatizar processos repetitivos. No estudo de caso, automatizar os deploys e aproximar Desenvolvimento de Operações reduziria o tempo de espera entre as equipes.

### Segunda Maneira: ampliar o feedback

Problemas identificados cedo custam menos para corrigir.

Quanto mais rápido o feedback retorna para quem realizou uma mudança, menor tende a ser o impacto das falhas. Testes automatizados, validações contínuas, observabilidade e acompanhamento das métricas são mecanismos que fortalecem esse ciclo.

### Terceira Maneira: experimentar e aprender

A Terceira Maneira cria espaço para experimentação, aprendizado contínuo e melhoria dos processos.

Falhas não devem ser tratadas apenas como problemas individuais. Elas também são oportunidades para entender fragilidades do sistema, compartilhar conhecimento e evitar recorrências.

Nesse contexto, análises de incidentes sem busca por culpados e experimentos realizados de forma controlada ajudam a organização a evoluir com mais segurança.

---

## Relação com PostgreSQL, SRE e DBRE

Embora o desafio fosse voltado para DevOps, os conceitos apresentados também são importantes para quem trabalha com bancos de dados e plataformas de dados.

Ao estudar PostgreSQL, alta disponibilidade, SRE e DBRE, percebo cada vez mais que confiabilidade não depende apenas de tecnologia.

Replicação, backups, monitoramento e automação são fundamentais. Porém, processos bem definidos, documentação adequada, responsabilidade compartilhada e feedback rápido também fazem parte da equação.

Em muitos casos, os maiores incidentes não são causados por limitações técnicas, mas por falhas de comunicação, ausência de processos ou concentração de conhecimento.

---

## Conclusão

O principal aprendizado deste estudo de caso foi perceber que DevOps não começa com ferramentas.

Ele começa quando a organização passa a enxergar Desenvolvimento e Operações como partes do mesmo sistema de entrega de valor. Automação, CI/CD e observabilidade são importantes, mas produzem resultados duradouros apenas quando apoiados por cultura, colaboração e aprendizado contínuo.

Talvez essa seja a principal lição do modelo CALMS e das Três Maneiras: a tecnologia viabiliza a transformação, mas são as pessoas e os processos que determinam seus resultados.

---

## Para aprofundar

Dois livros foram importantes para compreender melhor os conceitos discutidos neste artigo.

{{< book
    title="O Projeto Fênix"
    authors="Gene Kim, Kevin Behr e George Spafford"
    description="Uma narrativa sobre transformação DevOps que ajuda a visualizar silos, gargalos e problemas no fluxo de entrega."
    url="https://link.amazon/B06Mjj5nZ"
>}}

{{< book
    title="Manual de DevOps"
    authors="Gene Kim, Jez Humble, Patrick Debois e John Willis"
    description="Aprofunda os princípios das Três Maneiras e práticas relacionadas a fluxo, feedback, experimentação e aprendizado contínuo."
    url="https://link.amazon/B041f14Ui"
>}}

> **Transparência:** os links para os livros acima são links de afiliados. Posso receber uma comissão por compras realizadas por meio deles, sem custo adicional para você.

## Referências

- [Proposta de solução: devops-transformation-case-study](https://github.com/dirleiflsilva/devops-transformation-case-study)
- KIM, Gene; BEHR, Kevin; SPAFFORD, George. **O Projeto Fênix: um romance sobre TI, DevOps e sobre ajudar o seu negócio a vencer**.
- KIM, Gene; HUMBLE, Jez; DEBOIS, Patrick; WILLIS, John. **Manual de DevOps: como obter agilidade, confiabilidade e segurança em organizações tecnológicas**.

---
