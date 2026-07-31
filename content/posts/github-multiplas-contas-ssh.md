---
title: "Como usar múltiplas contas no GitHub com SSH"
date: 2026-03-04
draft: false
tags:
  - git
  - github
  - ssh
  - linux
  - devops
topics:
  - Engenharia de Software
description: "Guia completo para configurar múltiplas contas GitHub usando SSH e aliases no arquivo ~/.ssh/config."
toc: true
---

Trabalhar com **mais de uma conta no GitHub** é algo bastante comum.  
Por exemplo:

- uma conta **pessoal**
- uma conta **corporativa**
- contas usadas em **organizações específicas**

Sem uma configuração adequada, o Git pode acabar utilizando a **chave SSH ou o usuário errado**, gerando erros de autenticação ou registrando commits com o e-mail incorreto.

Este guia mostra como configurar **múltiplas identidades SSH** para acessar diferentes contas no GitHub utilizando:

- chaves SSH separadas
- aliases no arquivo `~/.ssh/config`
- configurações específicas em cada repositório

---

## O problema

Quando utilizamos SSH para acessar o GitHub, o cliente SSH normalmente usa **uma única chave padrão** localizada em:

```
~/.ssh/id_rsa
~/.ssh/id_ed25519
```

Isso funciona bem quando existe apenas **uma conta GitHub**.

Mas quando trabalhamos com múltiplas contas, surgem alguns problemas comuns:

- commits realizados com **e-mail incorreto**
- erro **Permission denied (publickey)**
- acesso negado a repositórios privados
- pushes sendo enviados para a conta errada

A solução é configurar **uma identidade SSH diferente para cada conta**.

---

## Fluxo de autenticação SSH

```mermaid
flowchart LR
Dev[Desenvolvedor] --> Git
Git --> SSH
SSH --> Config[~/.ssh/config]
Config --> Alias[Host alias]
Alias --> Key[Chave SSH específica]
Key --> GitHub[Conta GitHub correta]
```

Cada alias definido no `~/.ssh/config` aponta para **uma chave SSH específica**, permitindo separar as identidades.

---

## 1. Gerar a chave SSH

Recomenda-se utilizar **ED25519**, que é o algoritmo moderno padrão.

```bash
ssh-keygen -t ed25519 -C "usuario@empresa.com" -f ~/.ssh/github-empresa
```

Serão criados dois arquivos:

### Chave privada

```
~/.ssh/github-empresa
```

### Chave pública

```
~/.ssh/github-empresa.pub
```

A chave privada **deve permanecer protegida** e nunca deve ser compartilhada.

---

## 2. Adicionar a chave pública ao GitHub

Acesse:

```
https://github.com/settings/keys
```

Clique em **New SSH key**.

Copie o conteúdo do arquivo:

```
~/.ssh/github-empresa.pub
```

Cole no campo **Key**.

Defina um nome para identificar a máquina, por exemplo:

```
Notebook Linux - Empresa
```

---

## 3. Configurar o arquivo ~/.ssh/config

Abra o arquivo:

```bash
nano ~/.ssh/config
```

Adicione uma entrada:

```ssh
Host github-empresa
  HostName github.com
  User git
  IdentityFile ~/.ssh/github-empresa
```

---

## 4. Configurar o repositório local

Dentro do repositório:

```bash
git remote set-url origin git@github-empresa:organizacao/repositorio.git
```

Ou edite diretamente o `.git/config`:

```ini
[remote "origin"]
  url = git@github-empresa:organizacao/repositorio.git
  fetch = +refs/heads/*:refs/remotes/origin/*
```

---

## 5. Configurar nome e e-mail apenas para este repositório

```bash
git config user.name "Seu Nome"
git config user.email "usuario@empresa.com"
```

Verificar:

```bash
git config --list --local
```

---

## 6. Testar a conexão SSH

```bash
ssh -T git@github-empresa
```

Saída esperada:

```
Hi usuario! You've successfully authenticated, but GitHub does not provide shell access.
```

---

## 7. Trabalhando com múltiplas contas

Exemplo de `~/.ssh/config`:

```ssh
Host github-pessoal
  HostName github.com
  User git
  IdentityFile ~/.ssh/github-pessoal

Host github-empresa
  HostName github.com
  User git
  IdentityFile ~/.ssh/github-empresa
```

Cada repositório deve utilizar o alias correspondente.

---

## 8. ED25519 vs RSA

| Característica | RSA 4096 | ED25519 |
|---|---|---|
| Tipo de criptografia | RSA clássico | Curvas elípticas modernas |
| Tamanho da chave | 4096 bits | 256 bits |
| Performance | Mais lento | Mais rápido |
| Tamanho do arquivo | Maior | Menor |
| Compatibilidade | Muito alta | OpenSSH 6.5+ |
| Segurança | Boa | Excelente |

Para ambientes modernos, **ED25519 é a melhor escolha**.

---

## Problemas comuns

### Permission denied (publickey)

```
Permission denied (publickey)
```

Verifique:

- alias correto no `~/.ssh/config`
- chave adicionada ao GitHub
- URL do repositório usando o alias correto

Teste:

```bash
ssh -T git@github-empresa
```

---

### Ver qual chave SSH está sendo usada

```bash
ssh -vT git@github-empresa
```

---

### Listar chaves carregadas no ssh-agent

```bash
ssh-add -l
```

Adicionar manualmente se necessário:

```bash
ssh-add ~/.ssh/github-empresa
```

---

## Resumo rápido

| Etapa | Comando |
|---|---|
| Gerar chave | `ssh-keygen -t ed25519 -C "email"` |
| Adicionar no GitHub | https://github.com/settings/keys |
| Configurar alias | editar `~/.ssh/config` |
| Ajustar remoto | `git remote set-url origin git@alias:user/repo.git` |
| Configurar usuário local | `git config user.name` |
| Testar conexão | `ssh -T git@alias` |

---

💡 **Dica:** manter as chaves organizadas e nomeadas por conta (`github-pessoal`, `github-empresa`) facilita muito a manutenção quando se trabalha com vários repositórios.
