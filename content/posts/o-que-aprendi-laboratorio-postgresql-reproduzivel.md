---
title: "O que aprendi estruturando um laboratório PostgreSQL reproduzível"
date: 2026-09-07
draft: false
toc: true
slug: "o-que-aprendi-laboratorio-postgresql-reproduzivel"
description: "Aprendizados dos Labs 01 a 03 do PostgreSQL Reliability Lab: estado inicial, dados de teste, validação, recuperação e documentação reproduzível."
tags:
  - postgresql
  - docker
  - dbre
  - laboratórios
  - aprendizado
  - engenharia de software
topics:
  - PostgreSQL e SQL
  - Carreira e Aprendizado
---

Ao estruturar os primeiros labs do PostgreSQL Reliability Lab, a pergunta que orientava cada etapa foi ficando mais exigente.

Na fundação, eu precisava preparar um ambiente que pudesse ser iniciado e validado. Na inicialização, precisava entregar uma base com estrutura, permissões e dados coerentes. Em backup e recuperação, precisava demonstrar que o estado recuperado correspondia ao que o teste esperava.

Essa evolução mudou o que considero uma entrega concluída em um laboratório.

Ter os arquivos no repositório é uma parte do trabalho. Outra é conseguir explicar de onde o experimento parte, como ele modifica o ambiente e quais evidências permitem avaliar seu resultado.

Neste artigo, reúno os aprendizados de estruturação dos **Labs 01 a 03**. O foco é o processo de engenharia que conecta esses experimentos: como delimitar o escopo, organizar o estado inicial, escolher os dados, validar as mudanças e deixar um caminho que possa ser percorrido novamente.

## Uma pergunta concreta ajuda a terminar uma etapa

O [PostgreSQL Reliability Lab](/projects/postgresql-reliability-lab/) tem um objetivo amplo: estudar confiabilidade de bancos de dados por meio de experimentos práticos.

Esse objetivo dá direção ao projeto, mas ainda é grande demais para orientar uma implementação isolada. Foi necessário dividi-lo em perguntas menores.

| Etapa | Pergunta central | Evidência procurada |
|---|---|---|
| Lab 01 — Fundação | Consigo preparar e validar o ambiente básico? | Instância acessível e estrutura inicial disponível |
| Lab 02 — Inicialização | Consigo construir uma base adequada aos próximos experimentos? | Roles, schemas, extensões, tabelas e dados verificados |
| Lab 03 — Backup e recuperação | Consigo recuperar o banco e avaliar o resultado? | Restores executados e estado recuperado validado |

Cada pergunta impõe um limite útil. A fundação não precisa resolver todos os problemas de operação. A inicialização precisa entregar uma base compreensível. O experimento de recuperação precisa definir o que significa recuperar corretamente naquele cenário.

Essa divisão também ajuda a perceber quando uma etapa ainda está incompleta. Se a pergunta envolve recuperação, gerar o backup cobre apenas uma parte da resposta. Se envolve inicialização, criar as tabelas sem verificar permissões e dados deixa parte do objetivo em aberto.

O aprendizado que levo daqui é começar cada novo experimento com uma pergunta e um critério de conclusão. As ferramentas entram depois, para tornar esse critério verificável.

## O estado inicial faz parte do experimento

No [Lab 01](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/), a estrutura é pequena: Docker Compose, arquivo de configuração de exemplo, SQL de inicialização, script de validação e README.

Mesmo nesse ambiente, já existe uma distinção importante: iniciar com dados persistidos e reconstruir a base são operações diferentes.

O volume preserva o estado do banco entre recriações do container. Isso é útil para continuar um estudo, mas também significa que uma nova execução pode carregar o resultado de experimentos anteriores.

No bootstrap usado pelos labs, os scripts montados em `/docker-entrypoint-initdb.d` são executados pela imagem oficial do PostgreSQL na primeira inicialização, quando o diretório de dados está vazio. Alterar um desses arquivos e iniciar um container com o volume já preenchido não aplica a alteração ao banco existente.

Por isso, documentar apenas como subir o ambiente deixa uma pergunta sem resposta: **qual estado precisa existir antes desse comando?**

Para tornar essa condição clara, a documentação precisa distinguir pelo menos três situações:

- continuar usando o banco já inicializado;
- criar a base pela primeira vez;
- descartar os dados do laboratório e reconstruir o cenário.

O reset também precisa informar o que remove. Dados, backups e arquivos usados na recuperação têm papéis diferentes, e o leitor deve conseguir prever o efeito do procedimento antes de executá-lo.

