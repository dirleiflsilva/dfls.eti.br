---
title: "Backup só existe após o restore: validação no PostgreSQL"
date: 2026-08-24
draft: false
toc: true
slug: "backup-so-existe-depois-do-restore-validar-recuperacao-postgresql"
description: "Aprenda a validar restores no PostgreSQL verificando catálogo, estrutura, permissões, integridade dos dados, fingerprints e recuperação point-in-time."
tags:
  - postgresql
  - backup
  - restore
  - pitr
  - wal
  - dbre
  - confiabilidade
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
---

Gerar um arquivo de backup e receber uma mensagem de sucesso é apenas o começo.

O teste real acontece quando precisamos responder a perguntas mais difíceis:

- o arquivo pode ser lido?
- o PostgreSQL restaurado consegue iniciar?
- tabelas, índices, constraints e permissões continuam presentes?
- os dados recuperados representam o estado que esperávamos?
- conseguimos repetir o procedimento sem depender de improviso?

Se essas respostas não foram verificadas, temos um artefato de backup, mas ainda não temos evidência de recuperação.

No [Lab 03 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/), implementei backup lógico, backup físico, arquivamento de WAL e recuperação point-in-time. O objetivo deste artigo é aprofundar uma parte específica daquele trabalho: **como validar o restore sem confundir a existência do backup com a capacidade de recuperar o serviço**.

## O que significa validar um restore

Um restore validado não é apenas um comando que terminou com código de saída zero.

Ele precisa produzir um banco utilizável e coerente em um ambiente diferente daquele que gerou o backup. Isso envolve várias camadas:

1. **artefato:** o dump ou base backup existe, está completo e pode ser lido;
2. **inicialização:** o cluster ou banco restaurado consegue entrar em operação;
3. **estrutura:** schemas, tabelas, constraints e índices essenciais estão presentes;
4. **segurança:** owners e privilégios continuam corretos;
5. **dados:** registros importantes e relações de negócio foram preservados;
6. **objetivo de recuperação:** o estado restaurado corresponde ao snapshot ou ao ponto no tempo escolhido;
7. **repetibilidade:** o processo funciona novamente depois de um reset completo.

Essas camadas evitam um falso positivo comum: considerar o restore concluído apenas porque `pg_restore` terminou ou porque o servidor aceitou uma conexão.

## Comece protegendo o próprio artefato

Um processo de recuperação confiável começa ainda durante a criação do backup.

No lab, backups lógicos e físicos são gravados primeiro com o sufixo `.partial`. O nome definitivo só aparece depois que `pg_dump` ou `pg_basebackup` termina com sucesso.

Para o backup lógico, o fluxo é equivalente a:

```bash
pg_dump -U postgres -d appdb -Fc \
  -f /backups/logical/appdb_20260824T120000Z.dump.partial

mv \
  /backups/logical/appdb_20260824T120000Z.dump.partial \
  /backups/logical/appdb_20260824T120000Z.dump
```

O mesmo princípio é aplicado ao diretório produzido por `pg_basebackup`.

Essa publicação em duas etapas impede que uma execução interrompida deixe um arquivo incompleto com aparência de backup válido. Os scripts de restore procuram somente nomes finais e ignoram artefatos `.partial`.

Antes do restore lógico, o catálogo do dump também é inspecionado:

```bash
pg_restore --list /backups/logical/appdb_20260824T120000Z.dump
```

Essa verificação não prova que os dados estão íntegros, mas elimina uma falha anterior: tentar restaurar um arquivo que nem sequer pode ser interpretado pelo `pg_restore`.

Para backups físicos gerados pelo `pg_basebackup`, o `pg_verifybackup` oferece uma verificação complementar. Ele compara os arquivos com o manifesto do backup e ajuda a detectar arquivos ausentes, modificados ou com checksums inconsistentes. Ainda assim, essa verificação não substitui o restore: um manifesto válido não demonstra, sozinho, que o cluster inicia nem que os dados atendem aos critérios de recuperação.

