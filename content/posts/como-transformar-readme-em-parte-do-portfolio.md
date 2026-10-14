---
title: "Como transformar um README em parte do portfólio"
date: 2026-10-14
draft: false
toc: true
slug: "como-transformar-readme-em-parte-do-portfolio"
description: "Como usar o README para apresentar contexto, decisões, execução, evidências e limites de um projeto técnico como parte do portfólio profissional."
tags:
  - carreira
  - portfolio
  - readme
  - documentacao
  - github
  - engenharia-de-software
topics:
  - Carreira e Aprendizado
---

Quando alguém encontra um projeto no GitHub, raramente começa lendo cada arquivo, examinando o histórico de commits ou reconstruindo sozinho as decisões técnicas. A primeira tentativa de entender o trabalho costuma passar pelo README.

Se essa página contém apenas o nome do projeto e um comando de instalação, parte importante do trabalho permanece invisível. O código pode estar correto, os testes podem existir e a arquitetura pode ter evoluído com cuidado, mas o visitante ainda precisa descobrir por conta própria qual problema o projeto resolve e por que aquela implementação merece atenção.

Um README não substitui o projeto. Ele também não transforma um exercício simples em experiência que não existiu. O que ele pode fazer é apresentar evidências já presentes no repositório e oferecer um caminho para avaliá-las.

É nesse sentido que comecei a tratar o README como parte do portfólio: não como uma peça de propaganda, mas como a página de entrada para o raciocínio, a execução e os limites do trabalho.

## O README precisa orientar uma avaliação

Documentação de uso e apresentação profissional não são objetivos opostos. Um bom README pode ajudar quem deseja executar o projeto e, ao mesmo tempo, permitir que outra pessoa compreenda as decisões que o sustentam.

Para isso, ele precisa responder a cinco perguntas:

1. Qual problema este projeto investiga ou resolve?
2. Qual é o seu escopo atual?
3. Como a solução está organizada?
4. Como alguém pode executá-la e verificar o resultado?
5. Quais limites e próximos passos ainda existem?

Essas respostas dão contexto ao código. Sem elas, uma árvore de diretórios mostra componentes, mas não necessariamente explica a intenção que os conecta.

## Comece pelo problema, não pela lista de tecnologias

É comum encontrar READMEs que começam com uma sequência de ferramentas:

```text
Python, PostgreSQL, Docker, FastAPI, Redis, GitHub Actions...
```

Essa lista informa a stack, mas ainda não explica por que o projeto existe. Tecnologias ganham significado quando aparecem ligadas a um problema.

No [PostgreSQL Reliability Lab](/projects/postgresql-reliability-lab/), por exemplo, o ponto central não é apenas executar PostgreSQL em containers. O projeto estuda como construir e verificar confiabilidade por meio de inicialização reproduzível, recuperação, replicação, failover e, nas próximas etapas, observabilidade e desempenho.

Docker, Patroni, etcd e HAProxy fazem parte da implementação. O objetivo que organiza o projeto é investigar o comportamento de uma plataforma de dados diante de operações e falhas controladas.

Uma abertura útil pode ser curta:

```markdown
# Nome do projeto

Uma frase que explica o que ele faz e para quem ou para qual cenário.

## Objetivo

O problema investigado, o resultado esperado e o recorte atual.
```

A pergunta importante não é “quantas tecnologias consigo mencionar?”, mas “o leitor entende a finalidade do trabalho antes de encontrar os comandos?”.

## Declare o escopo que realmente existe

Um portfólio fica mais confiável quando distingue o que já funciona do que ainda está planejado.

No [Media Transcriber](/projects/media-transcriber/), o objetivo de longo prazo envolve processamento e transcrição de áudio e vídeo. Isso não significa que todas essas capacidades já estejam disponíveis. O README separa a visão do projeto do estágio atual e direciona para um roadmap incremental.

Essa distinção evita duas leituras ruins:

- apresentar planos como se fossem funcionalidades entregues;
- esconder a evolução porque o produto ainda não chegou ao objetivo final.

Uma tabela ou seção de status pode tornar essa diferença visível:

| Estado | Etapa | Evidência |
|---|---|---|
| Concluída | Fundação do projeto | testes, lint, tipagem e CI executáveis |
| Em desenvolvimento | Entrada de mídia | comportamento atual documentado |
| Planejada | Transcrição | requisitos ainda em definição |

O valor não está nos símbolos usados para cada estado. Está em permitir que alguém confira a situação no próprio repositório.

## Mostre a arquitetura no nível certo

O README não precisa explicar todas as classes, funções ou opções de configuração. Ele precisa fornecer um mapa suficiente para que o leitor saiba onde continuar.

No Protheus Docker Lab, um diagrama textual mostra o host, os serviços do Docker Compose, as configurações e os volumes. Uma tabela complementar explica a função de cada serviço. Esse recorte ajuda a compreender como AppServer, DBAccess, PostgreSQL e License Server se relacionam antes de entrar nos detalhes dos arquivos.

