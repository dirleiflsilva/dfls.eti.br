---
title: "PostgreSQL Reliability Lab - Lab 01: Ambiente confiável com Docker"
date: 2026-04-26
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-01-ambiente-confiavel-com-docker"
aliases:
  - /posts/do-zero-ao-ambiente-confiavel-postgresql-docker-na-pratica/
tags:
  - postgresql
  - docker
  - database
  - data-engineering
  - devops
categories:
  - Projetos & Labs
description: "Construindo um ambiente PostgreSQL reproduzível e confiável com Docker, com foco em boas práticas próximas de produção."
---

Um dos problemas mais comuns ao trabalhar com banco de dados é a falta de consistência entre ambientes.

Quantas vezes já vimos situações como:

- "Na minha máquina funciona"
- Diferenças entre desenvolvimento, homologação e produção
- Dados que não persistem após reiniciar o ambiente
- Dificuldade em reproduzir bugs

Esses problemas geralmente não estão relacionados ao código da aplicação, mas sim à forma como o ambiente de banco de dados é configurado.

Neste post, vou mostrar como construir um ambiente PostgreSQL utilizando Docker com foco em **reprodutibilidade, persistência e confiabilidade**, servindo como base para cenários mais avançados.

---

## Objetivo

Criar um ambiente PostgreSQL que:

- Seja fácil de subir e destruir
- Tenha persistência de dados
- Seja reproduzível em qualquer máquina
- Siga boas práticas próximas de produção
- Permita validação automatizada

Esse é o primeiro passo do projeto **PostgreSQL Reliability Lab**, onde a ideia é evoluir gradualmente para cenários de alta disponibilidade, backup, observabilidade e performance.

---

## Estrutura do projeto

A estrutura inicial do lab ficou assim:

```text
labs/01-foundation/
├── docker-compose.yml
├── .env.example
├── init/
│   └── init.sql
├── scripts/
│   └── check.sh
└── README.md
```

Cada elemento tem um papel específico na construção de um ambiente confiável.

---

## Docker Compose

O ambiente é definido utilizando Docker Compose, com algumas preocupações importantes:

- Uso de volume para persistência de dados
- Configuração via variáveis de ambiente
- Healthcheck para verificar disponibilidade do banco
- Execução automática de scripts de inicialização

Exemplo simplificado:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    container_name: pg-foundation
    env_file:
      - .env
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

---

## Inicialização do banco

O PostgreSQL permite executar scripts automaticamente na primeira inicialização do container, utilizando o diretório `/docker-entrypoint-initdb.d`.

Criamos o arquivo `init.sql` com:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email)
VALUES
('Alice', 'alice@example.com'),
('Bob', 'bob@example.com');
```

Isso garante que o ambiente já sobe com uma estrutura mínima pronta para uso.

---

## Variáveis de ambiente

As configurações sensíveis ficam fora do código, em um arquivo `.env`.

Exemplo (`.env.example`):

```env
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
```

Essa abordagem:

- evita hardcode de credenciais
- facilita customização
- melhora a portabilidade

---

## Subindo o ambiente

Para iniciar o ambiente:

```bash
docker compose up -d
```

O banco será iniciado automaticamente, com:

- database criado
- tabela criada
- dados inseridos

> **Atenção:** os scripts em `/docker-entrypoint-initdb.d` só são executados no **primeiro boot com volume vazio**. Se o volume já existir, o PostgreSQL ignora esses scripts. Para reinicializar o ambiente do zero, remova o volume com `docker compose down -v`.

---

## Validação do ambiente

A validação pode ser feita de duas formas.

**Via Docker** (sem dependências no host):

```bash
docker compose exec -T postgres psql -U postgres -d app -c "SELECT * FROM users;"
```

**Via psql no host** (requer `psql` instalado localmente):

```bash
psql -h localhost -U postgres -d app -c "SELECT * FROM users;"
```

O código completo do script de validação está disponível no repositório, em `scripts/check.sh`.

Esse tipo de verificação é essencial para garantir que o ambiente está realmente operacional antes de avançar para os próximos labs.

---

## Decisões de engenharia

### Uso de volume

Sem volume, os dados seriam perdidos a cada reinício do container.

👉 Com volume, garantimos persistência, comportamento esperado em produção.

### Uso de init script

Permite padronizar o estado inicial do banco.

👉 Isso evita ambientes inconsistentes entre desenvolvedores.

### Uso de healthcheck

Permite saber quando o banco está realmente pronto para uso.

👉 Fundamental para orquestração e automação.

### Uso de variáveis de ambiente

Separa configuração de código.

👉 Prática essencial em qualquer ambiente moderno.

---

## Repositório

O projeto completo está disponível no GitHub:

👉 [postgresql-reliability-lab](https://github.com/dirleiflsilva/postgresql-reliability-lab)
