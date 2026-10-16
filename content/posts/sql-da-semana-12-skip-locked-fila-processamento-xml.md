---
title: "SQL da Semana #12 — SKIP LOCKED: fila concorrente de processamento de XML"
date: 2026-10-16
draft: false
toc: true
slug: "sql-da-semana-12-skip-locked-fila-processamento-xml"
description: "Use FOR UPDATE SKIP LOCKED no PostgreSQL para distribuir itens de uma fila entre workers concorrentes sem fazer todos aguardarem a mesma linha."
tags:
  - postgresql
  - sql
  - skip-locked
  - concorrencia
  - filas
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 12
---

Uma integração recebe documentos XML e precisa distribuí-los entre vários workers. Cada documento deve ser processado por apenas um consumidor, mas todos consultam a mesma tabela em busca do próximo item pendente.

Se as sessões tentarem bloquear a primeira linha da fila com um `FOR UPDATE` comum, elas podem acabar aguardando o mesmo item enquanto existem outros documentos disponíveis.

O PostgreSQL oferece `SKIP LOCKED` para outro tipo de coordenação: em vez de esperar por uma linha já bloqueada, a consulta a ignora e procura a próxima candidata.

Neste episódio, vamos montar uma fila sintética, reservar itens com dois workers e discutir o que essa técnica resolve — e o que ainda precisa ser tratado pela aplicação.

> O [laboratório reproduzível do episódio 12](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/12-skip-locked) contém os scripts, a massa de XMLs sintéticos, o roteiro determinístico para duas sessões e os resultados observados.

## O cenário

O exemplo representa uma base própria de integração. Os registros são sintéticos e não existe leitura nem escrita em tabelas do ERP.

Cada linha identifica um documento que aguarda processamento. Para tornar o exemplo autocontido, o laboratório guarda um pequeno XML fictício na própria fila. Em produção, o conteúdo também poderia ficar em um armazenamento de objetos ou diretório controlado, deixando na tabela apenas a referência necessária.

```sql
CREATE SCHEMA sql_semana_12;

CREATE TABLE sql_semana_12.fila_documentos (
    documento_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chave         text NOT NULL UNIQUE,
    nome_arquivo  text NOT NULL,
    conteudo_xml  xml NOT NULL,
    status        text NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'processando', 'concluido', 'falhou')),
    tentativas    integer NOT NULL DEFAULT 0
        CHECK (tentativas >= 0),
    worker_id     text,
    criado_em     timestamptz NOT NULL DEFAULT clock_timestamp(),
    iniciado_em   timestamptz,
    concluido_em  timestamptz,
    ultimo_erro   text
);

CREATE INDEX fila_documentos_pendentes_idx
    ON sql_semana_12.fila_documentos (criado_em, documento_id)
    WHERE status = 'pendente';
```

A restrição `UNIQUE` em `chave` ajuda a impedir que o mesmo documento seja colocado duas vezes na fila. Ela não substitui idempotência no processamento, mas protege uma invariante útil na entrada.

Vamos carregar quatro itens:

```sql
INSERT INTO sql_semana_12.fila_documentos
    (chave, nome_arquivo, conteudo_xml, criado_em)
VALUES
    ('NFE-0001', 'nfe-0001.xml',
     xmlparse(document '<nfe id="NFE-0001"><valor>101.10</valor></nfe>'),
     timestamptz '2026-10-16 09:00:01-03'),
    ('NFE-0002', 'nfe-0002.xml',
     xmlparse(document '<nfe id="NFE-0002"><valor>202.20</valor></nfe>'),
     timestamptz '2026-10-16 09:00:02-03'),
    ('NFE-0003', 'nfe-0003.xml',
     xmlparse(document '<nfe id="NFE-0003"><valor>303.30</valor></nfe>'),
     timestamptz '2026-10-16 09:00:03-03'),
    ('NFE-0004', 'nfe-0004.xml',
     xmlparse(document '<nfe id="NFE-0004"><valor>404.40</valor></nfe>'),
     timestamptz '2026-10-16 09:00:04-03');
```

## O problema de todos aguardarem a primeira linha

Uma primeira tentativa pode selecionar o documento pendente mais antigo:

```sql
BEGIN;

SELECT documento_id, chave, nome_arquivo
FROM sql_semana_12.fila_documentos
WHERE status = 'pendente'
ORDER BY criado_em, documento_id
FOR UPDATE
LIMIT 1;
```

