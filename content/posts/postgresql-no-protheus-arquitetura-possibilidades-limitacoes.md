---
title: "PostgreSQL no Protheus: arquitetura, possibilidades e limitações"
date: 2026-10-07
draft: false
toc: true
slug: "postgresql-no-protheus-arquitetura-possibilidades-limitacoes"
description: "Entenda os dois papéis que o PostgreSQL pode assumir no ecossistema Protheus: banco transacional do ERP ou plataforma separada para integrações, APIs e dados."
tags:
  - postgresql
  - protheus
  - dbaccess
  - integracao
  - arquitetura
topics:
  - PostgreSQL e SQL
  - Protheus e AdvPL
---

Quando alguém fala em usar PostgreSQL com Protheus, pode estar descrevendo duas arquiteturas bem diferentes.

Na primeira, o PostgreSQL é o **banco transacional do ERP**. AppServer, DBAccess, driver e banco fazem parte do caminho usado pelas operações do Protheus.

Na segunda, o ERP continua em seu banco atual, enquanto uma instância PostgreSQL separada recebe dados para integrações, APIs, relatórios ou aplicações próprias.

As duas opções são válidas, mas resolvem problemas distintos. Misturá-las na mesma conversa costuma gerar expectativas erradas sobre homologação, acesso aos dados, desempenho e responsabilidade operacional.

Este artigo organiza esse mapa inicial. A proposta não é entregar uma receita de instalação ou recomendar uma arquitetura universal, mas mostrar onde o PostgreSQL pode entrar, quais oportunidades cada caminho cria e quais limites precisam ser respeitados.

## Caminho 1: PostgreSQL como banco transacional do Protheus

Nesse cenário, o PostgreSQL armazena as tabelas utilizadas pelo ERP. De forma simplificada, o fluxo é:

```text
SmartClient ou integração
          ↓
      AppServer
          ↓
    TOTVS DBAccess
          ↓
 driver ODBC do PostgreSQL
          ↓
      PostgreSQL
```

O AppServer executa a aplicação. O DBAccess funciona como a camada de acesso entre o ecossistema Protheus e o banco. O driver ODBC estabelece a comunicação com o PostgreSQL, que persiste os dados.

Essa separação importa porque o ERP não deve ser analisado como se cada rotina AdvPL abrisse uma conexão genérica e independente diretamente no PostgreSQL. Existe uma pilha homologada, com componentes e configurações que precisam ser considerados em conjunto.

### O que essa arquitetura permite estudar

Usar PostgreSQL como banco do Protheus abre uma frente técnica bastante rica:

- instalação e configuração do servidor;
- roles, autenticação e privilégios;
- conexões mantidas pelo DBAccess;
- backup, restauração e recuperação;
- sessões, bloqueios e transações longas;
- estatísticas e planos de execução;
- manutenção com `VACUUM` e `ANALYZE`;
- crescimento de tabelas e índices;
- observabilidade e capacidade;
- replicação e alta disponibilidade.

São temas nativos de administração PostgreSQL, mas aplicados a um workload de ERP, no qual disponibilidade, integridade e previsibilidade têm impacto direto na operação da empresa.

### Homologação não é um detalhe

A documentação da TOTVS deve ser a fonte de verdade para decidir versões e parâmetros suportados. Na consulta realizada em 7 de outubro de 2026, a página de bancos homologados do Protheus listava PostgreSQL 15 e 16 e informava requisitos específicos, entre eles `WIN1252` para encoding, collation `C`, tipos de caractere compatíveis com CP1252 e a configuração `ODBC30=1` no `DBAccess.ini`.

Essa fotografia documental pode mudar. Portanto, ela não deve ser transformada em regra permanente copiada de um artigo. Antes de instalar, atualizar ou migrar um ambiente, é necessário consultar novamente a matriz vigente e relacioná-la à versão do Protheus, do DBAccess, do sistema operacional e do driver.

Também não basta confirmar que “o PostgreSQL é suportado”. É preciso validar o conjunto:

| Camada | Pergunta mínima |
|---|---|
| Protheus | A release utilizada suporta a versão escolhida do banco? |
| DBAccess | A versão e a configuração estão de acordo com a documentação atual? |
| Driver | Qual versão e arquitetura são exigidas? |
| PostgreSQL | Encoding, collation e extensões atendem aos requisitos? |
| Sistema operacional | A combinação está coberta pela matriz aplicável? |
| Operação | Backup, restore, monitoramento e capacidade foram testados? |

A documentação da TOTVS também recomenda PostgreSQL em Linux para ambientes de produção e não recomenda Windows nesse cenário. Essa orientação precisa entrar na avaliação da plataforma, junto com a matriz de versões e os requisitos de infraestrutura.