## Restaure fora do banco de origem

Testar um backup no mesmo banco que o produziu reduz a qualidade da evidência e pode colocar a origem em risco.

O Lab 03 usa destinos isolados para cada estratégia:

- o dump lógico é restaurado em `appdb_restore`, criado a partir de `template0`;
- o backup físico é copiado para uma área de trabalho e iniciado em um container PostgreSQL temporário;
- o PITR usa outra cópia do backup físico, monta o arquivo de WAL como somente leitura e publica o cluster recuperado em uma porta separada.

Criar o banco lógico a partir de `template0` é importante porque evita herdar extensões ou customizações locais de `template1`. Se um objeto necessário aparecer no banco restaurado, ele deve ter vindo do processo de recuperação, e não de uma preparação invisível do destino.

No restore físico, o backup original também não é iniciado diretamente. O script faz uma cópia com `cp -a` e trabalha sobre ela. Assim, a validação pode alterar arquivos de controle e iniciar o PostgreSQL sem modificar o artefato que está sendo testado.

Isolamento oferece três vantagens:

- preserva a origem;
- preserva o backup original;
- aproxima o teste de um cenário real, no qual a recuperação acontece em outro ambiente.

## Servidor iniciado não significa dados recuperados

Depois de subir o destino, o primeiro teste é operacional: o PostgreSQL precisa responder ao `pg_isready` dentro de um limite de tempo.

```bash
pg_isready -U postgres -d appdb
```

Esse teste confirma que o servidor aceita conexões. Ele não confirma que o conteúdo necessário está correto.

Por isso, os três cenários do lab — lógico, físico e PITR — executam o mesmo arquivo `validate_restored_db.sql`. A validação compartilhada reduz o risco de usar critérios diferentes para cada método de recuperação.

## Valide a estrutura que sustenta a aplicação

Contar linhas é útil, mas insuficiente. Um banco pode preservar os registros e ainda falhar quando a aplicação tentar usá-lo.

O Lab 03 verifica explicitamente:

- presença das tabelas esperadas nos schemas `app` e `audit`;
- chaves primárias e estrangeiras essenciais;
- índices usados pelas consultas do cenário;
- ownership dos schemas e tabelas;
- privilégios de leitura e escrita das roles da aplicação.

Um exemplo simplificado da verificação de índice é:

```sql
IF NOT EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indexrelid = 'app.idx_orders_ordered_at'::regclass
      AND indisvalid
) THEN
    RAISE EXCEPTION 'índice essencial ausente ou inválido';
END IF;
```

O detalhe de `indisvalid` importa. Encontrar um nome no catálogo não basta se o índice não estiver válido para uso.

Permissões também fazem parte da recuperação. No restore lógico, `pg_dump` protege o conteúdo do banco, mas roles e tablespaces são objetos globais do cluster. Por isso, o lab exige que as roles existam antes da restauração e preserva os owners e ACLs gravados no dump.

Em uma migração para um cluster completamente vazio, seria necessário proteger os objetos globais separadamente, por exemplo com `pg_dumpall --globals-only`, ou recriá-los por um processo controlado de infraestrutura.

## Valide dados conhecidos e regras de negócio

Uma contagem mínima ajuda a detectar um restore vazio ou muito incompleto:

```sql
IF (SELECT count(*) FROM app.customers) < 100
    OR (SELECT count(*) FROM app.products) < 50
    OR (SELECT count(*) FROM app.orders) < 500 THEN
    RAISE EXCEPTION 'volume restaurado abaixo do estado base esperado';
END IF;
```

Mas duas bases com a mesma quantidade de linhas podem conter informações diferentes. Para aumentar a confiança, o lab combina três tipos de verificação.

### Dados sentinela

Registros conhecidos funcionam como marcos do conjunto restaurado. O teste procura, por exemplo:

