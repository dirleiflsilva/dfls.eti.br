---
title: "Validação DevOps e limites do Protheus Docker Lab"
date: 2026-09-30
lastmod: 2026-09-30
draft: false
toc: true
slug: "validacao-devops-limites-protheus-docker-lab"
description: "Como a integração contínua valida o Docker Compose e os scripts do Protheus Docker Lab, o que ainda precisa ser verificado no ambiente real e quais são os limites do projeto."
tags: ["protheus", "docker", "devops", "integração contínua", "github-actions", "bash"]
topics: ["Protheus e AdvPL", "DevOps e Confiabilidade"]
series: ["Protheus Docker Lab"]
series_order: 5
---

Depois de organizar o ambiente, automatizar sua preparação e exercitar o backup e a restauração do PostgreSQL, faltava responder a uma pergunta: o que pode ser validado continuamente sem distribuir os artefatos do Protheus nem iniciar o ERP?

A quinta parte do **Protheus Docker Lab** encerra esta série com um workflow de integração contínua para a configuração versionada e os scripts do projeto. Ela também registra os limites dessa automação, porque um pipeline aprovado não significa, sozinho, que o ambiente Protheus está funcional.

> **Versão de referência:** este artigo acompanha o commit [`017c4cc`](https://github.com/dirleiflsilva/protheus-docker-lab/commit/017c4cc495475a39ad2f4a0999e0488165defb6d), que registra a aprovação da Parte 5 no GitHub Actions.

## O que entrou na integração contínua

O workflow [Validação do laboratório](https://github.com/dirleiflsilva/protheus-docker-lab/blob/017c4cc495475a39ad2f4a0999e0488165defb6d/.github/workflows/validacao.yml) é executado em pushes, pull requests e por acionamento manual.

Ele usa Ubuntu 24.04, tem permissão apenas de leitura sobre o repositório e limita o job a dez minutos. A validação não precisa de secrets, RPO, systemload ou arquivos locais de configuração.

O job possui três etapas técnicas:

```yaml
- name: Validar o Compose com valores de exemplo
  run: docker compose --env-file .env.example -f docker-compose.yml config --quiet

- name: Validar a sintaxe dos scripts Bash
  run: |
    while IFS= read -r -d '' script; do
      printf 'Validando %s\n' "$script"
      bash -n "$script"
    done < <(find scripts tests -type f -name '*.sh' -print0)

- name: Executar os testes com Docker simulado
  run: ./tests/test-scripts.sh
```

Cada etapa responde a uma pergunta diferente.

| Verificação | Evidência produzida | O que não comprova |
|---|---|---|
| `docker compose config --quiet` | O Compose aceita a configuração de exemplo | Existência das imagens e dos arquivos montados ou disponibilidade dos serviços |
| `bash -n` | A sintaxe dos scripts e testes é válida | Comportamento dos comandos durante a execução |
| `tests/test-scripts.sh` | Os cenários automatizados produzem o comportamento esperado com Docker simulado | Funcionamento do ERP, backup ou restauração reais |

Essa separação evita atribuir ao pipeline mais garantias do que ele realmente oferece.

## Por que validar com `.env.example`

O `.env` efetivo pertence à máquina local e permanece fora do Git. A CI usa explicitamente `.env.example`, que documenta o contrato mínimo de variáveis e fornece valores seguros para validar a interpolação do Compose.

O modo `config --quiet` processa e valida a configuração sem imprimir o resultado resolvido. Isso reduz a saída desnecessária no log do job.

Variáveis já exportadas no Shell ainda podem sobrescrever valores de interpolação. Por isso, ao reproduzir o comando localmente, é importante conferir se o terminal não possui variáveis do projeto com valores diferentes dos usados na CI.

## Testes sem iniciar containers

A suíte `tests/test-scripts.sh` usa um comando Docker simulado e arquivos fictícios criados em diretórios temporários. Os doze cenários cobrem, entre outros comportamentos:

- preparação inicial e preservação de arquivos em uma nova execução;
- substituição explícita com `--force`;
- rejeição de arquivos ausentes, vazios ou configurações divergentes;
- falha controlada quando o Docker não está disponível;
- garantia de que o conteúdo de `.env` não seja executado como Shell;
- preservação das configurações atuais quando o gerador falha;
- ausência da senha de teste na saída dessa falha simulada.

Esses testes protegem a lógica dos scripts sem exigir imagens TOTVS ou artefatos proprietários. Eles não constituem uma revisão completa de segurança e não exercitam os binários reais.

Nenhuma etapa do workflow inicia containers, baixa imagens, publica artefatos ou faz deploy. A CI valida somente o que está versionado e pode ser reproduzido no runner.

## Reproduzindo a validação localmente

Com Bash, Docker CLI e Docker Compose disponíveis, os mesmos gates podem ser executados na raiz do repositório:

```bash
docker compose --env-file .env.example -f docker-compose.yml config --quiet

while IFS= read -r -d '' script; do
  bash -n "$script" || exit 1
done < <(find scripts tests -type f -name '*.sh' -print0)

./tests/test-scripts.sh
```

Essas verificações não exigem o daemon Docker em execução. Quando disponível, o ShellCheck pode complementar a análise dos scripts, mas ele não faz parte do workflow atual.

Na validação local registrada em 23/09/2026, o Compose aceitou a configuração, todos os arquivos Shell passaram pelo `bash -n` e os doze cenários automatizados foram aprovados. Nenhum container foi iniciado ou alterado nessa execução. O commit de referência também registra a aprovação posterior do workflow no GitHub Actions.

## O pipeline passou. O Protheus está pronto?

Ainda não é possível concluir isso.

O pipeline confirma que a configuração versionada é processável e que os scripts se comportam como esperado nos cenários simulados. A validação do ambiente preparado continua dependendo de verificações locais:

```bash
./scripts/check.sh
docker compose ps
docker compose logs --tail=100 appserver dbaccess-postgres license postgres-iniciado
```

Depois da subida, ainda precisamos acessar o WebApp, abrir o ambiente `PROTHEUS_DOCKER` e conferir as comunicações AppServer → DBAccess → PostgreSQL e AppServer → License Server.

Um container em execução e uma porta aberta são sinais úteis, mas não comprovam readiness funcional. Da mesma forma, a restauração de um dump em banco separado valida parte da recuperação de dados, não o funcionamento completo do ERP.

Essa distinção pode ser resumida assim:

```text
CI aprovada
  -> configuração versionada aceita
  -> sintaxe Bash válida
  -> cenários simulados aprovados

Validação do ambiente real
  -> serviços iniciados
  -> integrações funcionando
  -> WebApp e ambiente acessíveis
  -> dados recuperáveis e ERP utilizável
```

A primeira camada é automatizada neste projeto. A segunda requer o ambiente preparado e os artefatos que não fazem parte do repositório.

## Limites do laboratório

Encerrar a série também exige documentar o que este projeto não pretende resolver:

- as imagens TOTVS usadas são destinadas a desenvolvimento; o lab não representa uma arquitetura homologada para produção;
- algumas imagens usam tags implícitas e podem mudar, portanto a CI não garante reprodutibilidade binária nem compatibilidade entre versões;
- o PostgreSQL usa volume anônimo; `down` seguido de `up` não reutiliza esse volume automaticamente;
- o dump do banco não inclui RPO, systemload, configurações locais nem todos os arquivos presentes na camada dos containers;
- licenciamento, desempenho, disponibilidade funcional e recuperação completa dependem de testes no ambiente real;
- não há deploy automático, alta disponibilidade, gestão corporativa de secrets ou observabilidade centralizada.

Esses pontos não diminuem a utilidade do laboratório. Eles definem sua fronteira e evitam que uma solução de estudo seja confundida com uma plataforma de produção.

## O que as cinco partes entregam

Ao longo da série, o laboratório evoluiu em cinco camadas:

1. composição do ambiente com PostgreSQL, DBAccess, License Server e AppServer;
2. organização de serviços, configurações, dependências e volumes;
3. automação segura da preparação e testes dos scripts;
4. inventário dos dados, backup e ensaio de restauração;
5. integração contínua para os artefatos versionáveis e registro explícito dos limites.

O resultado não é apenas um Compose capaz de iniciar serviços. É um projeto com configuração revisável, operações documentadas, testes locais, evidência de CI e critérios claros sobre o que ainda precisa ser verificado manualmente.

Para mim, esse é o principal aprendizado da série: DevOps não consiste em transformar todo procedimento em pipeline, mas em tornar explícito o que pode ser automatizado, qual evidência cada validação produz e onde ainda existe dependência do ambiente real.

## Referências

- [Parte 5: procedimentos, limites e evidências](https://github.com/dirleiflsilva/protheus-docker-lab/blob/017c4cc495475a39ad2f4a0999e0488165defb6d/docs/parte-5/README.md)
- [Workflow de validação](https://github.com/dirleiflsilva/protheus-docker-lab/blob/017c4cc495475a39ad2f4a0999e0488165defb6d/.github/workflows/validacao.yml)
- [Execuções no GitHub Actions](https://github.com/dirleiflsilva/protheus-docker-lab/actions)
- [Docker Docs: `docker compose config`](https://docs.docker.com/reference/cli/docker/compose/config/)
- [Protheus Docker — TOTVS Engineering Pro](https://docker-protheus.engpro.totvs.com.br/)
