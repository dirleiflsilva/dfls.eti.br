---
title: "SQL da Semana #11 — FOR UPDATE: controle de concorrência em uma base de integração"
date: 2026-10-10
draft: false
toc: true
slug: "sql-da-semana-11-for-update-controle-concorrencia"
description: "Use SELECT FOR UPDATE no PostgreSQL para proteger decisões de negócio contra alterações concorrentes e entender quando uma transação precisa esperar."
tags:
  - postgresql
  - sql
  - for-update
  - concorrencia
  - locks
  - sql-da-semana
topics:
  - PostgreSQL e SQL
series:
  - SQL da Semana
series_order: 11
---

Duas instâncias de uma integração recebem solicitações quase ao mesmo tempo. Ambas consultam o mesmo saldo disponível, verificam que existe limite suficiente e aprovam uma reserva.

Cada consulta, isoladamente, está correta. O problema aparece porque as duas decisões foram tomadas sobre o mesmo estado inicial.

Quando uma leitura serve de base para uma alteração posterior, um `SELECT` comum pode não ser suficiente. No PostgreSQL, `SELECT ... FOR UPDATE` permite bloquear as linhas selecionadas até o fim da transação e serializar decisões concorrentes sobre elas.

Neste episódio, vamos reproduzir o problema com duas sessões e observar o que muda quando a leitura passa a adquirir um lock de linha.