- um cliente com e-mail e documento esperados;
- um produto com SKU, nome e preço válidos;
- um pedido conhecido com valor positivo.

O objetivo não é validar cada linha individualmente, mas comprovar que registros representativos sobreviveram ao processo.

### Consistência entre tabelas

Também são verificadas regras que representam o domínio da aplicação:

- o total do pedido deve coincidir com a soma de seus itens;
- o valor do pagamento deve coincidir com o total do pedido;
- os relacionamentos entre pedidos, itens e pagamentos devem continuar protegidos por constraints.

Isso detecta situações nas quais os objetos existem e as contagens parecem razoáveis, mas o conjunto de dados perdeu consistência interna.

### Fingerprint determinístico

Para comparar o conteúdo antes e depois de uma recuperação, o lab constrói uma representação determinística de pedidos, itens e pagamentos, ordena as linhas e calcula um hash MD5:

```sql
SELECT md5(
    string_agg(
        entity || '|' || entity_id || '|' || payload,
        E'\n' ORDER BY entity, entity_id
    )
)
FROM fingerprint_rows;
```

O fingerprint não substitui as validações estruturais nem serve como mecanismo criptográfico de segurança. Sua função é responder a uma pergunta prática: **o conteúdo recuperado dessas entidades é exatamente o mesmo conteúdo registrado como referência?**

## Não compare um snapshot antigo com o banco atual como se fossem iguais

Há uma diferença importante entre validar um snapshot e comparar dois bancos em momentos diferentes.

Depois que o backup lógico é criado, o banco principal pode continuar recebendo alterações. Nesse caso, divergências de contagem ou de fingerprint entre o banco atual e o snapshot restaurado são esperadas.

O restore lógico do lab trata essa comparação como informativa. O sucesso depende da validade do catálogo, da estrutura, das permissões, dos dados sentinela e da consistência interna do snapshot — não da igualdade com uma origem que pode ter avançado.

Para exigir igualdade, precisamos capturar o estado de referência no momento correto. É o que o cenário de PITR faz antes de simular o incidente.

## No PITR, compare três estados

O teste de recuperação point-in-time registra três estados distintos:

| Estado | O que representa |
|---|---|
| Antes do incidente | Contagem e fingerprint que queremos recuperar |
| Depois do incidente | Evidência de que a exclusão realmente aconteceu na origem |
| Depois do PITR | Estado produzido pelo backup físico mais o replay dos WALs |

O roteiro executado pelo `pitr_demo.sh` é:

1. gerar um backup físico de base;
2. registrar contagem e fingerprint dos dados;
3. salvar um timestamp anterior ao incidente;
4. excluir pedidos, itens e pagamentos em uma transação;
5. forçar a troca de WAL e confirmar que o segmento do incidente foi arquivado;
6. configurar `restore_command` e `recovery_target_time` em uma cópia do backup;
7. iniciar um cluster temporário e aguardar sua promoção;
8. comparar o estado recuperado com a referência anterior ao incidente.

O teste só termina com sucesso quando:

- a contagem de pedidos recuperada coincide com a referência;
- o fingerprint recuperado coincide com o fingerprint anterior ao incidente;
- dados sentinela, constraints, índices, ownership, privilégios e totais internos continuam válidos.

O timestamp sozinho não é a evidência. Ele apenas define o alvo. A evidência vem da comparação do resultado produzido pela recuperação.

## Confirme que o WAL necessário chegou ao archive

Um PITR depende de uma sequência contínua de WALs. Por isso, não basta executar `pg_switch_wal()` e assumir que o segmento apareceu no destino.

O lab registra os contadores de `pg_stat_archiver`, força a troca de WAL e aguarda duas condições:

- `archived_count` precisa aumentar, enquanto uma nova falha em `failed_count` faz a validação do archiver falhar;
- o arquivo esperado precisa existir em `wal_archive/`.