Um mapa simples pode ser mais útil do que uma imagem sofisticada e desatualizada:

```text
projeto/
├── src/          # código da aplicação
├── tests/        # comportamento automatizado
├── scripts/      # operações reproduzíveis
├── docs/         # decisões e experimentos
└── README.md     # entrada e orientação
```

Cada comentário deve explicar uma responsabilidade real. Reproduzir toda a saída de `tree` apenas transfere ao README o mesmo volume de informação que já existe no repositório.

Quando o projeto cresce, o documento principal pode apontar para READMEs específicos, decisões arquiteturais ou roteiros de laboratório. O objetivo é criar camadas de leitura, não concentrar toda a documentação em uma única página.

## Troque afirmações genéricas por evidências

Expressões como “alta qualidade”, “pronto para produção”, “escalável” ou “robusto” são fáceis de escrever e difíceis de avaliar quando aparecem sozinhas.

Uma apresentação técnica melhora quando substitui adjetivos por verificações concretas:

- em vez de “ambiente confiável”, informar quais healthchecks e testes são executados;
- em vez de “backup validado”, registrar que o restore foi realizado e quais propriedades foram comparadas;
- em vez de “alta disponibilidade”, descrever o cenário de falha, o tempo observado e a retomada da escrita;
- em vez de “código com qualidade”, mostrar os comandos de testes, lint e análise de tipos;
- em vez de “fácil de executar”, documentar a preparação desde um estado conhecido.

O laboratório do [`FOR UPDATE`](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/11-for-update), por exemplo, não afirma apenas que existe controle de concorrência. Ele oferece um roteiro com duas sessões, o resultado esperado após o `COMMIT`, o erro de `NOWAIT` e uma alternativa atômica que pode ser executada.

Essa é uma diferença importante para o portfólio. O leitor não precisa aceitar a descrição como prova; ele recebe um caminho para inspecionar ou reproduzir o comportamento.

## Documente como começar e como verificar

Uma sequência de instalação incompleta pode funcionar apenas na máquina de quem escreveu o projeto.

Um roteiro de início precisa declarar, conforme o caso:

- sistema ou ambiente de execução esperado;
- dependências e versões relevantes;
- variáveis de ambiente necessárias;
- arquivos que não podem ser publicados;
- estado inicial dos dados;
- comandos de preparação e execução;
- forma de confirmar que o resultado está correto;
- procedimento de encerramento ou reset.

Há uma diferença entre subir um serviço e demonstrar que o cenário pretendido está disponível. `docker compose up -d` informa ao Docker que os serviços devem ser iniciados; não prova sozinho que a aplicação está pronta nem que os dados esperados foram carregados.

Por isso, procuro aproximar execução e verificação:

```bash
cp .env.example .env
docker compose up -d
docker compose ps
./scripts/check.sh
```

Os comandos são apenas um exemplo. O ponto é que o README deve explicar o que cada etapa estabelece e qual evidência permite seguir adiante.

Se o reset apaga dados, essa consequência também precisa aparecer antes do comando. Uma instrução operacional clara faz parte da qualidade do projeto e demonstra cuidado com quem tenta reproduzi-lo.

## Registre decisões e limites

O resultado final não conta toda a história de engenharia.

No Protheus Docker Lab, por exemplo, algumas configurações são montadas como somente leitura, enquanto diretórios usados pelo AppServer precisam permanecer graváveis. O README registra essa diferença e explica a razão operacional. Esse detalhe mostra mais sobre o trabalho realizado do que uma simples lista de containers.

Decisões úteis para documentar incluem:

- por que uma alternativa foi escolhida;
- qual comportamento foi observado durante os testes;
- quais pré-condições o projeto assume;
- que risco uma configuração evita;
- o que foi deliberadamente deixado fora do escopo;
- quais conclusões não podem ser generalizadas para produção.

Limites não enfraquecem o portfólio. Eles ajudam a mostrar que o autor sabe diferenciar um experimento controlado de uma solução operacional completa.

Um laboratório local pode demonstrar failover sem representar toda a infraestrutura necessária para operar um serviço crítico. Um conjunto pequeno de dados pode validar comportamento funcional sem sustentar uma conclusão de desempenho. Um protótipo pode provar uma integração sem resolver autenticação, observabilidade e operação contínua.

Declarar esses recortes torna a evidência mais precisa.

## Crie caminhos para diferentes leitores

Nem todo visitante procura a mesma coisa.

Uma pessoa recrutadora pode querer entender rapidamente o objetivo, o estágio e as competências demonstradas. Uma pessoa desenvolvedora pode procurar os comandos de execução. Alguém com experiência na tecnologia talvez queira examinar arquitetura, testes, limitações e decisões.

