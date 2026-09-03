---
title: "Automatizando a configuração local do Protheus Docker Lab"
date: 2026-09-02
lastmod: 2026-09-02
draft: false
toc: true
slug: "automatizando-configuracao-local-protheus-docker-lab"
description: "Como automatizar o setup local, validar configurações e testar scripts do Protheus Docker Lab sem sobrescrever arquivos de trabalho."
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

> **Versão de referência:** este artigo foi revisado com base no commit [`3dfe986`](https://github.com/dirleiflsilva/protheus-docker-lab/commit/3dfe986cc983a5846bdf375fedfc86b4e9e342a5), que registra a automação e a validação local da terceira parte do Protheus Docker Lab.

Um ambiente reproduzível não deveria depender de uma lista de comandos lembrada apenas por quem o criou.

Depois de [organizar os serviços e arquivos do Protheus Docker Lab](/posts/organizando-laboratorio-protheus-docker-compose/), a etapa seguinte foi transformar o procedimento documentado em um fluxo operacional pequeno, previsível e seguro para os arquivos locais.

O objetivo não é criar uma plataforma completa de automação. É permitir que o laboratório seja preparado, validado, iniciado, observado e encerrado sem conhecimento oculto.

## O escopo desta etapa

Nesta terceira parte, a automação reúne:

- preparação do `.env` e das configurações locais;
- criação dos diretórios usados pelos volumes;
- cópia controlada dos artefatos Protheus;
- geração segura da configuração do DBAccess;
- validação dos arquivos, variáveis, portas e configurações relacionadas;
- scripts pequenos para as operações recorrentes;
- testes automatizados do comportamento dos scripts.

Dados e manutenção serão tratados na parte 4. Validações funcionais dos serviços, integração contínua e os limites deste primeiro laboratório serão tratados na parte 5.

## Uma interface operacional pequena

O repositório separa scripts por intenção e mantém os testes ao lado dessa interface:

```text
scripts/
|-- setup.sh
|-- check.sh
|-- generate-dbaccess.sh
|-- up.sh
|-- down.sh
`-- logs.sh

tests/
`-- test-scripts.sh
```

Em vez de exigir que a pessoa memorize os detalhes da preparação e do Compose, cada script representa uma operação.

### Preparar

Depois de colocar `tttm120.rpo`, `sxsbra.txt` e `sx2.unq` em `files/`, o fluxo começa com:

```bash
./scripts/setup.sh
```

O script:

- verifica se Docker e Docker Compose estão disponíveis;
- cria `.env` e `config/appserver.ini` somente quando não existem;
- cria os diretórios dos volumes;
- copia os artefatos de `files/` para os volumes de trabalho;
- gera o conjunto de configurações do DBAccess quando necessário;
- executa `check.sh` ao final, sem iniciar os containers.

Por padrão, arquivos editáveis, configurações geradas e cópias de trabalho existentes são preservados. Se apenas parte do conjunto `dbaccess.ini`, `odbc.ini` e `odbcinst.ini` existir, o script interrompe o processo em vez de misturar arquivos de gerações diferentes.

Quando a intenção for substituir os artefatos de trabalho e regenerar as três configurações do DBAccess, a operação precisa ser explícita:

```bash
./scripts/setup.sh --force
```

O `--force` pode substituir o RPO e os arquivos de `systemload` nos volumes de trabalho. Ele não altera `.env`, `config/appserver.ini`, o banco PostgreSQL nem volumes de dados do banco.

### Validar

```bash
./scripts/check.sh
```

O script verifica:

- disponibilidade do Docker e do Docker Compose;
- presença, tipo, conteúdo e leitura dos arquivos obrigatórios;
- variáveis obrigatórias e portas válidas;
- validade da configuração efetiva do Compose;
- correspondência básica entre `.env`, `appserver.ini`, `dbaccess.ini` e `odbc.ini`.

Os scripts usam `set -euo pipefail`, encerrando o fluxo em erros, variáveis ausentes e falhas dentro de pipelines.

### Gerar a configuração do DBAccess

```bash
./scripts/generate-dbaccess.sh
```

O script pede ao Docker Compose o ambiente efetivo, valida as variáveis necessárias e executa `dbaccesscfg` a partir da imagem configurada. Em seguida, produz `dbaccess.ini`, `odbc.ini` e `odbcinst.ini`.

A geração ocorre primeiro em um diretório temporário. Os arquivos atuais só são substituídos depois que o `dbaccesscfg` termina com sucesso e produz uma configuração válida. Isso evita deixar um conjunto incompleto quando há falha no container.

Outro cuidado importante é que o `.env` não é carregado com `source`: ele é interpretado pelo Docker Compose e não executado como código Shell. O script também evita imprimir a senha ou o conteúdo integral dos arquivos sensíveis nos logs.

### Subir

```bash
./scripts/up.sh
```

Antes de executar `docker compose up -d`, o fluxo chama `check.sh`. Ao final, `docker compose ps` apresenta o estado dos serviços.

Se a preparação estiver incompleta ou inconsistente, a subida não prossegue silenciosamente.

### Consultar logs

```bash
./scripts/logs.sh
./scripts/logs.sh dbaccess-postgres
```

O AppServer é o serviço padrão, mas o argumento permite acompanhar outro componente sem repetir o comando completo do Compose.

### Encerrar

```bash
./scripts/down.sh
```

O script executa `docker compose down` sem remover volumes ou artefatos locais automaticamente. Uma operação destrutiva precisa ser explícita e documentada separadamente.

## Por que separar as operações?

Preparar arquivos, validar configuração, subir containers, acompanhar logs e remover recursos pertencem a ciclos de vida diferentes.

Separar essas ações mantém cada script pequeno, permite executá-las individualmente e reduz o risco de uma operação comum provocar um efeito colateral destrutivo.

O fluxo resultante fica simples:

```text
setup -> check -> up -> logs -> down
```

O `setup.sh` já chama a validação, assim como `up.sh`. Mesmo assim, `check.sh` continua disponível de forma independente para conferir o ambiente depois de uma alteração local.

## Validação de preparação não é validação funcional

Existe uma diferença importante entre verificar arquivos e comprovar que o ambiente atende sua finalidade.

Nesta parte, a automação confirma antes da subida que:

- os arquivos obrigatórios existem, são regulares, não estão vazios e podem ser lidos;
- a configuração do Compose é válida;
- variáveis obrigatórias e portas foram definidas corretamente;
- valores essenciais estão coerentes entre o `.env` e os arquivos INI.

Depois da subida, ainda é necessário verificar se:

- PostgreSQL está saudável;
- DBAccess iniciou sem erro de conexão;
- AppServer conectou ao DBAccess e ao License Server;
- o ambiente `PROTHEUS_DOCKER` foi carregado;
- o WebApp responde na porta configurada;
- os logs não apresentam falha impeditiva.

`docker compose ps` ajuda, mas não comprova sozinho todos esses itens. Essas verificações funcionais pertencem à parte 5 e não devem ser confundidas com o gate de preparação entregue agora.

## Tornando erros úteis

Uma automação operacional deve falhar com contexto. Em vez de encerrar no primeiro problema, `check.sh` acumula as inconsistências encontradas e apresenta uma lista ao final.

Ele distingue, por exemplo, um arquivo ausente de um caminho que não seja arquivo regular, de um arquivo vazio ou sem permissão de leitura. Também aponta variáveis ausentes, portas fora do intervalo permitido e divergências entre configurações relacionadas.

Esse comportamento reduz o ciclo de tentativa e erro e transforma o próprio script em documentação executável.

## Testando os scripts sem iniciar o Protheus

O repositório inclui uma suíte executável com:

```bash
./tests/test-scripts.sh
```

Os testes usam um comando `docker` simulado. Portanto, não iniciam containers nem baixam imagens, mas exercitam o comportamento da automação em diretórios temporários.

Os 12 cenários cobrem:

- preparação inicial do ambiente;
- preservação de arquivos locais em uma segunda execução;
- atualização explícita com `--force`;
- rejeição de artefato ausente ou arquivo obrigatório vazio;
- rejeição de configuração parcial do DBAccess;
- falha quando Docker não está disponível;
- rejeição de variável ausente, porta inválida e configurações divergentes;
- garantia de que o conteúdo do `.env` não seja executado pelo Shell;
- preservação dos arquivos atuais e ausência da senha nos logs quando o gerador falha.

Essa suíte não substitui o teste integrado com as imagens e os artefatos reais do Protheus. Ela protege a lógica local que pode ser validada sem distribuir conteúdo proprietário ou depender da disponibilidade dos serviços.

## Documentação como parte da entrega

O README agora apresenta dois caminhos.

O fluxo recomendado concentra a preparação em `./scripts/setup.sh`. O fluxo manual mantém visíveis os comandos individuais para quem precisa entender ou diagnosticar cada etapa.

Essa combinação evita esconder o funcionamento atrás da automação e, ao mesmo tempo, reduz a quantidade de decisões necessárias no uso cotidiano. Os scripts também podem ser chamados de qualquer diretório, pois resolvem a raiz do repositório antes de operar.

## O que fica fora desta etapa

Concluir a automação local não significa declarar o laboratório acabado.

Permanecem para as próximas partes ou para laboratórios futuros:

- backup e restauração do PostgreSQL;
- atualização controlada das imagens;
- validações funcionais depois da subida;
- integração contínua para os arquivos versionáveis;
- logs e métricas centralizados;
- serviços REST;
- integração com fontes AdvPL e TL++ versionados;
- análise dos limites entre laboratório e ambiente corporativo.

## Conclusão

O principal resultado desta etapa não é esconder comandos em um script maior. É oferecer uma interface previsível que prepara o laboratório sem sobrescrever silenciosamente o trabalho local, valida inconsistências antes da subida e possui testes para os comportamentos mais importantes.

Com a automação e a validação local registradas no repositório, a série pode avançar para dados e manutenção do ambiente. A validação DevOps e os limites do laboratório permanecem como a quinta parte deste primeiro roadmap.

[Acompanhe o Protheus Docker Lab no GitHub](https://github.com/dirleiflsilva/protheus-docker-lab).

## Referências

- [Código da parte 3 do Protheus Docker Lab](https://github.com/dirleiflsilva/protheus-docker-lab/commit/3dfe986cc983a5846bdf375fedfc86b4e9e342a5)
- [Docker Docs: `docker compose config`](https://docs.docker.com/reference/cli/docker/compose/config/)
- [Docker Docs: interpolação de variáveis no Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Bash: The Set Builtin](https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html)
- [Protheus Docker — TOTVS Engineering Pro](https://docker-protheus.engpro.totvs.com.br/)
