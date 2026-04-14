---
title: "Configurando PostgreSQL no Windows para Ambiente de Desenvolvimento com Protheus"
date: 2026-04-12
draft: false
toc: true
slug: "configurando-postgresql-windows-protheus-desenvolvimento"
description: "Guia completo para instalar e configurar PostgreSQL no Windows com integração ao Protheus, incluindo ODBC e DBAccess."
tags:
  - postgresql
  - protheus
  - totvs
  - dbaccess
  - windows
  - banco-de-dados
categories:
  - PostgreSQL
  - Protheus
---

Instalar PostgreSQL no Windows para um ambiente de desenvolvimento com Protheus não é apenas questão de executar um instalador. É necessário configurar o banco corretamente para que a integração com DBAccess funcione de forma estável e previsível.

Este guia apresenta o passo a passo completo, desde o download até a integração total com o Protheus.

---

## ⚠️ Importante: Recomendação da TOTVS

**A instalação do PostgreSQL em Windows é recomendada APENAS para ambientes de desenvolvimento ou testes.**

Segundo a documentação oficial da TOTVS, **não é recomendado o uso do PostgreSQL em Windows para cenários de produção**. Para ambientes produtivos, use sempre PostgreSQL em Linux.

As razões incluem:
- **Melhor performance** em Linux
- **Maior estabilidade** e confiabilidade
- **Suporte oficial** da TOTVS para PostgreSQL em Linux
- **Segurança robusta** em ambientes Linux