Essa preocupação passou a fazer parte da forma como avalio a reprodução de um experimento. O roteiro precisa declarar seus pré-requisitos e seu estado inicial, além dos comandos.

## A organização dos arquivos pode explicar as dependências

O [Lab 02](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/) ampliou a inicialização e a dividiu em arquivos numerados:

```text
init/
├── 01_roles.sql
├── 02_extensions.sql
├── 03_schemas.sql
├── 04_tables.sql
├── 05_seed_procedures.sql
└── 06_load_sample_data.sql
```

Essa organização permite enxergar a sequência do bootstrap sem abrir um arquivo extenso. As identidades aparecem antes dos objetos que dependem delas; a estrutura vem antes da carga de dados.

Ela também oferece pontos mais claros para investigar uma falha. Se os schemas existem, mas a base está vazia, há uma etapa específica de carga para inspecionar. Se a discussão é sobre propriedade dos objetos, roles e criação dos schemas estão localizadas em arquivos com responsabilidades identificáveis.

O ganho está na relação entre estrutura e raciocínio. Dividir arquivos só ajuda quando essa divisão representa responsabilidades e dependências reais.

Para os próximos labs, quero preservar esse critério: alguém que abra o diretório deve conseguir formar uma primeira hipótese sobre como o experimento funciona antes de ler toda a implementação.

## Os dados de teste precisam permitir perguntas úteis

Uma tabela pequena atende bem ao primeiro contato com o ambiente. Quando o objetivo passa a envolver recuperação e consistência, preciso de dados que permitam avaliar relações entre objetos.

No Lab 02, o domínio de e-commerce trouxe clientes, produtos, pedidos, itens e pagamentos. Essa escolha criou possibilidades de validação que uma coleção de registros independentes não ofereceria.

Um pedido pode ter itens associados. O total desses itens pode ser comparado ao valor do pedido. O pagamento pode ser conferido em relação ao mesmo total. As permissões determinam quais identidades conseguem consultar ou modificar os objetos.

Essas relações foram úteis no Lab 03: passaram a compor os critérios para avaliar o banco restaurado.

Isso me fez olhar para a carga de teste como parte do desenho do experimento. O volume importa em alguns cenários, mas os dados também precisam representar propriedades que eu consiga verificar.

Antes de ampliar uma carga, vale definir o que ela permitirá observar. Para um teste de recuperação, registros conhecidos e relações coerentes oferecem referências. Para um futuro estudo de consultas, a distribuição dos valores e os padrões de acesso exigirão outro cuidado.

Também preciso definir o que significa “reproduzível” em cada teste. Conseguir gerar novamente uma base com a estrutura e as regras esperadas não significa necessariamente obter cada valor idêntico ao de uma execução anterior. Quando a comparação exige igualdade de conteúdo, a referência deve ser capturada e preservada de forma adequada ao teste.

## O critério de sucesso precisa acompanhar a pergunta

Nos primeiros labs, existe uma separação entre a verificação de disponibilidade do PostgreSQL e a validação do conteúdo esperado no banco.

No Lab 02, o `scripts/check.sh` verifica componentes do bootstrap, como roles, schemas, extensões e dados. Esse script torna explícito o significado de uma inicialização concluída para aquele ambiente.

Esse ponto foi aprofundado em [Healthcheck não é prontidão: validando PostgreSQL em containers](/posts/healthcheck-nao-e-prontidao-postgresql-containers/). Aqui, o aprendizado de estruturação é que cada sinal deve ser interpretado dentro do que foi efetivamente testado.

Um servidor aceitando conexões responde a uma pergunta operacional. A presença das tabelas responde a uma pergunta estrutural. A coerência entre pedidos e pagamentos responde a uma pergunta sobre os dados.

Ao organizar essas verificações, o laboratório ganha uma definição mais clara de sucesso. Também fica mais fácil compreender uma falha: o problema aconteceu ao iniciar, preparar a estrutura, carregar os dados ou validar o resultado?

Não é necessário verificar todas as propriedades possíveis de um banco em cada lab. É necessário escolher as propriedades que sustentam a conclusão apresentada e deixar o alcance dessa validação visível.

## Recuperação exige uma referência anterior ao resultado

O [Lab 03](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/) acrescentou um desafio: avaliar se o banco recuperado representa o estado pretendido.

No cenário de recuperação para um instante específico (PITR, do inglês *point-in-time recovery*), o experimento registra uma referência, provoca uma exclusão controlada e compara o banco recuperado com o estado anterior ao incidente.

Essa sequência é importante porque organiza três evidências distintas: o que existia antes, o que a falha alterou e o que a recuperação produziu.

