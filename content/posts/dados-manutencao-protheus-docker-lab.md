---
title: "Dados e manutenção no Protheus Docker Lab"
date: 2026-09-16
draft: false
toc: true
slug: "dados-manutencao-protheus-docker-lab"
description: "Onde os dados persistem no Protheus Docker Lab, como gerar um backup do PostgreSQL e validar a restauração em um banco separado."
tags:
  - protheus
  - postgresql
  - docker
  - backup
  - restore
  - devops
topics:
  - Protheus e AdvPL
  - DevOps e Confiabilidade
series:
  - Protheus Docker Lab
series_order: 4
---

Depois de [automatizar a configuração local](/posts/automatizando-configuracao-local-protheus-docker-lab/), precisamos saber o que acontece com os dados quando o ambiente para, volta ou tem seus contêineres recriados.

A [Parte 4 do Protheus Docker Lab](https://github.com/dirleiflsilva/protheus-docker-lab/tree/main/docs/parte-4) já está publicada. Ela reúne o inventário de persistência, o backup do PostgreSQL, um ensaio de restauração em banco separado e a rotina de manutenção.

Este artigo acompanha a [versão 4310980 do repositório](https://github.com/dirleiflsilva/protheus-docker-lab/tree/4310980b39276a9034bd1534139f2ba30159d9ae). As evidências citadas são as documentadas na execução de 12/09/2026.

## Onde os dados ficam

O ambiente distribui seu estado entre o PostgreSQL, arquivos de trabalho e configurações locais:

| Conteúdo | Armazenamento no laboratório |
|---|---|
| PostgreSQL | Volume anônimo em `/var/lib/postgresql/data` |
| RPO de trabalho | `volumes/apo/tttm120.rpo` |
| Systemload | `volumes/systemload/` |
| Logs montados | `volumes/logs/` |
| Configuração local | `.env` e `config/*.ini` |

O Compose não declara um volume nomeado para o banco. Na validação publicada, a imagem `totvsengpro/postgres-dev:12.1.2510_bra` declarou o volume anônimo, e `SHOW data_directory` confirmou o diretório usado pelo servidor.

Essa escolha afeta a operação: `docker compose down` preserva o volume anônimo por padrão, mas um `up` posterior não o remonta automaticamente. O arquivo continuar no disco não significa que o novo contêiner usará aquele mesmo armazenamento.

A Parte 4 não migrou o banco para um volume nomeado. Essa mudança exigiria identificar os dados atuais e planejar sua transferência; acrescentar uma montagem ao Compose não copia o conteúdo anterior.

## Pausar e retomar no dia a dia

Para continuar usando os mesmos contêineres e suas montagens, execute na raiz do repositório:

```bash
./scripts/stop.sh
./scripts/start.sh
```

O `start.sh` inicia contêineres existentes. Na primeira inicialização, use `up.sh`, conforme a preparação descrita no README principal.

Antes de remover ou recriar contêineres, faça backup e confira também os arquivos gravados fora das montagens locais. O estado do ambiente não se resume ao banco.

## Gerando o backup do PostgreSQL

Com o laboratório preparado, inicie o serviço do banco e confira seu estado:

```bash
docker compose up -d postgres-iniciado
docker compose ps
```

Depois que estiver `healthy`:

```bash
./scripts/backup.sh
```

O script executa `pg_dump --format=custom` dentro do serviço `postgres-iniciado`. Obtém usuário, banco e porta pela configuração do Compose, sem executar o `.env` como código Shell.

Cada execução cria um diretório exclusivo em `backups/`, com permissões restritas. O dump começa com o sufixo `.partial` e só recebe o nome `database.dump` depois que a geração e a leitura do catálogo com `pg_restore --list` terminam com sucesso.

Isso evita apresentar um arquivo incompleto como backup concluído. Ainda assim, um catálogo legível não demonstra que os dados podem ser usados: precisamos ensaiar a restauração.

O backup cobre um banco. Não inclui roles globais, tablespaces, RPO, systemload nem configurações locais. Copie os arquivos concluídos para outro local privado; o laboratório não implementa retenção ou exclusão automática.

## Restaurando em um banco separado

Use um backup de origem confiável e substitua o caminho abaixo pelo informado ao final da execução:

```bash
./scripts/restore.sh backups/postgres-<data>-<identificador>/database.dump protheus_validacao
```

O script verifica o catálogo, cria um banco a partir de `template0` e restaura em uma transação. Recusa o banco de origem e os bancos de sistema; se o destino já existir, a criação falha antes da importação.

Uma falha durante a importação mantém o banco criado para diagnóstico. O script não o remove automaticamente.

A restauração usa `--no-owner --no-acl`. Os objetos ficam com o usuário da restauração e os privilégios originais não são reproduzidos. Esse fluxo permite ensaiar a recuperação de dados e objetos, mas não representa uma restauração completa de usuários e permissões.

O AppServer continua conectado ao banco original. O comando não troca a base usada pelo ERP.

## Comparando origem e destino

Uma primeira verificação é consultar uma tabela relevante nos dois bancos. Com os nomes e usuário padrão do lab:

```bash
docker compose exec -T postgres-iniciado psql -U postgres -d protheus -c 'SELECT count(*) FROM public.sys_usr;'
docker compose exec -T postgres-iniciado psql -U postgres -d protheus_validacao -c 'SELECT count(*) FROM public.sys_usr;'
```

Adapte os nomes se alterou a configuração ou escolheu outro destino. Contagens iguais são uma evidência parcial: não verificam todos os valores, permissões ou fluxos do ERP.

A [execução registrada em 12/09/2026](https://github.com/dirleiflsilva/protheus-docker-lab/blob/4310980b39276a9034bd1534139f2ba30159d9ae/docs/parte-4/README.md#evidências-da-execução-em-12092026) documenta:

| Verificação | Resultado registrado |
|---|---|
| Servidor | PostgreSQL 15.2 na imagem `12.1.2510_bra` |
| Backup | Formato custom, aproximadamente 32 MiB, catálogo legível |
| Destino do ensaio | `protheus_validacao_20260912` |
| Tabelas em `pg_stat_user_tables` | 126 na origem e no destino |
| Registros em `public.sys_usr` | 1 na origem e no destino |
| Destino igual à origem ou já existente | Restauração recusada |
| Pausa e retomada | Banco restaurado consultado com o registro preservado |

O registro também informa aprovação da verificação de sintaxe com `bash -n` e da suíte `tests/test-scripts.sh`. O backup e o banco restaurado foram preservados.

Esses resultados validam o fluxo de backup e restauração do PostgreSQL. A homologação funcional do ERP e a migração para volume nomeado permanecem fora dessa etapa.

## Manutenção com os arquivos de trabalho

Antes de alterar artefatos, confira serviços, logs e espaço disponível:

```bash
docker compose ps
docker compose logs --tail=100
df -h .
du -sh backups volumes
docker system df
```

O comando `du` pressupõe que os diretórios já existam. Para copiar arquivos de trabalho ou substituir artefatos, pare os serviços que os utilizam:

```bash
docker compose stop appserver dbaccess-postgres
```

Com esses serviços parados, faça o backup do banco e copie RPO, systemload e configurações necessárias para um diretório privado. Preserve também uma origem limpa dos artefatos. O `.env` e os arquivos de configuração efetivos contêm credenciais e devem permanecer fora do Git.

Depois da manutenção:

```bash
./scripts/check.sh
./scripts/start.sh
```

Confira novamente logs e acesso ao ERP. A validação dos arquivos de configuração ajuda a detectar problemas de preparação, mas não substitui esse teste de uso.

Copiar o diretório físico de um PostgreSQL em execução não substitui o dump. Atualizações de imagens e mudanças de versão do banco também precisam de validação de compatibilidade e plano de retorno próprios.

## O que esta etapa acrescenta

Agora o laboratório tem um procedimento para preservar os contêineres no uso diário, gerar um backup e exercitar sua restauração sem substituir a origem.

O aprendizado central está em conhecer os limites de cada cópia: o dump guarda o banco, as montagens guardam parte dos arquivos e o teste funcional confirma se o conjunto atende ao uso esperado. Esse inventário orienta a manutenção e prepara a discussão sobre validação DevOps e limites do laboratório na Parte 5.

## Referências

- [Parte 4: procedimentos e evidências](https://github.com/dirleiflsilva/protheus-docker-lab/blob/4310980b39276a9034bd1534139f2ba30159d9ae/docs/parte-4/README.md)
- [Script de backup](https://github.com/dirleiflsilva/protheus-docker-lab/blob/4310980b39276a9034bd1534139f2ba30159d9ae/scripts/backup.sh)
- [Script de restauração](https://github.com/dirleiflsilva/protheus-docker-lab/blob/4310980b39276a9034bd1534139f2ba30159d9ae/scripts/restore.sh)