Um laboratório pode explorar combinações fora desse recorte para aprendizado. Um ambiente de produção não deve confundir experimento tecnicamente possível com plataforma oficialmente suportada.

### PostgreSQL não elimina as características do Protheus

Trocar o mecanismo de banco não transforma automaticamente o modelo de dados do ERP em um modelo relacional convencional.

Continuam existindo convenções do ecossistema Protheus, como tabelas organizadas por alias, controle de filial, exclusão lógica e metadados mantidos pelo dicionário. Campos como `D_E_L_E_T_` e `R_E_C_N_O_` exigem entendimento funcional e técnico antes de serem utilizados em consultas externas.

O PostgreSQL oferece MVCC, diferentes níveis de isolamento, locks, índices e um otimizador sofisticado. Esses recursos são valiosos, mas precisam ser analisados dentro do comportamento real da aplicação. Uma configuração aparentemente adequada para um sistema próprio pode não ser adequada para o workload do ERP.

Por isso, ajustes de autovacuum, memória, conexões, checkpoints ou índices não deveriam nascer de uma lista genérica de “boas práticas”. Eles precisam partir de métricas, planos, volume, concorrência e evidências do ambiente.

## Caminho 2: PostgreSQL como base de integração e dados

O segundo caminho não exige que o PostgreSQL seja o banco transacional do Protheus.

O ERP pode permanecer em SQL Server, Oracle ou outro banco suportado, enquanto uma base PostgreSQL separada atende aplicações que não deveriam depender diretamente do núcleo transacional.

```text
Protheus e banco transacional
             ↓
      extração controlada
             ↓
 PostgreSQL de integração
       ↓       ↓       ↓
      APIs   relatórios  aplicações
```

Nesse desenho, o PostgreSQL pode funcionar como:

- base operacional de uma integração;
- staging para cargas e transformações;
- repositório histórico;
- backend de APIs e aplicações próprias;
- camada de reconciliação;
- base analítica para relatórios;
- fila de trabalho para processamentos desacoplados.

A principal vantagem é o isolamento. Consultas e estruturas auxiliares deixam de compartilhar permissões e ciclos de mudança com o núcleo do ERP.

Isso não torna a integração simples. Apenas desloca os desafios para uma fronteira mais controlável.

### O problema passa a ser a movimentação dos dados

Uma base separada precisa responder a perguntas que não existem quando a aplicação trabalha somente no banco transacional:

- como realizar a carga inicial;
- como identificar alterações posteriores;
- como representar exclusões lógicas;
- como evitar duplicidade ao repetir uma carga;
- como tratar falhas parciais;
- como reconciliar origem e destino;
- qual atraso é aceitável;
- quais dados podem ser copiados;
- por quanto tempo devem ser mantidos.

Usar `R_E_C_N_O_` como se fosse um marcador temporal universal, por exemplo, é uma suposição frágil. Ele pode ajudar na identificação técnica de registros em determinados contextos, mas não prova sozinho quando uma linha foi criada ou alterada. O campo `S_T_A_M_P_`, quando disponível e adequado à tabela e ao processo, também precisa ser validado antes de assumir o papel de watermark.

Uma extração incremental confiável deve declarar seu contrato: qual coluna ou evento indica mudança, como os limites são persistidos, como uma repetição se comporta e como divergências serão detectadas.

### Acesso somente leitura é o ponto de partida

Para consultas e extrações diretamente no banco transacional, a postura inicial deve ser de **somente leitura**, com usuário próprio, privilégios mínimos e impacto monitorado.

Escrever diretamente nas tabelas do ERP a partir de uma aplicação externa pode ignorar regras de negócio, dicionário, gatilhos lógicos e processos mantidos pela aplicação. O fato de um comando SQL ser aceito pelo banco não significa que a alteração seja válida para o Protheus.

Quando houver necessidade de devolver dados ao ERP, o caminho deve ser uma interface suportada para o caso: API, rotina de integração, serviço ou mecanismo oficial aplicável. A escolha depende do módulo, da release e do processo de negócio.

## O que os dois caminhos têm em comum

Embora sejam arquiteturas diferentes, alguns princípios valem para ambas.

### 1. Segurança precisa ser explícita

Conexões devem usar identidades separadas por finalidade. No PostgreSQL, as regras de `pg_hba.conf` determinam quais conexões podem autenticar, enquanto roles e privilégios definem o que cada sessão pode fazer depois. Uma aplicação de integração não precisa herdar os mesmos privilégios de uma rotina administrativa.