> O [laboratório do episódio 11](https://github.com/dirleiflsilva/sql-da-semana-postgresql/tree/main/episodios/11-for-update) está disponível no GitHub. Ele traz os scripts do exemplo e um roteiro determinístico para reproduzir a espera pelo lock em duas sessões, testar `NOWAIT` e comparar com o `UPDATE` condicional atômico.

## O cenário

O exemplo representa uma base própria de integração. Não existe acesso nem escrita em tabelas do ERP.

Uma conta possui `100.00` de saldo disponível. Cada solicitação tenta reservar `70.00`. Se dois workers consultarem o saldo antes de qualquer um registrar sua alteração, ambos podem concluir que a reserva é possível.

Vamos usar duas tabelas:

```sql
CREATE SCHEMA sql_semana_11;

CREATE TABLE sql_semana_11.contas_integracao (
    conta_id         bigint PRIMARY KEY,
    saldo_disponivel numeric(12, 2) NOT NULL
        CHECK (saldo_disponivel >= 0),
    atualizado_em    timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE sql_semana_11.reservas (
    reserva_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id   bigint NOT NULL
        REFERENCES sql_semana_11.contas_integracao (conta_id),
    valor      numeric(12, 2) NOT NULL CHECK (valor > 0),
    origem     text NOT NULL,
    criada_em  timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO sql_semana_11.contas_integracao
    (conta_id, saldo_disponivel)
VALUES
    (1, 100.00);
```

O `CHECK` impede que uma atualização grave saldo negativo. Ele é uma proteção importante, mas não coordena sozinho a decisão completa de consultar, aprovar e registrar a reserva.

## Onde nasce a condição de corrida

Imagine que a aplicação execute esta sequência:

```sql
SELECT saldo_disponivel
FROM sql_semana_11.contas_integracao
WHERE conta_id = 1;

-- A aplicação verifica se o saldo cobre o valor solicitado.

INSERT INTO sql_semana_11.reservas (conta_id, valor, origem)
VALUES (1, 70.00, 'worker-a');

UPDATE sql_semana_11.contas_integracao
SET saldo_disponivel = 30.00,
    atualizado_em = clock_timestamp()
WHERE conta_id = 1;
```

Se o worker B fizer o primeiro `SELECT` antes de o worker A concluir, os dois recebem `100.00`. Ambos calculam o novo saldo como `30.00`, inserem uma reserva de `70.00` e gravam o mesmo valor final.

O resultado pode ser:

| Informação | Valor |
|---|---:|
| Saldo inicial | 100.00 |
| Total das duas reservas | 140.00 |
| Saldo armazenado | 30.00 |
| Saldo real após as reservas | -40.00 |

Essa é uma atualização perdida: a segunda gravação substitui um valor calculado a partir de uma leitura que já ficou desatualizada. O banco não consegue inferir que o `30.00` enviado pelo segundo worker representa uma decisão de negócio inválida.

## Bloqueando a linha antes de decidir

A operação precisa ocorrer dentro de uma única transação:

```sql
BEGIN;

SELECT saldo_disponivel
FROM sql_semana_11.contas_integracao
WHERE conta_id = 1
FOR UPDATE;

-- Somente se o saldo retornado for suficiente:

INSERT INTO sql_semana_11.reservas (conta_id, valor, origem)
VALUES (1, 70.00, 'worker-a');

UPDATE sql_semana_11.contas_integracao
SET saldo_disponivel = saldo_disponivel - 70.00,
    atualizado_em = clock_timestamp()
WHERE conta_id = 1;

COMMIT;
```

O `FOR UPDATE` bloqueia a linha da conta como se ela fosse ser atualizada. Outra transação que tente atualizar, excluir ou adquirir um lock conflitante sobre a mesma linha precisa aguardar o término da primeira transação.

Leituras comuns continuam possíveis. Locks de linha não impedem que outra sessão execute um `SELECT` sem cláusula de bloqueio; esse leitor verá a versão compatível com seu snapshot.

## Reproduzindo com duas sessões

Abra dois terminais conectados ao mesmo banco. Antes do teste, restaure o estado inicial:

```sql
TRUNCATE sql_semana_11.reservas RESTART IDENTITY;

UPDATE sql_semana_11.contas_integracao
SET saldo_disponivel = 100.00,
    atualizado_em = clock_timestamp()
WHERE conta_id = 1;
```

### Sessão A

Inicie a transação e bloqueie a conta:

```sql
BEGIN;

SELECT conta_id, saldo_disponivel
FROM sql_semana_11.contas_integracao
WHERE conta_id = 1
FOR UPDATE;
```

O resultado é `100.00`. Mantenha a transação aberta por alguns instantes para observar a concorrência.

### Sessão B

Tente adquirir o mesmo lock:

```sql
BEGIN;

SELECT conta_id, saldo_disponivel
FROM sql_semana_11.contas_integracao
WHERE conta_id = 1
FOR UPDATE;
```

Essa consulta aguarda. A sessão A ainda possui um lock conflitante sobre a linha.

### De volta à sessão A

Registre a primeira reserva e confirme a transação:

```sql
INSERT INTO sql_semana_11.reservas (conta_id, valor, origem)
VALUES (1, 70.00, 'worker-a');

UPDATE sql_semana_11.contas_integracao
SET saldo_disponivel = saldo_disponivel - 70.00,
    atualizado_em = clock_timestamp()
WHERE conta_id = 1;

COMMIT;
```

### Resultado na sessão B

Depois do `COMMIT` da sessão A, a consulta pendente pode continuar. No nível padrão `READ COMMITTED`, ela adquire o lock e devolve a versão atualizada da linha, agora com saldo de `30.00`.

A segunda reserva de `70.00` deve ser rejeitada pela regra da aplicação. Encerre a transação sem alteração:

```sql
ROLLBACK;
```

O estado final permanece coerente:

```sql
SELECT conta_id, saldo_disponivel
FROM sql_semana_11.contas_integracao;

SELECT reserva_id, conta_id, valor, origem
FROM sql_semana_11.reservas
ORDER BY reserva_id;
```

Resultado esperado:

| Conta | Saldo disponível |
|---:|---:|
| 1 | 30.00 |

| Reserva | Conta | Valor | Origem |
|---:|---:|---:|---|
| 1 | 1 | 70.00 | worker-a |

## Por que `BEGIN` e `COMMIT` são essenciais

O lock adquirido por `FOR UPDATE` é mantido até o fim da transação. Se o comando for executado em autocommit, a transação termina assim que o `SELECT` termina e o lock é liberado antes da decisão e do `UPDATE` seguintes.

Este uso não protege a operação:

```sql
SELECT saldo_disponivel
FROM sql_semana_11.contas_integracao
WHERE conta_id = 1
FOR UPDATE;

-- Se o cliente está em autocommit, o lock já foi liberado aqui.

UPDATE sql_semana_11.contas_integracao
SET saldo_disponivel = saldo_disponivel - 70.00
WHERE conta_id = 1;
```

A leitura, a decisão e a escrita precisam pertencer à mesma transação. Em uma aplicação, isso significa também garantir que todos os comandos usem a mesma conexão enquanto a transação estiver ativa.

## Esperar, falhar ou ignorar a linha

Por padrão, uma transação aguarda a liberação do lock. A cláusula `NOWAIT` muda esse comportamento:

```sql
SELECT conta_id, saldo_disponivel
FROM sql_semana_11.contas_integracao
WHERE conta_id = 1
FOR UPDATE NOWAIT;
```

Se a linha já estiver bloqueada por uma operação conflitante, o PostgreSQL retorna um erro imediatamente. Isso pode ser útil quando a aplicação prefere informar “recurso em processamento” ou aplicar uma política de retry em vez de manter uma conexão esperando.

Existe também `SKIP LOCKED`, que pula as linhas indisponíveis. Ele produz uma visão inconsistente do conjunto e não deve ser usado como atalho genérico para evitar espera. Seu uso típico é distribuir itens de uma fila entre consumidores concorrentes — assunto do próximo episódio da série.

## E se o `UPDATE` puder ser atômico?

Nem toda regra de concorrência exige uma leitura separada. Para uma condição pequena, o próprio `UPDATE` pode verificar e alterar o estado atomicamente. Uma CTE também permite usar a linha retornada para registrar a reserva somente quando o saldo foi alterado:

```sql
WITH saldo_reservado AS (
    UPDATE sql_semana_11.contas_integracao
    SET saldo_disponivel = saldo_disponivel - 70.00,
        atualizado_em = clock_timestamp()
    WHERE conta_id = 1
      AND saldo_disponivel >= 70.00
    RETURNING conta_id, saldo_disponivel
)
INSERT INTO sql_semana_11.reservas (conta_id, valor, origem)
SELECT conta_id, 70.00, 'worker-a'
FROM saldo_reservado
RETURNING reserva_id, conta_id, valor, origem;
```

Se uma linha for retornada, o saldo foi reduzido e a reserva foi registrada pelo mesmo comando. Se nenhuma linha for retornada, a conta não existia ou o saldo era insuficiente. Sob concorrência, o segundo `UPDATE` reavalia o predicado depois de aguardar a primeira alteração e não produz linha quando o saldo restante já não cobre o valor.

Essa forma reduz o intervalo entre decisão e escrita e pode ser preferível quando toda a regra cabe no predicado do comando. Se a decisão depende de várias consultas, validações ou linhas relacionadas, o lock explícito pode tornar a intenção mais clara. O desenho deve manter as invariantes no banco com constraints sempre que possível e tratar falhas transacionais na aplicação.

## Cuidados com transações e locks

`FOR UPDATE` resolve uma disputa específica; ele não torna qualquer fluxo concorrente automaticamente seguro.

### Mantenha a transação curta

Não deixe a transação aberta enquanto aguarda uma resposta humana, chama uma API remota ou executa trabalho demorado. Quanto mais tempo o lock permanecer, maior a chance de espera, timeout e acúmulo de conexões.

Quando uma integração envolve sistemas externos, normalmente é melhor separar a confirmação local do processamento remoto com estados, idempotência e retries, em vez de manter uma transação PostgreSQL aberta durante toda a chamada.

### Adquira locks em ordem consistente

Se duas operações precisam bloquear várias contas, ambas devem fazê-lo na mesma ordem. Uma sessão que bloqueia primeiro a conta 1 e depois a 2 pode entrar em deadlock com outra que faz o caminho inverso.

O PostgreSQL detecta deadlocks e aborta uma das transações. A aplicação deve ser capaz de repetir com segurança transações canceladas por esse motivo.

### Diferencie espera de falha

Uma consulta parada pode estar aguardando um lock, não necessariamente executando um plano lento. Em uma investigação, `pg_stat_activity`, `pg_locks` e funções como `pg_blocking_pids()` ajudam a relacionar a sessão bloqueada aos bloqueadores.

### Escolha o lock necessário

O PostgreSQL também oferece `FOR NO KEY UPDATE`, `FOR SHARE` e `FOR KEY SHARE`, com conflitos diferentes. `FOR UPDATE` é o modo de lock de linha mais forte. Use-o quando a operação realmente precisa impedir alterações concorrentes incompatíveis sobre as linhas selecionadas, não como padrão em toda consulta.

## Quando usar `FOR UPDATE`

Ele faz sentido quando:

- a aplicação lê uma linha, toma uma decisão e depois a altera;
- outra transação não pode tomar a mesma decisão sobre o estado antigo;
- todos os passos podem permanecer em uma transação curta;
- a aplicação conhece e trata espera, timeout e retry.

Ele não é uma boa resposta quando:

- basta um único `UPDATE` condicional;
- a transação ficará aberta durante interação externa demorada;
- o objetivo é somente consultar dados;
- a aplicação não possui estratégia para falhas e deadlocks;
- as linhas são bloqueadas sem ordem previsível ou em quantidade desnecessária.

## Exercício

Adicione uma segunda conta com saldo de `150.00` e simule duas transferências que precisam bloquear as contas de origem e destino.

Primeiro, faça as sessões adquirirem os locks em ordens opostas e observe o deadlock. Depois, altere ambas para bloquear as contas por `conta_id` crescente antes de atualizar os saldos.

O resultado esperado é perceber que a ordem de aquisição dos locks faz parte do contrato de concorrência da aplicação.

## Validação realizada

Os exemplos foram executados em **10/10/2026** no **PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1)**, em duas sessões `psql`. Foram confirmados:

- a espera da segunda sessão pelo lock adquirido com `FOR UPDATE`;
- o retorno do saldo atualizado após o `COMMIT` da primeira sessão;
- a falha imediata de `FOR UPDATE NOWAIT` quando a linha já estava bloqueada;
- a reavaliação do `UPDATE` condicional após uma alteração concorrente, sem reservar saldo insuficiente.

## Conclusão

`SELECT ... FOR UPDATE` conecta uma leitura a uma decisão transacional. No exemplo, ele impede que dois workers aprovem reservas com base no mesmo saldo inicial: a segunda sessão espera e reavalia a linha depois da confirmação da primeira.

O lock, porém, só existe até o fim da transação e não substitui constraints, comandos atômicos nem tratamento de falhas. A solução confiável combina transações curtas, invariantes protegidas no banco e um comportamento explícito para espera e retry.

Antes de adicionar um lock, vale fazer duas perguntas:

1. Esta decisão realmente depende de impedir uma alteração concorrente?
2. A mesma regra poderia ser expressa em um único comando atômico?

## Referências

- [PostgreSQL 16 — Explicit Locking](https://www.postgresql.org/docs/16/explicit-locking.html)
- [PostgreSQL 16 — SELECT: cláusulas de locking](https://www.postgresql.org/docs/16/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [PostgreSQL 16 — Transaction Isolation](https://www.postgresql.org/docs/16/transaction-iso.html)
- [PostgreSQL 16 — pg_locks](https://www.postgresql.org/docs/16/view-pg-locks.html)
