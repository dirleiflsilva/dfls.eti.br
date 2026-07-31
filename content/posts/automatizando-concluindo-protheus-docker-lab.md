---
title: "Automatizando e concluindo o primeiro ciclo do Protheus Docker Lab"
date: 2026-08-24
draft: true
toc: true
slug: "automatizando-concluindo-protheus-docker-lab"
description: "Consolidando setup, scripts operacionais, validações e documentação para encerrar o primeiro ciclo reproduzível do Protheus Docker Lab."
tags:
  - protheus
  - advpl
  - docker
  - automação
  - devops
  - bash
topics:
  - Protheus e AdvPL
  - DevOps e Confiabilidade
series:
  - Protheus Docker Lab
series_order: 3
---

> **Rascunho condicionado ao gate técnico:** esta publicação encerra o ciclo somente depois que setup, configuração, validações e documentação forem executados em uma versão limpa do laboratório. Os itens marcados como pendentes não podem permanecer na versão publicada.

Um ambiente reproduzível não deveria depender de uma lista de comandos lembrada apenas por quem o criou.

Depois de [organizar os serviços e arquivos do Protheus Docker Lab](/posts/organizando-laboratorio-protheus-docker-compose/), a etapa seguinte é transformar o procedimento documentado em um fluxo operacional pequeno e previsível.

O objetivo não é criar uma plataforma completa de automação. É concluir o primeiro ciclo com uma base que possa ser preparada, validada, iniciada, observada e encerrada sem conhecimento oculto.

## O que significa concluir este ciclo

Para este laboratório, a entrega de encerramento precisa reunir:

- organização do Docker Compose;
- `.env.example` coerente com os serviços;
- configurações de exemplo versionadas;
- geração segura da configuração do DBAccess;
- validação dos artefatos obrigatórios;
- scripts simples para as operações recorrentes;
- validações funcionais depois da subida;
- documentação reproduzida a partir de um clone limpo.

CI/CD, observabilidade centralizada, atualização automatizada de imagens, backup e cenários corporativos continuam relevantes, mas voltam ao backlog. Eles não precisam manter o ciclo inicial indefinidamente aberto.

## Uma interface operacional pequena

O repositório já separa scripts por intenção:

```text
scripts/
|-- check.sh
|-- generate-dbaccess.sh
|-- up.sh
|-- down.sh
`-- logs.sh
```

Em vez de exigir que a pessoa memorize detalhes do Compose, cada script representa uma operação.

### Validar

```bash
./scripts/check.sh
```

O script verifica:

- presença do `.env`;
- configurações efetivas;
- RPO e arquivos de `systemload`;
- Docker disponível no `PATH`;
- validade de `docker compose config`.

Ele usa `set -euo pipefail`, encerrando o fluxo em erros, variáveis ausentes e falhas dentro de pipelines.

### Gerar a configuração do DBAccess

```bash
./scripts/generate-dbaccess.sh
```

O script carrega variáveis do ambiente, executa `dbaccesscfg` a partir da imagem configurada e gera `dbaccess.ini`, `odbc.ini` e `odbcinst.ini`.

A geração elimina a edição manual da senha codificada e concentra os valores usados na integração com PostgreSQL.

### Subir

```bash
./scripts/up.sh
```

O fluxo valida antes de executar:

```bash
./scripts/check.sh
docker compose up -d
docker compose ps
```

Se a preparação estiver incompleta, a subida não prossegue silenciosamente.

### Consultar logs

```bash
./scripts/logs.sh appserver
./scripts/logs.sh dbaccess-postgres
```

O AppServer é o serviço padrão, mas o argumento permite acompanhar outros componentes sem decorar o comando completo.

### Encerrar

```bash
./scripts/down.sh
```

O script executa `docker compose down` sem remover volumes e artefatos locais automaticamente. Uma operação destrutiva precisa ser explícita e documentada separadamente.

## Por que não criar um único script gigante?

Separar operações mantém cada arquivo pequeno e permite combinar os passos.

Um script único que prepara arquivos, sobe containers, acompanha logs e remove dados mistura ações com ciclos de vida diferentes. Também aumenta o risco de executar algo destrutivo como efeito colateral de uma operação comum.

As funções do laboratório devem continuar simples:

```text
prepare -> check -> up -> verify -> logs -> down
```

## Makefile como fachada opcional

Uma interface por `make` pode oferecer nomes curtos sem substituir os scripts:

```makefile
.PHONY: prepare check up verify logs down

prepare:
	./scripts/generate-dbaccess.sh

check:
	./scripts/check.sh

up: check
	docker compose up -d

verify:
	./scripts/verify.sh

logs:
	./scripts/logs.sh appserver

down:
	./scripts/down.sh
