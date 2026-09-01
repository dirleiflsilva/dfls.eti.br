---
title: "Healthcheck não é prontidão: validando PostgreSQL em containers"
date: 2026-08-31
draft: false
toc: true
slug: "healthcheck-nao-e-prontidao-postgresql-containers"
description: "Entenda por que um container PostgreSQL saudável não garante que o banco esteja pronto para a aplicação e como combinar pg_isready com validações funcionais."
tags:
  - postgresql
  - docker
  - healthcheck
  - pg-isready
  - dbre
  - confiabilidade
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
---

Um container pode estar em execução sem que o PostgreSQL aceite conexões.

O PostgreSQL pode aceitar conexões sem que o banco esperado, as roles, os schemas ou as tabelas estejam disponíveis. E todos esses objetos podem existir sem que os dados necessários tenham sido carregados corretamente.

Ainda assim, é comum resumir essas situações a uma única informação:

```text
healthy
```

O problema não está no healthcheck. O problema está em interpretar uma verificação específica como prova de que todo o sistema está pronto.

Nos [Labs 01](/posts/postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker/) e [02](/posts/postgresql-reliability-lab-lab-02-inicializacao-de-banco-de-dados/) do PostgreSQL Reliability Lab, usei `pg_isready` no healthcheck do container e scripts adicionais para validar o estado do banco. Essa separação mostra que disponibilidade e prontidão funcional são verificações relacionadas, mas diferentes.

## O que o Docker considera saudável

Um healthcheck executa um comando dentro do container e interpreta seu código de saída. Quando o comando retorna zero, o Docker considera a verificação bem-sucedida. Depois de falhas consecutivas, conforme a configuração de `retries`, o estado passa para `unhealthy`.

No Lab 02, o PostgreSQL possui este healthcheck:

```yaml
healthcheck:
  test:
    [
      "CMD-SHELL",
      "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB -h 127.0.0.1 -p 5432",
    ]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 15s
```

Essa configuração responde a uma pergunta importante:

> O processo PostgreSQL deste container está aceitando tentativas de conexão na interface e porta informadas?

O `start_period` concede tempo para a inicialização antes que falhas sejam contabilizadas. `interval`, `timeout` e `retries` controlam a frequência, o limite de duração e a tolerância a falhas.

Quando outro serviço usa `depends_on` com `condition: service_healthy`, o Compose espera esse teste passar antes de iniciar a dependência. Isso reduz corridas de inicialização, mas o significado de “saudável” continua limitado ao comando definido no healthcheck.

## O que o pg_isready realmente confirma

O `pg_isready` verifica o estado de conexão de um servidor PostgreSQL. Seus códigos de saída distinguem quatro situações:

| Código | Significado |
|---:|---|
| 0 | servidor aceitando conexões normalmente |
| 1 | servidor rejeitando conexões, como durante a inicialização |
| 2 | nenhuma resposta recebida |
| 3 | tentativa não realizada, por parâmetros inválidos |

Essa informação é adequada para um healthcheck: o comando é simples, rápido e específico.

Mas existe um limite importante. A própria documentação informa que não é necessário fornecer usuário, senha ou banco corretos para obter o estado do servidor. Valores incorretos podem gerar uma tentativa de conexão falha no log, mas não transformam o `pg_isready` em uma validação de autenticação ou da estrutura esperada pela aplicação.

Portanto, uma resposta como:

```text
127.0.0.1:5432 - accepting connections
```

não comprova que:

- as credenciais da aplicação funcionam;
- a role possui os privilégios necessários;
- os scripts de inicialização foram executados;
- as extensões obrigatórias estão instaladas;
- as tabelas e constraints esperadas existem;
- a carga de dados terminou corretamente;
- o banco está pronto para uma operação específica do sistema.

## Pronto para quê?

Prontidão não é uma propriedade abstrata do banco. Ela depende de quem pretende usá-lo e para qual operação.

| Camada | Pergunta respondida | Exemplo de verificação |
|---|---|---|
| Container | O processo principal está em execução? | `docker compose ps` |
| Conectividade | O PostgreSQL aceita conexões? | `pg_isready` |
| Autenticação | A identidade esperada consegue entrar? | conexão com `psql` usando a role da aplicação |
| Estrutura | Os objetos necessários existem? | consultas ao catálogo e `to_regclass()` |
| Permissões | A aplicação consegue executar suas operações? | consulta com a própria role da aplicação |
| Dados | O bootstrap entregou a massa mínima esperada? | contagens e invariantes do domínio |

O banco pode estar pronto para monitoramento e ainda não estar pronto para a aplicação. Pode estar pronto para leitura, mas não para uma rotina de backup. Pode aceitar conexões enquanto uma migração obrigatória ainda não foi aplicada.

A pergunta mais útil não é apenas “o banco está saudável?”, mas “o banco está pronto para este consumidor cumprir esta responsabilidade?”.

## Um volume antigo pode produzir um banco saudável e incompleto

A imagem oficial do PostgreSQL executa os arquivos de `/docker-entrypoint-initdb.d` quando inicializa um diretório de dados vazio.

Depois que o volume foi criado, alterar ou adicionar um script nesse diretório não reaplica automaticamente o bootstrap. O PostgreSQL pode iniciar normalmente, responder ao `pg_isready` e receber o estado `healthy`, enquanto o volume preserva uma estrutura anterior à mudança.

