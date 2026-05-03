---
title: "Como comecei a aplicar DevOps no meu dia a dia com PostgreSQL e Protheus"
date: 2026-05-02
draft: false
toc: true
slug: "devops-postgresql-protheus-dia-a-dia"
description: "Um relato prático sobre como comecei a aplicar conceitos de DevOps no dia a dia com PostgreSQL e Protheus, com foco em automação, padronização e confiabilidade."
tags:
  - devops
  - postgresql
  - protheus
  - docker
  - automacao
categories:
  - DevOps
  - Projetos & Labs
---

Durante muito tempo, enxerguei DevOps como algo distante da minha realidade.

Parecia um assunto sempre associado a Kubernetes, pipelines complexos e uma infinidade de ferramentas que, sinceramente, não faziam muito sentido no meu dia a dia com ERP Protheus e banco de dados.

Mas essa percepção começou a mudar quando retomei meus estudos e passei a olhar para DevOps de uma forma mais prática.

DevOps não é apenas sobre ferramentas. É, principalmente, sobre criar ambientes mais previsíveis, automatizados e confiáveis.

Foi por esse caminho que comecei: sem tentar transformar tudo de uma vez, mas aplicando pequenas melhorias no que já fazia parte da minha rotina.

---

## O problema: ambientes inconsistentes

Quem trabalha com Protheus, ou com sistemas legados em geral, provavelmente já passou por situações como estas:

- ambiente que funciona em um servidor, mas não em outro
- diferenças de configuração difíceis de rastrear
- setup manual demorado
- dependência de conhecimento tácito, no estilo "só funciona na máquina de fulano"

No banco de dados, o cenário costuma seguir a mesma linha:

- instalações feitas manualmente
- pouca padronização entre ambientes
- dificuldade para reproduzir cenários de teste
- risco maior em mudanças, atualizações e validações

No fim, tudo isso aponta para o mesmo problema:

> **Baixa confiabilidade operacional.**

Quando o ambiente depende demais de passos manuais e memória operacional, qualquer manutenção simples pode virar uma investigação.

---

## A virada de chave: começar pelo básico

Em vez de tentar adotar um "pacote completo" de DevOps, comecei pelo que fazia sentido no meu contexto:

- padronização
- automação
- reprodutibilidade

A ideia era simples:

> **Se eu consigo subir um ambiente com um comando, já estou no caminho certo.**

Esse tipo de melhoria parece pequeno, mas muda bastante a rotina. O ambiente deixa de depender apenas de instruções soltas e passa a ser descrito em arquivos versionados, fáceis de revisar, compartilhar e evoluir.

---

## Primeira aplicação prática: Docker para PostgreSQL

Comecei pelo ponto mais controlável: o banco de dados.

Em vez de instalar PostgreSQL manualmente a cada novo ambiente de teste ou estudo, passei a usar Docker. Com isso, ficou muito mais simples criar, remover e recriar instâncias de banco sem interferir diretamente na máquina local.

Um exemplo básico de `docker-compose.yml`:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    container_name: postgres-lab
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: lab
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Com isso, o ambiente passou a ter algumas vantagens imediatas:

- subida rápida com `docker-compose up -d`
- isolamento em relação à máquina local
- facilidade para recriar o banco do zero
- padronização entre ambientes de estudo, teste e desenvolvimento

O ganho principal não foi apenas técnico. Foi também operacional: ficou mais fácil repetir o mesmo processo sem depender de uma sequência manual de instalação.

---

## Pequenas automações que já fazem diferença

Depois do primeiro ambiente com Docker, comecei a organizar outras tarefas simples que se repetiam no dia a dia.

### 1. Scripts de inicialização

O primeiro passo foi criar scripts para operações comuns:

- subir o ambiente
- derrubar o ambiente
- resetar o banco
- preparar uma base limpa para testes

Um exemplo simples:

```bash
#!/bin/bash

echo "Subindo ambiente..."
docker-compose up -d

echo "Ambiente pronto."
```

Nada sofisticado. Ainda assim, esse tipo de script reduz erro manual e cria uma forma única de executar a mesma tarefa.

### 2. Versionamento de configuração