> Este guia é específico para desenvolvimento local. Para produção, consulte a documentação de [configuração do PostgreSQL em Linux para Protheus](https://tdn.totvs.com/display/PROT/Protheus+com+PostgreSQL+-+Linux).

---

## 1. Download do PostgreSQL

O instalador oficial para Windows pode ser obtido em:

https://www.postgresql.org/download/windows/

A distribuição Windows é mantida pela EnterpriseDB (EDB), a empresa que fornece suporte comercial ao PostgreSQL.

---

## 2. Instalação do PostgreSQL

Após baixar o instalador, execute-o e acompanhe cada etapa.

> **Nota:** as telas exibidas abaixo são apenas um facilitador visual. Dependendo da versão do PostgreSQL instalada, algumas telas podem apresentar variações na interface ou na ordem das etapas.

### Tela inicial do instalador

![Setup - PostgreSQL](/images/posts/postgres-windows-install/postgres-windows-install-01.png)

### Seleção do diretório de instalação

![Installation Directory](/images/posts/postgres-windows-install/postgres-windows-install-02.png)

### Seleção de componentes

![Select Components](/images/posts/postgres-windows-install/postgres-windows-install-03.png)

### Seleção do diretório de dados

![Data Directory](/images/posts/postgres-windows-install/postgres-windows-install-04.png)

O caminho exibido na imagem é apenas uma sugestão. Como boa prática, prefira manter os dados do PostgreSQL em um drive separado do sistema operacional (por exemplo, `D:`), reduzindo contenção de I/O e facilitando manutenção e backup.

### Definição de senha para o usuário postgres

![Password](/images/posts/postgres-windows-install/postgres-windows-install-05.png)

Escolha uma senha segura e anote-a para referência futura.

### Configuração da porta

![Port](/images/posts/postgres-windows-install/postgres-windows-install-06.png)

A porta padrão é 5432. Se já houver outra instância PostgreSQL em execução, altere para outra porta disponível.

### Opções avançadas

![Advanced Options](/images/posts/postgres-windows-install/postgres-windows-install-07.png)

Na opção **Select the locale to be used by the new database cluster**, o instalador normalmente vem com `DEFAULT`, que significa usar o locale padrão do sistema operacional Windows onde a instalação está sendo feita. Na prática, isso faz com que regras de ordenação, comparação de texto e classificação de caracteres sigam a configuração regional da máquina, como idioma e país.

Nesta instalação, o valor foi alterado para `C`, que é o locale tradicional do padrão POSIX/C. Esse locale usa regras mais simples e previsíveis, baseadas essencialmente na ordem binária dos caracteres, sem depender da regionalização do Windows. Em outras palavras: a ordenação fica menos “inteligente” do ponto de vista linguístico, mas muito mais estável e consistente entre ambientes diferentes.

Para o **Protheus**, isso é importante porque ajuda a evitar diferenças de comportamento em ordenações e comparações de strings entre ambientes, reduzindo risco de incompatibilidades com índices, consultas e rotinas do sistema. Aqui não se trata apenas de uma escolha de implementação: o uso de locale `C` é a configuração recomendada pela **TOTVS** para esse cenário.

Resumindo:

- **`DEFAULT`**: herda o locale do Windows e respeita a regionalização da máquina.
- **`C`**: usa uma ordenação técnica e estável, independente da localidade do sistema.
- **Para Protheus**: use `C`, pois essa é a recomendação da TOTVS para manter o comportamento compatível com a aplicação.

### Conclusão do assistente de instalação

![Completing the PostgreSQL Setup Wizard](/images/posts/postgres-windows-install/postgres-windows-install-08.png)

### Stack Builder

![Welcome to Stack Builder](/images/posts/postgres-windows-install/postgres-windows-install-09.png)

O Stack Builder permite instalar extensões e ferramentas adicionais. Se desejar instalar o psqlODBC agora, continue. Caso contrário, cancele.

### Seleção de aplicações adicionais

![Select the applications you would like to install](/images/posts/postgres-windows-install/postgres-windows-install-10.png)

### Instalação do psqlODBC

![Setup psqlODBC](/images/posts/postgres-windows-install/postgres-windows-install-11.png)

O psqlODBC é essencial para o DBAccess acessar o PostgreSQL.

### Diretório de instalação do psqlODBC

![Installation Directory psqlODBC](/images/posts/postgres-windows-install/postgres-windows-install-12.png)

---

## 3. Componentes instalados

Após a conclusão, você terá disponível:

- **PostgreSQL Server** - o serviço de banco de dados
- **pgAdmin 4** - interface gráfica para gerenciamento
- **psql** - cliente de linha de comando
- **psqlODBC** - driver ODBC para integração com aplicações Windows

Para desenvolvimento, o pgAdmin 4 é o suficiente para a maioria das tarefas.

---

## 4. Criando o banco de dados (padrão Protheus)

Abra o pgAdmin 4 e acesse o editor de queries. Execute o seguinte comando:

```sql
CREATE DATABASE protheus_dev
  WITH 
    ENCODING 'WIN1252'
    LC_COLLATE 'C'
    LC_CTYPE 'C'
    TEMPLATE template0;
```

**Pontos críticos:**

- **ENCODING 'WIN1252'**: obrigatório para compatibilidade com Protheus
- **LC_COLLATE 'C'**: garante ordenação consistente entre plataformas
- **TEMPLATE template0**: cria banco vazio sem extensões padrão

### Recomendação de arquitetura (DEV x produção)

- **Para DEV:** prefira um banco separado por ambiente (ex.: `protheus_dev`), em vez de separar por schema.
- **Schema:** em geral, mantenha o padrão para evitar incompatibilidades com rotinas do Protheus e DBAccess.
- **Tablespace:** é opcional em desenvolvimento. Em produção, pode ser útil para separar I/O em disco dedicado e facilitar gestão de armazenamento.

---

## 5. Criando usuário para o Protheus

No pgAdmin, execute:

```sql
CREATE USER protheus WITH PASSWORD 'senha_forte';
```

Substitua `senha_forte` por uma senha segura.

Agora, configure as permissões:

```sql
ALTER DATABASE protheus_dev OWNER TO protheus;
GRANT ALL PRIVILEGES ON DATABASE protheus_dev TO protheus;
```

**Importante:** evite usar o usuário `postgres` nas aplicações. Use sempre uma conta dedicada, como `protheus`, para melhor segurança e rastreabilidade.

---

## 6. Configurando acesso (pg_hba.conf)

O arquivo `pg_hba.conf` controla quem pode se conectar ao PostgreSQL. Para esta instalação está localizado em:

```
D:\DATABASE\PostgreSQL\16\data\pg_hba.conf
```

A partir do PostgreSQL 14, o método de autenticação padrão nas instalações Windows é `scram-sha-256`, que é mais seguro que o antigo `md5`. O arquivo gerado pela instalação já vem configurado assim:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     scram-sha-256
# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
# IPv6 local connections:
host    all             all             ::1/128                 scram-sha-256
# Allow replication connections from localhost, by a user with the
# replication privilege.
local   replication     all                                     scram-sha-256
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
```

Para um ambiente de desenvolvimento local, essa configuração padrão já é suficiente — ela permite conexões do próprio computador via IPv4 e IPv6, sem necessidade de alterações adicionais.

> **Atenção:** mantenha o método `scram-sha-256`. Evite substituir por `md5` ou `trust` em qualquer ambiente, mesmo em desenvolvimento.

Após qualquer alteração no arquivo, um simples **reload** é suficiente para aplicar as mudanças — sem necessidade de reiniciar o serviço ou derrubar conexões ativas. A própria instalação já cria um atalho pronto para isso:

```
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "D:\DATABASE\PostgreSQL\16\data" reload
```

Caso prefira reiniciar o serviço completo, use:

```bash
net stop postgresql-x64-16
net start postgresql-x64-16
```

---

## 7. Configurando ODBC no Windows

A configuração ODBC permite que o DBAccess comunique com o PostgreSQL.

O caminho para abrir o administrador ODBC pode variar conforme a versão do Windows. A forma mais simples e consistente é usar a pesquisa do próprio Windows:

1. Pressione **Win** e pesquise por **ODBC**
2. Selecione **Fontes de dados ODBC (64 bits)** — atenção para escolher a versão **64 bits**
3. Siga as configurações conforme a documentação oficial: https://tdn.totvs.com/display/tec/DBAccess+-+Como+criar+uma+fonte+de+dados+para+uso+com+PostgreSQL

### DSN de Sistema

![DSN de Sistema](/images/posts/postgres-windows-install/postgres-config-database-01.png)

Na aba **DSN de Sistema**, clique em **Adicionar**.

### Seleção do driver

![Criar nova fonte de dados](/images/posts/postgres-windows-install/postgres-config-database-02.png)

Selecione **PostgreSQL ODBC Driver (ANSI)** e clique em **Concluir**.

### Dados da conexão

![PostgreSQL ANSI ODBC Driver psqlODBC Setup](/images/posts/postgres-windows-install/postgres-config-database-03.png)

Preencha os campos com os dados do banco criado anteriormente: nome da fonte, servidor, porta, banco e usuário.

### Opções avançadas (Datasource)

![Botão Datasource](/images/posts/postgres-windows-install/postgres-config-database-04.png)

![Advanced Options PostgreSQL30 Page 1](/images/posts/postgres-windows-install/postgres-config-database-05.png)

![Advanced Options PostgreSQL30 Page 2](/images/posts/postgres-windows-install/postgres-config-database-06.png)

Para o preenchimento desses parâmetros avançados da fonte de dados ODBC, consulte também a documentação oficial da TOTVS:

https://tdn.totvs.com/display/tec/DBAccess+-+Como+criar+uma+fonte+de+dados+para+uso+com+PostgreSQL

> **Nota:** a página 3 das opções avançadas não requer alterações. Mantenha os valores padrão e prossiga.

### Teste de conexão

![Test](/images/posts/postgres-windows-install/postgres-config-database-07.png)

Clique em **Test** para validar. Uma mensagem de sucesso confirma que o driver ODBC está comunicando corretamente com o PostgreSQL.

---

## 8. Configurando o DBAccess

Acesse o **TOTVS DBMonitor** conforme as configurações do seu ambiente e configure a conexão com o PostgreSQL.

### Configurações do banco

![Configurações Postgres](/images/posts/postgres-windows-install/postgres-config-dbaccess-01.png)

Informe os dados da conexão: ambiente, nome e senha do usuário.

> **Boa prática:** adote um padrão de nomenclatura único entre os três pontos de configuração. Usar o mesmo nome — por exemplo, `protheus_dev` — para o banco de dados, a fonte de dados ODBC e o ambiente no DBAccess facilita a rastreabilidade, evita confusões e torna a manutenção muito mais simples no dia a dia.

### Validação da conexão

![Validação de Conexão](/images/posts/postgres-windows-install/postgres-config-dbaccess-02.png)

Após salvar, teste a conexão. Se bem-sucedida, o DBAccess está pronto para uso com o Protheus.

---

## Problemas comuns e soluções

### Encoding incorreto

**Problema:** erro ao criar tabelas com caracteres especiais.

**Solução:** verifique se o banco foi criado com `ENCODING 'WIN1252'`. Se o banco tiver sido criado com encoding diferente, o correto é recriá-lo com a configuração adequada, pois o encoding do banco não pode ser alterado depois da criação.

### Collation diferente de C

**Problema:** índices não funcionando corretamente, ordenação inconsistente.

**Solução:** recrie o banco com `LC_COLLATE 'C'` e `LC_CTYPE 'C'`.

### Falha de autenticação no ODBC

**Problema:** erro "permission denied" ao tentar conectar.

**Soluções:**
- Verifique se o usuário `protheus` foi criado corretamente
- Confirme a senha
- Teste a conexão com `psql` via linha de comando primeiro

### Conexão recusada

**Problema:** "could not connect to server".

**Soluções:**
- Verifique se o PostgreSQL está em execução
- Valide a porta (`netstat -an | findstr :5432`)
- Confirme que `pg_hba.conf` permite a conexão do seu IP

---

## Boas práticas para ambiente de desenvolvimento

- **Use banco separado:** crie `protheus_dev`, `protheus_test` etc., nunca aponte para produção
- **Versione scripts:** mantenha scripts SQL de inicialização em controle de versão
- **Documente credenciais:** use um arquivo `.env` local (não commitado) para senhas
- **Teste regularmente:** faça backup local e teste o restore periodicamente
- **Use transações:** prefira `BEGIN...COMMIT` para alterações estruturais em dev

---

## Conclusão

Instalar PostgreSQL no Windows é simples através do instalador EDB, mas a configuração adequada para uso com Protheus requer atenção especial aos detalhes: encoding, collation, ODBC e permissões.

Seguindo este guia, você terá um ambiente de desenvolvimento robusto, estável e pronto para integração total com DBAccess.

---

## Referências

- https://www.postgresql.org/download/windows/
- https://www.enterprisedb.com/
- https://tdn.totvs.com/display/public/PROT/Protheus+com+PostgreSQL
- https://tdn.totvs.com/display/tec/DBAccess+-+Como+criar+uma+fonte+de+dados+para+uso+com+PostgreSQL
- https://www.postgresql.org/docs/current/app-initdb.html
- https://www.postgresql.org/docs/current/auth-pg-hba-conf.html
- https://odbc.postgresql.org/