```

> **TODO técnico:** o Makefile e `scripts/verify.sh` ainda precisam ser implementados ou removidos do escopo final. Não publicar este exemplo como funcional antes da validação.

O Makefile funciona como fachada. A lógica permanece nos scripts, que também podem ser chamados diretamente por uma pipeline futura.

## Validação de preparação e validação funcional

Existe uma diferença importante entre verificar arquivos e comprovar que o ambiente atende sua finalidade.

### Antes da subida

- os arquivos obrigatórios existem;
- a configuração do Compose é válida;
- portas e variáveis foram definidas;
- diretórios possuem permissões adequadas.

### Depois da subida

- PostgreSQL está saudável;
- DBAccess iniciou sem erro de conexão;
- AppServer conectou ao DBAccess e ao License Server;
- o ambiente `PROTHEUS_DOCKER` foi carregado;
- o WebApp responde na porta configurada;
- os logs não apresentam falha impeditiva.

`docker compose ps` ajuda, mas não cobre sozinho todos esses itens.

> **TODO técnico:** implementar `scripts/verify.sh` com verificações que possam ser automatizadas sem depender de interação manual ou de expor dados protegidos.

## Tornando erros úteis

Uma automação operacional deve falhar com contexto.

Em vez de deixar o Compose produzir uma mensagem distante da causa, `check.sh` lista arquivos ausentes:

```text
Arquivos obrigatórios ausentes:
 - config/dbaccess.ini
 - volumes/apo/tttm120.rpo

Execute a preparação descrita no README antes de subir o laboratório.
```

Esse comportamento reduz tempo de diagnóstico e transforma o próprio script em documentação executável.

Também é importante não imprimir credenciais, senhas codificadas ou o conteúdo integral de arquivos sensíveis nos logs.

## Teste a partir de um estado limpo

Um ambiente já usado pode esconder dependências:

- arquivos gerados anteriormente;
- volumes com banco inicializado;
- imagens presentes no cache;
- permissões corrigidas manualmente;
- configuração local não documentada.

Por isso, o gate final deve começar em uma cópia limpa do repositório e seguir apenas o README.

Uma matriz simples pode registrar o teste:

| Etapa | Resultado | Evidência |
|---|---|---|
| Copiar `.env.example` | Pendente | comando e arquivo sanitizado |
| Preparar AppServer | Pendente | arquivo validado |
| Gerar DBAccess/ODBC | Pendente | saída sanitizada |
| Validar artefatos | Pendente | `check.sh` concluído |
| Subir quatro serviços | Pendente | `docker compose ps` |
| Validar integração | Pendente | `verify.sh` e logs |
| Acessar WebApp | Pendente | resposta observada |
| Encerrar e reiniciar | Pendente | persistência conferida |

## Documentação como parte da entrega

O README precisa descrever a ordem real das operações:

1. obter os pré-requisitos e artefatos permitidos;
2. criar o `.env` local;
3. preparar `appserver.ini`;
4. gerar a configuração do DBAccess;
5. posicionar RPO e `systemload`;
6. executar a validação;
7. subir o ambiente;
8. executar a verificação funcional;
9. consultar logs e troubleshooting;
10. encerrar preservando os dados esperados.

Se uma etapa só funciona porque foi executada manualmente durante o desenvolvimento, ela ainda não está pronta.

## O que fica fora do encerramento

Concluir o ciclo não significa declarar o laboratório acabado para sempre.

Permanecem como evoluções futuras:

- CI/CD para validar arquivos versionáveis;
- logs e métricas centralizados;
- backup e restauração do PostgreSQL;
- atualização controlada das imagens;
- serviços REST;
- integração com fontes AdvPL e TL++ versionados;
- análise dos limites entre laboratório e ambiente corporativo.

Esses temas podem gerar novos experimentos sem bloquear a abertura do TL++ Modernization Lab planejado no calendário editorial.

## Evidências necessárias antes da publicação

| Evidência | Estado do rascunho |
|---|---|
| Commit ou tag de encerramento | Pendente |
| Setup completo a partir de clone limpo | Pendente |
| Scripts executados sem etapas ocultas | Pendente |
| Validação funcional implementada | Pendente |
| Reinicialização e persistência conferidas | Pendente |
| README revisado durante a reprodução | Pendente |
| Limitações finais registradas | Pendente |

## Conclusão provisória

O principal resultado deste ciclo não é executar Protheus dentro de containers.

É transformar o ambiente em um artefato de Engenharia de Software: descrito, versionado no que pode ser público, validável e operável por procedimentos explícitos.

Depois que os itens pendentes forem comprovados, o Protheus Docker Lab poderá sair da fila editorial ativa sem ser abandonado. Ele continuará como base para experimentos futuros, enquanto abre espaço para a próxima frente de modernização com TL++.

[Acompanhe o Protheus Docker Lab no GitHub](https://github.com/dirleiflsilva/protheus-docker-lab).

## Referências

- [Docker Docs: Compose](https://docs.docker.com/compose/)
- [Docker Docs: boas práticas para Compose](https://docs.docker.com/compose/production/)
- [Bash: The Set Builtin](https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html)
- [Protheus Docker — TOTVS Engineering Pro](https://docker-protheus.engpro.totvs.com.br/)