Antes, era comum ter configuração espalhada, ajuste manual e pouca rastreabilidade.

Com o versionamento no Git, a lógica muda:

- os arquivos de configuração ficam centralizados
- o histórico de mudanças passa a existir
- fica mais fácil revisar alterações
- o ambiente pode ser compartilhado com outras pessoas

Mesmo quando o ambiente ainda é simples, versionar configuração já cria uma base importante para evoluir com mais segurança.

### 3. Backup automatizado

Outro ponto que comecei a organizar foi backup.

Ainda em uma fase inicial, mas já com uma direção clara:

- usar scripts com `pg_dump`
- definir uma rotina de execução periódica
- organizar diretórios de saída
- manter nomes de arquivo previsíveis
- testar restauração, não apenas geração do backup

Essa última parte é essencial. Backup que nunca foi restaurado é apenas uma hipótese.

---

## E o Protheus nisso tudo?

Aqui entra um ponto importante: nem tudo no Protheus é "dockerizável" de forma simples, principalmente quando falamos de ambientes produtivos.

Mas isso não impede a aplicação dos conceitos de DevOps.

Mesmo em um contexto com ERP, DBAccess, AppServer, RPOs e configurações específicas, ainda é possível melhorar bastante a operação com práticas como:

- padronização de ambientes de desenvolvimento
- organização de scripts e configurações
- controle de mudanças
- documentação do setup
- automatização de tarefas repetitivas
- separação clara entre laboratório, desenvolvimento, homologação e produção

Ou seja:

> **DevOps não depende de tecnologia moderna. Depende de disciplina operacional.**

Ferramentas ajudam, mas o ponto principal é reduzir improviso e aumentar previsibilidade.

A própria TOTVS mantém uma documentação sobre **Protheus com Docker**, voltada para ambientes de desenvolvimento. Esse material é uma boa referência para evoluir a ideia para labs práticos mais específicos, combinando PostgreSQL, Protheus, DBAccess e automações de setup.

O cuidado aqui é importante: a documentação indica que as imagens são para uso estritamente de desenvolvimento e não são homologadas para produção. Ainda assim, para laboratório, estudo e validação de conceitos, esse caminho pode ser bastante útil.

---

## O que ainda não estou fazendo

Também considero importante deixar claro o que ainda não faz parte desse processo.

Neste momento, ainda não estou trabalhando com:

- CI/CD completo
- Kubernetes
- observabilidade avançada
- infraestrutura como código com Terraform ou Ansible

E isso não é um problema.

O foco agora é consolidar fundamentos:

- criar ambientes reproduzíveis
- reduzir tarefas manuais
- organizar configurações
- testar backup e restore
- evoluir o laboratório de forma consistente

Antes de adicionar ferramentas mais complexas, faz sentido garantir que a base esteja bem resolvida.

---

## Próximos passos

Esse é só o começo.

Pretendo evoluir esse processo com:

- uma estratégia melhor de backup
- monitoramento básico do PostgreSQL
- scripts mais organizados para o laboratório
- documentação dos ambientes
- labs práticos com Protheus em Docker para desenvolvimento
- integração com meus projetos no GitHub
- mais testes envolvendo PostgreSQL e Protheus

A ideia é avançar de forma incremental, mantendo cada melhoria pequena o suficiente para ser aplicada na rotina.

---

## Conclusão

Retomar os estudos em DevOps me trouxe um aprendizado importante: não é necessário transformar tudo de uma vez.

Pequenas mudanças já geram impacto real:

- menos retrabalho
- mais previsibilidade
- ambientes reproduzíveis
- mais confiança para testar mudanças
- mais clareza sobre o que está configurado

No fim, aplicar DevOps no dia a dia com PostgreSQL e Protheus começou com algo simples: parar de depender tanto de processos manuais e passar a tratar o ambiente como parte do trabalho técnico.

A pergunta que fica é:

> **O que você pode automatizar hoje que já reduziria atrito no seu ambiente?**

---

## Referências

- https://docs.docker.com/
- https://hub.docker.com/_/postgres
- https://www.postgresql.org/docs/
- https://docker-protheus.engpro.totvs.com.br/

---