O README pode atender a esses níveis com uma ordem previsível:

1. resumo e objetivo;
2. status atual;
3. arquitetura ou organização;
4. início rápido;
5. validação e testes;
6. decisões e limitações;
7. roadmap e documentação complementar.

Essa ordem não é obrigatória. Ela apenas reduz o custo de localizar a informação e permite que cada leitor aprofunde a análise conforme o interesse.

Links internos também ajudam a conectar as evidências. A página inicial pode apontar para o lab específico, o lab para o roteiro de validação e o artigo para a discussão mais ampla. O portfólio deixa de ser uma coleção de URLs isoladas e passa a formar uma trilha compreensível.

## O que enfraquece um README de portfólio

Alguns sinais merecem revisão:

- título sem uma explicação do problema;
- badges ocupando mais espaço que o objetivo;
- lista extensa de tecnologias sem contexto;
- funcionalidades planejadas apresentadas no tempo presente;
- comandos que dependem de arquivos ou passos não documentados;
- imagens sem explicação do que demonstram;
- afirmações de produção sem carga, operação ou validação compatíveis;
- roadmap desatualizado;
- ausência de limitações;
- segredos, credenciais ou artefatos proprietários publicados por engano.

O extremo oposto também existe. Um README muito longo pode esconder o caminho principal entre detalhes que pertencem a documentos específicos.

A pergunta de revisão é simples: o documento ajuda alguém a entender, executar e avaliar o projeto? Se uma seção não contribui para nenhuma dessas tarefas, talvez possa ser reduzida ou movida.

## Um modelo enxuto

Este ponto de partida pode ser adaptado ao tamanho do projeto:

```markdown
# Nome do projeto

Uma frase que apresenta problema, solução e contexto.

## Objetivo

O que o projeto investiga ou entrega e qual é o recorte atual.

## Status

O que está concluído, em desenvolvimento e planejado.

## Arquitetura

Componentes principais e como se relacionam.

## Pré-requisitos

Dependências, versões e arquivos locais necessários.

## Como executar

Passos reproduzíveis desde um estado conhecido.

## Como validar

Testes, consultas, healthchecks ou resultados esperados.

## Decisões e limitações

Escolhas relevantes, riscos, simplificações e fronteiras do projeto.

## Próximos passos

Evolução prevista sem apresentá-la como funcionalidade atual.

## Licença e autoria

Condições de uso e forma de contato, quando aplicável.
```

O modelo não deve virar uma checklist preenchida mecanicamente. Um projeto pequeno talvez reúna algumas seções; um laboratório complexo pode distribuir detalhes por vários documentos. A estrutura precisa servir ao trabalho existente.

## README também precisa de manutenção

Código e documentação podem divergir rapidamente.

Um comando muda, uma etapa termina, um diretório é renomeado ou uma limitação deixa de existir. Se o README continua descrevendo o estado anterior, ele passa a dificultar a avaliação em vez de ajudar.

Por isso, a conclusão de uma etapa deve incluir perguntas como:

- o status do projeto mudou?
- o início rápido ainda funciona desde uma cópia limpa?
- os testes descritos continuam sendo executados?
- a arquitetura apresentada corresponde aos arquivos atuais?
- os links apontam para documentos existentes?
- os limites e próximos passos continuam verdadeiros?

Tratar essa revisão como parte da entrega reduz a chance de manter uma vitrine desconectada do projeto.

## Conclusão

Um README passa a fazer parte do portfólio quando permite avaliar o trabalho sem exagerá-lo.

Ele apresenta o problema antes da stack, separa o que existe do que está planejado, oferece um mapa da solução, explica como reproduzir o cenário e aponta evidências que podem ser conferidas. Também registra decisões e limites, porque engenharia de software não é demonstrada apenas pelo resultado feliz.

O código continua sendo a base. Testes, histórico e documentação complementar continuam importantes. O papel do README é conectar essas partes e tornar visível o raciocínio que o repositório já contém.

Antes de adicionar mais um badge ou outra tecnologia à lista, vale perguntar:

> O que uma pessoa consegue compreender e verificar sobre este projeto a partir daqui?

Se o documento oferece uma resposta clara, ele deixou de ser apenas um arquivo obrigatório na raiz do repositório e passou a participar de verdade do portfólio.

## Leituras relacionadas

- [Como organizo laboratórios técnicos para aprender, praticar e publicar](/posts/como-organizo-laboratorios-tecnicos/)
- [O que aprendi estruturando um laboratório PostgreSQL reproduzível](/posts/o-que-aprendi-laboratorio-postgresql-reproduzivel/)
- [PostgreSQL Reliability Lab](/projects/postgresql-reliability-lab/)
- [Protheus Docker Lab](/projects/protheus-docker-lab/)
- [Media Transcriber](/projects/media-transcriber/)