Se eu observar apenas o banco final, posso encontrar tabelas preenchidas sem ter demonstrado que o incidente ocorreu como planejado ou que o conteúdo recuperado corresponde à referência correta.

O mesmo cuidado aparece na comparação com a origem. Um backup representa um estado anterior, e o banco de origem pode continuar recebendo alterações. Comparar os dois sem considerar essa diferença temporal pode transformar uma divergência esperada em uma interpretação errada do teste.

Os detalhes de estrutura, permissões, dados sentinela e fingerprints estão no artigo sobre [validação de restores](/posts/backup-so-existe-depois-do-restore-validar-recuperacao-postgresql/). O que esse trabalho acrescentou ao meu processo foi uma regra de desenho: definir a referência antes de executar a transformação que pretendo avaliar.

Essa regra serve para outros experimentos. Em uma migração, preciso saber quais propriedades devem ser preservadas. Em uma alteração de consulta, preciso definir quais resultados devem permanecer equivalentes. Em recuperação, preciso saber qual estado estou tentando recuperar.

## Repetir ajuda a revelar dependências escondidas

O Lab 03 inclui um teste de repetição com reset entre ciclos de recuperação. A intenção é verificar se o roteiro continua funcionando quando precisa reconstruir as condições do experimento.

Essa repetição tem um papel diferente de simplesmente executar o mesmo comando outra vez sobre um ambiente já preparado.

Um teste pode depender de um diretório criado manualmente, de um backup anterior ou de algum objeto que sobrou de outra execução. Reconstruir o cenário ajuda a expor essas dependências.

A separação entre origem, artefato de backup e destino da recuperação também contribui para a clareza do teste. Cada elemento tem uma função identificável, e o procedimento pode preservar o material necessário para investigar o que aconteceu.

Para mim, essa foi uma evolução importante na forma de pensar a automação. Além de reduzir comandos manuais, o script precisa organizar pré-condições, falhas e resultados de um jeito que permita acompanhar o experimento.

Uma mensagem de sucesso passa a ter mais valor quando consigo apontar quais verificações foram executadas para produzi-la.

## Documentação preserva decisões e limites

Em [Como organizo laboratórios técnicos](/posts/como-organizo-laboratorios-tecnicos/), descrevi o fluxo que conecta problema, implementação, testes, documentação e publicação.

Os primeiros labs de PostgreSQL dão exemplos concretos do que precisa sobreviver nesse caminho: a diferença entre iniciar e reconstruir, a ordem do bootstrap, o papel dos dados e a referência usada para validar uma recuperação.

Um README que registra essas decisões permite retomar o projeto sem depender apenas da memória de quem o escreveu. Também oferece ao leitor condições de avaliar se o experimento atende à pergunta que ele quer investigar.

Os limites fazem parte dessa explicação. O Lab 03 estuda mecanismos de backup e recuperação, mas não entrega uma operação completa de produção com agenda de backups, retenção, cópia externa e monitoramento contínuo.

Registrar esse recorte ajuda a interpretar a evidência corretamente. Um restore validado naquele cenário demonstra o resultado daquele teste. Ampliar essa conclusão para outra infraestrutura ou outro conjunto de exigências depende de novas verificações.

O artigo, por sua vez, precisa explicar por que essas decisões importam. O repositório fornece o caminho de execução; o texto conecta esse caminho às perguntas e aos aprendizados do projeto.

## O que levo para os próximos labs

Ao olhar para as três primeiras etapas, o principal avanço está na definição do que preciso demonstrar antes de considerar um experimento concluído.

Quero levar para as próximas etapas um roteiro simples:

1. formular uma pergunta que caiba no escopo do lab;
2. declarar o estado inicial e os pré-requisitos;
3. preparar dados que permitam avaliar o comportamento estudado;
4. definir a referência e os critérios de sucesso;
5. executar o cenário e guardar evidências do resultado;
6. repetir a partir das condições documentadas;
7. explicar as decisões e o alcance da conclusão.

Esse roteiro dá continuidade ao projeto conforme os cenários ficam mais complexos. Replicação, failover e observabilidade trarão outras perguntas, mas continuarão exigindo condições conhecidas e critérios de avaliação claros.

O aprendizado mais útil até aqui é que **um laboratório reproduzível precisa permitir reconstruir tanto o ambiente quanto a avaliação do resultado**. Quero que o leitor consiga executar o cenário, entender o que foi verificado e reconhecer o que ainda precisa ser investigado.

Para acompanhar essa evolução, os artigos e o acesso ao código estão reunidos na [página do PostgreSQL Reliability Lab](/projects/postgresql-reliability-lab/).