Se a sessão A bloquear o documento 1 e mantiver a transação aberta, a sessão B que executar o mesmo comando tentará obter lock sobre a mesma linha. Ela aguardará a sessão A, embora os documentos 2, 3 e 4 continuem pendentes.

Esse comportamento é adequado quando a decisão precisa ser serializada sobre uma linha específica. Foi o caso da conta estudada no episódio sobre [`FOR UPDATE`](/posts/sql-da-semana-11-for-update-controle-concorrencia/): duas transações não podiam reservar o mesmo saldo inicial.

Em uma fila, porém, os itens pendentes são trabalhos independentes. A sessão B não precisa disputar o documento 1 se pode reservar o documento 2.

## Pulando linhas bloqueadas

A cláusula `SKIP LOCKED` muda o comportamento da espera:

```sql
SELECT documento_id, chave, nome_arquivo
FROM sql_semana_12.fila_documentos
WHERE status = 'pendente'
ORDER BY criado_em, documento_id
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

Quando uma linha candidata já possui um lock conflitante, o PostgreSQL não aguarda sua liberação. A linha é ignorada para aquele comando, e a busca pode continuar pelas próximas candidatas.

Isso permite que consumidores concorrentes reservem itens diferentes. A contrapartida é importante: o resultado não representa uma visão consistente de todas as linhas que atendem ao filtro. Existem registros que satisfazem `status = 'pendente'`, mas foram omitidos porque estavam bloqueados.

Essa característica torna `SKIP LOCKED` apropriado para estruturas semelhantes a filas. Ela também explica por que a cláusula não deve ser usada como solução genérica para consultas que precisam representar o conjunto completo.

## Selecionar e reservar no mesmo comando

Somente selecionar a linha ainda deixa a aplicação responsável por alterar seu estado. Podemos usar uma CTE para escolher um item disponível e marcá-lo como reservado pelo worker:

```sql
WITH proximo AS (
    SELECT documento_id
    FROM sql_semana_12.fila_documentos
    WHERE status = 'pendente'
    ORDER BY criado_em, documento_id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE sql_semana_12.fila_documentos AS fila
SET status = 'processando',
    worker_id = 'worker-a',
    tentativas = tentativas + 1,
    iniciado_em = clock_timestamp(),
    concluido_em = NULL,
    ultimo_erro = NULL
FROM proximo
WHERE fila.documento_id = proximo.documento_id
RETURNING
    fila.documento_id,
    fila.chave,
    fila.nome_arquivo,
    fila.status,
    fila.worker_id,
    fila.tentativas;
```

O `SELECT` da CTE bloqueia no máximo uma linha disponível. O `UPDATE` altera exatamente o item escolhido e devolve os dados necessários para iniciar o processamento.

Se nenhuma linha for retornada, não havia item pendente disponível naquele instante. Isso não prova que a tabela inteira esteja vazia: outros itens podem estar bloqueados ou já marcados como `processando`.

## Reproduzindo com duas sessões

Abra dois terminais conectados ao mesmo banco. Antes do teste, restaure a fila:

```sql
UPDATE sql_semana_12.fila_documentos
SET status = 'pendente',
    tentativas = 0,
    worker_id = NULL,
    iniciado_em = NULL,
    concluido_em = NULL,
    ultimo_erro = NULL;
```

### Sessão A

Inicie uma transação e reserve o primeiro documento, mas ainda não execute `COMMIT`:

```sql
BEGIN;

WITH proximo AS (
    SELECT documento_id
    FROM sql_semana_12.fila_documentos
    WHERE status = 'pendente'
    ORDER BY criado_em, documento_id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE sql_semana_12.fila_documentos AS fila
SET status = 'processando',
    worker_id = 'worker-a',
    tentativas = tentativas + 1,
    iniciado_em = clock_timestamp()
FROM proximo
WHERE fila.documento_id = proximo.documento_id
RETURNING fila.documento_id, fila.chave, fila.worker_id;
```

Na validação, o resultado foi o documento 1 para `worker-a`. A linha permaneceu bloqueada enquanto a transação ficou aberta.

### Sessão B

Sem encerrar a sessão A, execute a mesma reserva com outro identificador:

```sql
BEGIN;

WITH proximo AS (
    SELECT documento_id
    FROM sql_semana_12.fila_documentos
    WHERE status = 'pendente'
    ORDER BY criado_em, documento_id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE sql_semana_12.fila_documentos AS fila
SET status = 'processando',
    worker_id = 'worker-b',
    tentativas = tentativas + 1,
    iniciado_em = clock_timestamp()
FROM proximo
WHERE fila.documento_id = proximo.documento_id
RETURNING fila.documento_id, fila.chave, fila.worker_id;
```

Na execução validada, a sessão B ignorou o documento 1 bloqueado e reservou imediatamente o documento 2 para `worker-b`. Um `lock_timeout` de dois segundos permaneceu configurado durante o teste e não foi atingido.

Confirme as duas transações:

```sql
-- Sessão A
COMMIT;
```

```sql
-- Sessão B
COMMIT;
```

Depois, consulte a fila:

```sql
SELECT documento_id, chave, status, worker_id, tentativas
FROM sql_semana_12.fila_documentos
ORDER BY documento_id;
```

Resultado observado:

| Documento | Chave | Status | Worker | Tentativas |
|---:|---|---|---|---:|
| 1 | NFE-0001 | processando | worker-a | 1 |
| 2 | NFE-0002 | processando | worker-b | 1 |
| 3 | NFE-0003 | pendente |  | 0 |
| 4 | NFE-0004 | pendente |  | 0 |

## A transação deve durar somente o necessário

O lock existe até o fim da transação. Isso não significa que o worker deva manter a transação aberta enquanto lê um arquivo, chama uma API ou executa um processamento demorado.

Um fluxo mais seguro separa a reserva do trabalho externo:

1. iniciar a transação;
2. localizar e marcar um item com `SKIP LOCKED`;
3. confirmar a reserva com `COMMIT`;
4. processar o documento fora da transação;
5. abrir uma nova transação curta para registrar sucesso ou falha.

Depois de reservar o item, o worker pode confirmar rapidamente:

```sql
COMMIT;
```

Ao concluir o processamento:

```sql
UPDATE sql_semana_12.fila_documentos
SET status = 'concluido',
    concluido_em = clock_timestamp(),
    ultimo_erro = NULL
WHERE documento_id = 1
  AND status = 'processando'
  AND worker_id = 'worker-a'
RETURNING documento_id, chave, status, concluido_em;
```

Conferir `status` e `worker_id` evita que um worker finalize silenciosamente uma reserva que já não pertence a ele. Em um sistema real, um token único por tentativa oferece uma proteção mais precisa do que um nome fixo de worker.

Uma falha pode ser registrada da mesma forma, em uma nova transação curta:

```sql
UPDATE sql_semana_12.fila_documentos
SET status = 'falhou',
    concluido_em = clock_timestamp(),
    ultimo_erro = 'Falha sintética ao enviar documento'
WHERE documento_id = 2
  AND status = 'processando'
  AND worker_id = 'worker-b'
RETURNING documento_id, chave, status, tentativas, ultimo_erro;
```

## E se o worker falhar depois da reserva?

Depois do `COMMIT`, nenhum lock permanece sobre o item. Se o processo encerrar antes de registrar o resultado, a linha pode ficar indefinidamente como `processando`.

`SKIP LOCKED` não resolve recuperação, retry nem entrega exatamente uma vez. Uma fila operacional precisa definir, entre outros pontos:

- quando uma reserva é considerada expirada;
- quem pode devolver o item ao estado pendente;
- quantas tentativas são permitidas;
- como registrar o último erro;
- quando mover um item para uma fila de falhas;
- como impedir efeitos duplicados durante uma nova tentativa.

Uma evolução comum é tratar a reserva como um lease, registrando um prazo:

```sql
ALTER TABLE sql_semana_12.fila_documentos
ADD COLUMN reservado_ate timestamptz;
```

O worker define `reservado_ate` ao adquirir o item. Outro processo pode identificar reservas expiradas e aplicar uma política explícita de recuperação.

Mesmo assim, o processamento precisa ser idempotente. Um worker pode concluir um efeito externo e falhar antes de atualizar a fila. Na tentativa seguinte, o sistema deve reconhecer que aquele efeito já ocorreu ou conseguir repeti-lo sem produzir duplicidade.

## Ordenação não significa justiça absoluta

O `ORDER BY criado_em, documento_id` expressa a preferência pelos itens mais antigos entre as linhas disponíveis. Com consumidores concorrentes e locks, isso não garante uma ordem global rígida de conclusão.

Um item antigo pode permanecer bloqueado ou demorar mais para processar enquanto itens posteriores são reservados e concluídos. Se isso se repetir, ele pode sofrer *starvation*. Essa é uma troca do desenho: aumentar o paralelismo aceitando que a fila observada por cada worker não é um retrato completo.

Se determinadas categorias exigem prioridade, limites de concorrência ou ordenação estrita, essas regras precisam aparecer no modelo e na consulta. Adicionar `SKIP LOCKED` não cria sozinho uma política de agendamento.

## Reservando pequenos lotes

O mesmo padrão pode selecionar mais de um item por transação:

```sql
WITH proximos AS (
    SELECT documento_id
    FROM sql_semana_12.fila_documentos
    WHERE status = 'pendente'
    ORDER BY criado_em, documento_id
    FOR UPDATE SKIP LOCKED
    LIMIT 10
)
UPDATE sql_semana_12.fila_documentos AS fila
SET status = 'processando',
    worker_id = 'worker-a',
    tentativas = tentativas + 1,
    iniciado_em = clock_timestamp()
FROM proximos
WHERE fila.documento_id = proximos.documento_id
RETURNING fila.documento_id, fila.chave, fila.nome_arquivo;
```

Lotes reduzem a frequência de consultas à fila, mas ampliam a quantidade de trabalho reservada por um único consumidor. Um worker que pega itens demais pode aumentar o tempo de espera dos documentos que ficaram sob sua responsabilidade.

O tamanho adequado depende do custo de cada item, do número de consumidores e da estratégia de recuperação. Ele deve ser medido, não escolhido apenas pela capacidade máxima do banco.

## Quando usar `SKIP LOCKED`

A cláusula faz sentido quando:

- várias sessões disputam itens independentes;
- cada item deve ser reservado por um consumidor;
- é aceitável ignorar temporariamente linhas bloqueadas;
- a aplicação possui estados explícitos de processamento;
- existem estratégias de retry, expiração e idempotência.

Ela não é uma boa escolha quando:

- a consulta precisa representar todas as linhas que atendem ao filtro;
- uma operação depende especificamente do primeiro item bloqueado;
- pular uma linha pode violar a ordem exigida pelo negócio;
- o estado `processando` não possui recuperação;
- a aplicação interpreta “nenhuma linha retornada” como prova de que a fila está vazia.

## Validação executada

O laboratório foi executado em **PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1), 64-bit**, na imagem `postgres:16`, usando uma base local exclusiva de integração.

Os resultados observados foram:

- sem `SKIP LOCKED`, a sessão B tentou bloquear o documento 1 e recebeu `canceling statement due to lock timeout` após o limite de dois segundos, embora houvesse outros três itens pendentes;
- com `SKIP LOCKED`, a sessão A reservou o documento 1 e, enquanto esse lock continuava ativo, a sessão B reservou o documento 2 em menos de um segundo;
- com as quatro linhas pendentes bloqueadas pela sessão A, a consulta da sessão B com `SKIP LOCKED` retornou zero linhas, enquanto uma contagem comum na mesma sessão encontrou quatro pendentes;
- a CTE com `UPDATE ... RETURNING` reservou uma única linha por chamada;
- os exemplos de conclusão e falha persistiram os estados `concluido` e `falhou`, cada um com uma tentativa.

As transações concorrentes mantiveram locks apenas durante a reserva e foram encerradas logo depois. O processamento externo não fez parte dessas transações. O roteiro completo, incluindo restauração do estado inicial, está no [repositório do laboratório](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/12-skip-locked).

## Conclusão

`FOR UPDATE SKIP LOCKED` permite que consumidores concorrentes avancem por itens independentes sem formar uma fila de espera sobre a primeira linha candidata.

No exemplo, a sessão A reserva o primeiro documento e a sessão B segue para o segundo. A CTE combina escolha e mudança de estado, reduzindo o espaço para que a aplicação separe essas duas decisões.

A cláusula, porém, resolve somente a disputa pela reserva. Uma fila confiável ainda precisa de transações curtas, estados claros, recuperação de leases expirados, limite de tentativas e processamento idempotente.

O principal cuidado é interpretar corretamente o resultado: uma linha ignorada por estar bloqueada continua existindo. `SKIP LOCKED` troca uma visão completa do conjunto por progresso concorrente — exatamente o que uma fila pode precisar, mas não o que toda consulta deve aceitar.

## Referências

- [PostgreSQL 16 — SELECT: cláusulas de locking](https://www.postgresql.org/docs/16/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [PostgreSQL 16 — Explicit Locking](https://www.postgresql.org/docs/16/explicit-locking.html)
- [PostgreSQL 16 — Transaction Isolation](https://www.postgresql.org/docs/16/transaction-iso.html)
- [PostgreSQL 16 — UPDATE](https://www.postgresql.org/docs/16/sql-update.html)