Esse cenário é especialmente relevante no Lab 02, cujo bootstrap cria:

- cinco roles;
- três schemas;
- três extensões;
- tabelas de aplicação e auditoria;
- uma massa reproduzível de clientes, produtos, pedidos e pagamentos.

Se verificarmos apenas a conexão, não saberemos se esse contrato foi cumprido.

## A validação funcional do Lab 02

O script [`scripts/check.sh`](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/c77a4903aa656729a1777e5d2f209f2c1991b632/labs/02-database-initialization/scripts/check.sh) começa pelas camadas mais baratas. Primeiro confirma que o serviço está em execução; depois chama `pg_isready`:

```bash
if ! docker compose -f "${LAB_DIR}/docker-compose.yml" exec -T postgres \
  pg_isready -h 127.0.0.1 -p 5432 \
  -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null; then
  echo "error: postgres não está acessível."
  exit 1
fi
```

Somente então o script abre uma sessão com `psql`, habilita `ON_ERROR_STOP` e valida o estado entregue pelo bootstrap. Entre as verificações estão:

```sql
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_roles
    WHERE rolname IN (
      'app_owner', 'app_user', 'readonly', 'backup_user', 'monitor_user'
    )
  ) <> 5 THEN
    RAISE EXCEPTION 'roles esperadas não foram criadas';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_namespace
    WHERE nspname IN ('app', 'audit', 'seed')
  ) <> 3 THEN
    RAISE EXCEPTION 'schemas esperados não foram criados';
  END IF;

  IF (SELECT count(*) FROM app.orders) < 500 THEN
    RAISE EXCEPTION 'orders abaixo do esperado';
  END IF;
END
$$;
```

O objetivo não é provar que todos os comportamentos futuros da aplicação funcionarão. O script valida um contrato menor e explícito: o bootstrap do laboratório precisa entregar identidades, estrutura, extensões e uma quantidade mínima de dados.

O resultado esperado é:

```text
ok: database initialization validado com roles, schemas, extensões, tabelas e dados.
```

Esse resultado fornece uma evidência mais forte do que `healthy`, porque registra exatamente quais propriedades foram verificadas.

## Por que não colocar tudo no healthcheck

Se validações profundas são melhores, pode parecer natural executá-las a cada healthcheck. Essa solução cria outro problema.

O Docker repete o teste durante toda a vida do container. Uma consulta longa, uma contagem sobre tabelas grandes ou uma dependência externa transforma uma verificação operacional barata em carga recorrente. Também pode marcar o banco como `unhealthy` por causa de uma condição que não representa falha do servidor PostgreSQL.

Uma divisão mais segura é:

- **healthcheck:** teste pequeno de disponibilidade, executado frequentemente;
- **validação de bootstrap:** confirma estrutura, permissões e dados depois da inicialização;
- **pipeline de entrega:** verifica migrações e invariantes antes de liberar a versão;
- **aplicação:** trata falhas transitórias de conexão com limites e tentativas controladas;
- **monitoramento:** acompanha disponibilidade, erros, saturação e comportamento ao longo do tempo.

Cada mecanismo responde a uma pergunta diferente. Colocar todas elas em um único comando torna o diagnóstico mais difícil e aumenta o risco de falsos positivos ou falsos negativos.

## Um padrão prático de validação

Para ambientes PostgreSQL em containers, uma sequência útil é:

1. iniciar os serviços com `docker compose up -d`;
2. aguardar o healthcheck confirmar que o servidor aceita conexões;
3. executar um script funcional com credenciais e banco explícitos;
4. consultar objetos e invariantes essenciais;
5. interromper o processo de entrega se qualquer verificação falhar;
6. registrar mensagens que indiquem qual camada não cumpriu o contrato.

No Lab 02, isso pode ser executado com:

```bash
cd labs/02-database-initialization
cp .env.example .env
docker compose up -d
docker compose ps
chmod +x scripts/check.sh
./scripts/check.sh
```

O código usado no artigo está disponível no [PostgreSQL Reliability Lab — Lab 02](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/02-database-initialization).

## Conclusão

Um healthcheck é tão completo quanto a pergunta codificada nele.

Com `pg_isready`, o estado `healthy` indica que o PostgreSQL está aceitando conexões. Essa é uma evidência operacional importante, mas não comprova autenticação, permissões, estrutura, migrações ou dados.

No PostgreSQL Reliability Lab, a solução foi manter o healthcheck pequeno e complementar sua resposta com um script de validação funcional. O primeiro detecta disponibilidade continuamente; o segundo confirma, em momentos controlados, que o ambiente entregou o estado esperado.

Confiabilidade começa quando deixamos de tratar “está rodando” como sinônimo de “está pronto” e passamos a declarar qual contrato precisa ser verificado.

## Referências

- [PostgreSQL: pg_isready](https://www.postgresql.org/docs/current/app-pg-isready.html)
- [Dockerfile: HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck)
- [Docker Compose: controlar a ordem de inicialização](https://docs.docker.com/compose/how-tos/startup-order/)
- [Imagem oficial do PostgreSQL no Docker](https://hub.docker.com/_/postgres)