O helper usado pelo `archive_command` também publica cada WAL de forma atômica. Se um arquivo de mesmo nome já existe, o reenvio só é aceito quando o conteúdo é idêntico; uma colisão com conteúdo diferente falha.

Esse cuidado reduz o intervalo entre “o PostgreSQL tentou arquivar” e “o segmento necessário está realmente disponível para recuperação”.

## Repetibilidade é parte do teste

Um procedimento que funcionou uma única vez pode depender de estado residual, arquivos antigos ou uma sequência manual que não foi documentada.

Para expor esse tipo de dependência, o Lab 03 inclui um teste destrutivo de repetição:

```bash
./scripts/test_repetition.sh --destructive
```

Ele recria o cluster, limpa backups e WALs associados, executa os restores e realiza dois ciclos completos de PITR separados por reset. Ao final, também confirma que:

- dumps com sufixo `.partial` não são escolhidos;
- diretórios de base backup `.partial` são ignorados;
- um timestamp malformado é recusado pelo restore físico.

A flag explícita é intencional: o teste apaga os dados do ambiente do Lab 03. Tornar a destruição visível é uma proteção contra execução acidental e documenta o custo real do ensaio.

## Um checklist prático para testes de restore

Ao desenhar uma validação semelhante, este é um ponto de partida:

- [ ] criar o backup com publicação atômica ou marcador de conclusão;
- [ ] verificar se o artefato pode ser lido;
- [ ] restaurar em ambiente isolado;
- [ ] limitar o tempo de espera pela inicialização;
- [ ] verificar schemas, tabelas, constraints e índices essenciais;
- [ ] validar owners e privilégios;
- [ ] conferir dados sentinela;
- [ ] testar regras de consistência entre entidades;
- [ ] comparar um fingerprint com uma referência capturada no momento correto;
- [ ] no PITR, confirmar o arquivamento do WAL necessário;
- [ ] registrar duração, resultado e logs da recuperação;
- [ ] repetir o procedimento a partir de um ambiente limpo;
- [ ] documentar como a aplicação voltaria a usar o banco restaurado.

Os dois últimos itens apontam para uma diferença entre o laboratório e uma operação de produção. O Lab 03 valida os mecanismos nativos do PostgreSQL, mas não implementa agenda de backups, retenção, criptografia, cópia externa, monitoramento contínuo nem o redirecionamento da aplicação após o desastre.

Em produção, os testes também precisam demonstrar se o **RPO** — quanto de dados podemos perder — e o **RTO** — quanto tempo podemos levar para recuperar o serviço — foram cumpridos. Ferramentas como pgBackRest ou Barman podem automatizar partes importantes dessa estratégia, mas não eliminam a necessidade de testar o resultado.

## Conclusão

O backup é uma entrada do processo de recuperação, não o resultado final.

A confiança aparece quando conseguimos restaurar em um ambiente isolado, iniciar o PostgreSQL, verificar objetos e permissões, validar regras de negócio e comparar os dados com uma referência adequada. No caso do PITR, também precisamos provar que os WALs necessários estavam disponíveis e que o estado recuperado corresponde ao instante escolhido.

O principal aprendizado do Lab 03 foi este: **um backup só se torna evidência de proteção depois que o restore é executado, validado e repetido**.

O código completo dos testes está no [diretório do Lab 03 no GitHub](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/main/labs/03-backup-restore), na referência técnica [`c77a490`](https://github.com/dirleiflsilva/postgresql-reliability-lab/commit/c77a4903aa656729a1777e5d2f209f2c1991b632).

## Referências

- [PostgreSQL: backup e restore](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL: pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [PostgreSQL: pg_basebackup](https://www.postgresql.org/docs/current/app-pgbasebackup.html)
- [PostgreSQL: pg_verifybackup](https://www.postgresql.org/docs/current/app-pgverifybackup.html)
- [PostgreSQL: arquivamento contínuo e PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Backup lógico vs. backup físico no PostgreSQL](/posts/backup-logico-vs-backup-fisico-postgresql/)
