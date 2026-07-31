---
title: "Organizando um laboratório Protheus: boas práticas com Docker Compose"
date: 2026-08-17
draft: true
toc: true
slug: "organizando-laboratorio-protheus-docker-compose"
description: "Como organizar serviços, configurações, dependências e volumes de um laboratório Protheus para tornar o Docker Compose mais compreensível e reproduzível."
tags:
  - protheus
  - advpl
  - docker
  - docker-compose
  - devops
  - totvs
topics:
  - Protheus e AdvPL
  - DevOps e Confiabilidade
series:
  - Protheus Docker Lab
series_order: 2
---

> **Rascunho condicionado ao gate técnico:** a organização descrita abaixo parte do estado atual do Protheus Docker Lab, mas o texto só deve ser publicado depois que a versão correspondente estiver testada, documentada e identificada por commit ou tag.

No primeiro artigo da série, [Construindo um laboratório Protheus com Docker](/posts/construindo-um-laboratorio-protheus-com-docker/), montei um ambiente de desenvolvimento composto por PostgreSQL, DBAccess, License Server e AppServer.

Colocar os serviços em execução foi a primeira etapa. A seguinte foi transformar um arquivo Compose funcional em um projeto que eu pudesse entender, validar, recriar e evoluir.

Essa diferença parece pequena, mas é importante:

> Um ambiente não se torna reproduzível apenas porque existe um `docker-compose.yml`.

Também precisamos organizar configuração, dependências, artefatos locais, volumes e procedimentos operacionais.

## O problema de concentrar tudo no Compose

Durante uma prova de conceito, é tentador colocar imagens, portas, credenciais, comandos e grandes blocos de configuração diretamente no `docker-compose.yml`.

O arquivo cresce rapidamente e começa a misturar responsabilidades:

- definição dos serviços;
- valores específicos de cada máquina;
- segredos;
- arquivos obrigatórios do Protheus;
- dados persistentes;
- comandos de preparação;
- procedimentos de validação.

Além de dificultar a leitura, essa mistura torna menos claro o que pode ser versionado e o que precisa permanecer local.

## A estrutura adotada no laboratório

O projeto foi separado por finalidade:

```text
protheus-docker-lab/
|-- .env.example
|-- docker-compose.yml
|-- config/
|   |-- appserver.ini.example
|   |-- odbc.ini.example
|   `-- odbcinst.ini.example
|-- files/
|-- scripts/
|   |-- check.sh
|   |-- generate-dbaccess.sh
|   |-- up.sh
|   |-- down.sh
|   `-- logs.sh
|-- volumes/
|   |-- apo/
|   |-- systemload/
|   `-- logs/
`-- README.md
```

Cada diretório responde a uma pergunta:

- `config/`: quais configurações os serviços precisam?
- `scripts/`: como preparar, validar e operar o ambiente?
- `files/`: onde colocar temporariamente artefatos locais?
- `volumes/`: quais dados precisam sobreviver ao container?
- `README.md`: como outra pessoa reproduz o fluxo?

Os artefatos proprietários e arquivos efetivos do ambiente não são publicados no Git.

> **TODO de evidência:** atualizar a árvore com a versão final, registrar o commit e confirmar as regras do `.gitignore`.

## Serviços com responsabilidades explícitas

O Compose mantém quatro serviços:

| Serviço | Responsabilidade |
|---|---|
| `license` | fornecer o License Server do ambiente de desenvolvimento |
| `postgres-iniciado` | executar o banco PostgreSQL usado pelo Protheus |
| `dbaccess-postgres` | intermediar a comunicação entre AppServer e PostgreSQL |
| `appserver` | executar o ambiente Protheus e disponibilizar o WebApp |

A separação ajuda a observar logs, reiniciar componentes e entender as dependências sem instalar tudo diretamente no host.

Ela não significa isolamento completo. Os serviços continuam formando um único sistema e precisam de contratos coerentes de rede, portas, arquivos e inicialização.

## Variáveis que pertencem ao ambiente

Valores que podem mudar entre máquinas ficam no `.env`:

```dotenv
COMPOSE_PROJECT_NAME=protheus-lab
POSTGRES_IMAGE=...
DBACCESS_IMAGE=...
APPSERVER_IMAGE=...
LICENSE_IMAGE=...
APPSERVER_PORT=1234
WEBAPP_PORT=8080
```

O repositório publica apenas `.env.example`, com nomes e valores seguros para servir de referência. O `.env` efetivo permanece local.

Essa estratégia reduz duplicação e permite atualizar imagens e portas sem reescrever o Compose. No entanto, um arquivo `.env` não é um cofre de segredos. Em ambientes compartilhados ou corporativos, credenciais precisam de um mecanismo apropriado de gerenciamento.

## Configuração de exemplo e configuração efetiva

O laboratório distingue arquivos que podem ser versionados daqueles gerados ou adaptados localmente:

```text
config/appserver.ini.example  -> config/appserver.ini
config/dbaccess.ini          -> gerado localmente
config/odbc.ini              -> gerado localmente
config/odbcinst.ini          -> gerado localmente
```