Credenciais, tráfego de rede, rotação de senhas, TLS quando aplicável e auditoria precisam fazer parte do desenho, não de um ajuste posterior.

### 2. Backup só vale após restauração

Tanto o banco transacional quanto a plataforma de integração exigem objetivos claros de recuperação. Gerar arquivos de backup é apenas uma etapa. É necessário restaurá-los, medir o processo e verificar se a aplicação consegue voltar a operar com o estado recuperado.

### 3. Observabilidade deve responder a perguntas

Contar conexões ou exibir CPU em um painel não basta. As métricas devem ajudar a explicar situações concretas:

- a aplicação consegue obter conexão;
- existem sessões bloqueadas;
- uma transação está aberta por tempo excessivo;
- as consultas mais caras mudaram;
- a replicação ou extração está atrasada;
- o volume cresceu fora do esperado;
- o último ciclo de integração foi reconciliado.

### 4. Laboratório e produção são contextos distintos

Containers e massas sintéticas são excelentes para reproduzir falhas, estudar planos e automatizar testes. Eles não comprovam, sozinhos, que uma topologia está pronta para produção.

Produção acrescenta requisitos de suporte, segurança, licenciamento, capacidade, continuidade, atualização, responsabilidade operacional e integração com a infraestrutura existente.

## Como escolher o papel do PostgreSQL

A decisão começa pelo problema, não pela preferência pelo banco.

| Necessidade | Papel mais provável do PostgreSQL |
|---|---|
| Executar o próprio Protheus sobre PostgreSQL | Banco transacional homologado |
| Criar uma API desacoplada do ERP | Base de integração |
| Consolidar dados de empresas ou fontes distintas | Plataforma de dados |
| Investigar bloqueios causados pelo workload do ERP | Banco transacional, preferencialmente com cenário reproduzível |
| Manter histórico para análise | Base separada, com pipeline e reconciliação |
| Escrever dados de negócio no Protheus | Interface suportada pelo ERP, não SQL direto como atalho |

Em algumas empresas, os dois papéis podem coexistir: PostgreSQL como banco do ERP e outra instância PostgreSQL como plataforma de integração. Mesmo usando a mesma tecnologia, continuam sendo ambientes com contratos, usuários, ciclos de manutenção e objetivos diferentes.

## Limites deste primeiro mapa

Este artigo não valida uma instalação completa do Protheus sobre PostgreSQL e não substitui a documentação oficial da TOTVS. Também não apresenta ainda um pipeline incremental executado contra uma base real do ERP.

Os próximos conteúdos da trilha devem transformar o mapa conceitual em evidências menores e reproduzíveis:

1. uma matriz documentada de versões, driver, encoding e collation para um laboratório;
2. um workload sintético inspirado em filial, cabeçalho, itens e exclusão lógica;
3. cenários de sessões, bloqueios e transações longas;
4. medições de manutenção e autovacuum;
5. uma prova de conceito de extração incremental com idempotência e reconciliação.

Essa ordem evita usar uma base empresarial como campo de testes e separa claramente o que foi demonstrado do que ainda é hipótese.

## Conclusão

PostgreSQL pode ocupar dois lugares importantes no ecossistema Protheus.

Como banco transacional, ele integra a pilha suportada do ERP e exige atenção rigorosa à homologação, ao DBAccess, ao driver e às características reais do workload.

Como base de integração e dados, ele permite desacoplar APIs, históricos, relatórios e produtos próprios, mas cria responsabilidades de extração, idempotência, reconciliação, segurança e governança.

O ponto central é não tratar esses caminhos como equivalentes.

Antes de perguntar “como usar PostgreSQL com Protheus?”, vale formular uma pergunta mais precisa:

> O PostgreSQL sustentará as transações do ERP ou receberá dados para uma responsabilidade separada?

A resposta define a arquitetura, as validações necessárias e, principalmente, os limites que não devem ser ignorados.

## Referências

- [Bancos de dados homologados — Linha Microsiga Protheus](https://tdn.totvs.com/display/PROT/Banco%2Bde%2Bdados%2Bhomologados)
- [PostgreSQL — Linha Microsiga Protheus](https://tdn.totvs.com/display/public/PROT/PostgreSQL)
- [Protheus com PostgreSQL](https://tdn.totvs.com/display/PROT/Protheus%2Bcom%2BPostgreSQL)
- [PostgreSQL 16 — Controle de concorrência](https://www.postgresql.org/docs/16/mvcc.html)
- [PostgreSQL — Autenticação de clientes](https://www.postgresql.org/docs/current/client-authentication.html)