O DBAccess merece cuidado especial. A senha precisa ser codificada no formato esperado pela ferramenta `dbaccesscfg`. Editar manualmente o resultado pode produzir um arquivo aparentemente correto, mas inválido para o serviço.

Por isso, o script `generate-dbaccess.sh` executa a ferramenta da própria imagem e gera a configuração efetiva:

```bash
./scripts/generate-dbaccess.sh
```

> **TODO de validação:** executar o fluxo do zero em uma cópia limpa e incluir a saída sanitizada, sem senha ou valor codificado.

## Dependência não é prontidão

O PostgreSQL possui um healthcheck:

```yaml
healthcheck:
  test:
    - CMD-SHELL
    - pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
  interval: 5s
  timeout: 3s
  retries: 20
  start_period: 10s
```

O DBAccess aguarda o banco ficar saudável:

```yaml
depends_on:
  postgres-iniciado:
    condition: service_healthy
```

Isso é melhor do que depender apenas da ordem de criação dos containers, mas possui um limite: `pg_isready` confirma que o PostgreSQL aceita conexões; ele não garante que o banco esteja completamente preparado para o Protheus.

Da mesma forma, `condition: service_started` informa que um container iniciou, não que sua função de negócio está pronta.

Essa distinção orienta a próxima etapa do lab: criar validações funcionais além do estado dos containers.

## Volumes e artefatos locais

O AppServer precisa acessar RPO, `systemload` e logs:

```yaml
volumes:
  - ./volumes/apo/tttm120.rpo:/opt/totvs/protheus/apo/tttm120.rpo
  - ./volumes/systemload:/opt/totvs/protheus/protheus_data/systemload
  - ./volumes/logs:/opt/totvs/appserver/logs
```

Os bind mounts deixam explícita a origem de cada arquivo no host, o que ajuda em um laboratório local. Eles também criam responsabilidades:

- preparar os diretórios antes da subida;
- conferir permissões;
- manter uma origem limpa do RPO;
- evitar que artefatos proprietários entrem no Git;
- entender quais dados podem ser descartados.

Durante os testes iniciais, o diretório `systemload` precisou permanecer gravável. Esse tipo de descoberta deve fazer parte da documentação, pois não aparece apenas pela leitura do Compose.

## Nomes e caminhos previsíveis

Dentro da rede do Compose, os serviços podem se localizar pelo nome. Assim, o DBAccess usa `postgres-iniciado` como host e o AppServer usa `dbaccess-postgres`.

Os caminhos internos também foram padronizados:

| Uso | Caminho no container |
|---|---|
| RPO | `/opt/totvs/protheus/apo` |
| dados Protheus | `/opt/totvs/protheus/protheus_data` |
| configuração AppServer | `/opt/totvs/appserver/appserver.ini` |
| logs AppServer | `/opt/totvs/appserver/logs` |

Essa tabela reduz o conhecimento implícito e facilita conferir os mounts.

## Validando a configuração antes de subir

O Docker Compose consegue renderizar e validar sua configuração consolidada:

```bash
docker compose config
```

O laboratório envolve essa validação em `scripts/check.sh`, que também verifica Docker e arquivos obrigatórios:

```bash
./scripts/check.sh
```

Essa verificação antecipa erros como ausência de `.env`, RPO, arquivos de `systemload` ou configurações geradas.

Ela ainda é uma validação de preparação, não uma prova de que o Protheus responde corretamente depois da subida.

## O que melhorou

Com a separação, o ambiente passa a ter:

- um Compose focado na topologia;
- variáveis externas para imagens e portas;
- configurações versionáveis como exemplos;
- arquivos sensíveis ou proprietários fora do repositório;
- diretórios explícitos para persistência;
- validação antes da execução;
- documentação conectada à estrutura real.

## Evidências necessárias antes da publicação

| Evidência | Estado do rascunho |
|---|---|
| Commit ou tag da organização | Pendente |
| Setup reproduzido a partir de clone limpo | Pendente |
| `docker compose config` validado | Pendente |
| Arquivos obrigatórios detectados pelo `check.sh` | Pendente |
| Quatro serviços iniciados | Pendente |
| Limitações e correções encontradas | Pendente |

## Próximo passo

Organização reduz ambiguidade, mas o processo ainda possui comandos manuais. Na próxima parte, vamos consolidar scripts, validações funcionais e uma interface operacional simples para concluir este primeiro ciclo do Protheus Docker Lab.

O repositório do projeto está disponível em:

[github.com/dirleiflsilva/protheus-docker-lab](https://github.com/dirleiflsilva/protheus-docker-lab)

## Referências

- [Docker Docs: Compose](https://docs.docker.com/compose/)
- [Docker Docs: controle de inicialização no Compose](https://docs.docker.com/compose/how-tos/startup-order/)
- [Protheus Docker — TOTVS Engineering Pro](https://docker-protheus.engpro.totvs.com.br/)

