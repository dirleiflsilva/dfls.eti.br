---
title: "PostgreSQL Reliability Lab - Lab 05: Failover automático com Patroni, etcd e HAProxy"
date: 2026-10-05
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-05-failover-automatico"
description: "Implementando e validando failover automático no PostgreSQL com Patroni, etcd e HAProxy, incluindo promoção, retomada da escrita e reintegração do antigo líder."
tags:
  - postgresql
  - failover
  - alta-disponibilidade
  - patroni
  - etcd
  - haproxy
  - dbre
  - docker
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
series:
  - PostgreSQL Reliability Lab
series_order: 5
---

No [Lab 04 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-04-streaming-replication/), construí uma réplica física por streaming e validei que ela recebia as alterações do servidor principal. Ainda faltava responder à pergunta mais importante diante de uma falha:

> Quem decide que a réplica deve assumir, como os clientes encontram o novo servidor de escrita e o que acontece quando o antigo servidor retorna?

O [Lab 05 já está disponível no GitHub](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/488cc77/labs/05-failover). Ele evolui o cenário anterior para um cluster local com PostgreSQL 16, Patroni, etcd e HAProxy. O roteiro interrompe abruptamente o líder, aguarda a promoção automática, volta a escrever pelo mesmo endereço e reintegra o antigo líder como réplica.

Três execuções controladas concluíram esse ciclo com retomada da escrita entre **19 e 24 segundos**. Esses números descrevem o ambiente local do experimento. Não são um SLA nem uma promessa de tempo de recuperação para outras arquiteturas.

## Replicação não é failover

Uma réplica atualizada é parte da solução, mas não resolve sozinha a troca de papéis.

No Lab 04, se o primary parasse, a réplica continuaria com os dados que já havia recebido, mas permaneceria em recovery. Não existia um componente responsável por detectar a falha, escolher um novo líder e direcionar as conexões de escrita para ele.

O Lab 05 acrescenta três responsabilidades:

1. **Patroni:** gerencia cada instância PostgreSQL e coordena quem pode ocupar o papel de líder.
2. **etcd:** mantém o estado distribuído usado na eleição e na renovação da liderança.
3. **HAProxy:** oferece um endereço estável aos clientes e encaminha novas conexões ao nó que o Patroni identifica como primary.

O PostgreSQL continua responsável pelo banco e pela replicação física. O Patroni coordena o ciclo de vida dos membros. O etcd fornece o consenso necessário à liderança. O HAProxy encaminha as conexões.

## Arquitetura do laboratório

O ambiente possui sete containers:

| Serviço | Quantidade | Responsabilidade |
|---|---:|---|
| PostgreSQL + Patroni | 2 | Um líder e uma réplica, com papéis intercambiáveis |
| etcd | 3 | Quorum para armazenar o estado do cluster |
| HAProxy | 1 | Endpoint estável de escrita |
| Cliente | 1 | Execução de `psql`, verificações e demonstração |

O endpoint publicado no host é `127.0.0.1:5439`. As APIs administrativas do Patroni e os membros etcd permanecem apenas na rede interna do Docker Compose.

```text
cliente → HAProxy :5439 → líder PostgreSQL
                           ↕ streaming replication
                         réplica PostgreSQL

             Patroni ↔ etcd1 + etcd2 + etcd3
```

Os nomes `pg1` e `pg2` identificam membros, não papéis permanentes. A replicação é **assíncrona**: o commit pode ser confirmado no líder antes de o WAL correspondente chegar à réplica. O failover melhora a disponibilidade, mas não transforma automaticamente o RPO em zero.

## Subindo o ambiente

Com Docker Compose e Bash disponíveis:

```bash
git clone https://github.com/dirleiflsilva/postgresql-reliability-lab.git
cd postgresql-reliability-lab/labs/05-failover
cp .env.example .env
```

Substitua no `.env` as três senhas de exemplo. Em seguida:

```bash
docker compose build
docker compose up -d --wait --wait-timeout 240
bash scripts/check.sh
bash scripts/status.sh
```

O registro publicado foi validado com PostgreSQL 16.15, Patroni 4.1.0, etcd 3.5.21 e HAProxy 3.0.28. Tags e dependências podem receber atualizações, portanto o build não pretende ser idêntico byte a byte ao ambiente original.

O `check.sh` valida:

- exatamente um líder e uma réplica;
- réplica em recovery e rejeição de escrita com SQLSTATE `25006`;
- streaming assíncrono ativo;
- estrutura, proprietários, privilégios e dados da base de e-commerce;
- propagação de uma sentinela entre os membros;
- roteamento do HAProxy para o líder;
- saúde dos três membros etcd.

Essa distinção segue o princípio discutido em [Healthcheck não é prontidão](/posts/healthcheck-nao-e-prontidao-postgresql-containers/): um endpoint responder não comprova que toda a topologia entrega o comportamento esperado.

## Como o HAProxy encontra o líder

Cada instância Patroni expõe uma API REST interna. O HAProxy consulta o endpoint `/primary` na porta `8008`:

```haproxy
backend primary
    option httpchk GET /primary
    http-check expect status 200
    default-server inter 1s fall 2 rise 1 on-marked-down shutdown-sessions
    server pg1 pg1:5432 check port 8008
    server pg2 pg2:5432 check port 8008
```

Somente o membro que ocupa a liderança responde com status `200` nesse endpoint. Quando os papéis mudam, o HAProxy atualiza o backend elegível sem exigir que a aplicação troque hostname ou porta.

Isso vale para **novas conexões**. Uma sessão aberta no servidor que caiu não migra para o novo líder. Ela falha, e a aplicação precisa se reconectar. Transações interrompidas também precisam ser tratadas conforme a regra de negócio.

## Como a liderança é coordenada

O Patroni usa um cluster etcd com três membros. Com quorum de dois, o conjunto tolera a indisponibilidade de um membro do DCS (Distributed Configuration Store) e ainda pode tomar decisões de liderança.

As configurações principais incluem:

```yaml
ttl: 20
loop_wait: 3
retry_timeout: 3
maximum_lag_on_failover: 1048576
check_timeline: true
```

O `ttl` limita por quanto tempo a liderança permanece válida sem renovação. `loop_wait` define o intervalo do ciclo de controle do Patroni, e `retry_timeout` limita tentativas contra o DCS e o PostgreSQL. Eles influenciam o tempo de detecção, mas não permitem calcular isoladamente um RTO garantido.

O HAProxy ainda precisa perceber a mudança, e o cliente precisa tentar uma nova conexão. Por isso, o roteiro mede o comportamento completo.

`maximum_lag_on_failover` limita a elegibilidade de um candidato com base no atraso observado. O valor de 1 MiB não estabelece um teto exato para perda de commits: o estado usado na decisão também possui seu intervalo de atualização.

## O roteiro de failover

Execute:

```bash
bash scripts/failover_demo.sh
```

Antes da falha, o script executa a validação completa, identifica o líder, grava uma sentinela pelo HAProxy e espera explicitamente que ela seja reproduzida na réplica.

Essa barreira permite verificar a continuidade do exercício, mas significa que a presença da sentinela anterior no novo líder **não comprova RPO zero**.

O líder recebe então um `SIGKILL`. Seu nome é determinado dinamicamente, e o restart automático fica desabilitado para que ele permaneça fora do ar durante a medição.

Sem promoção manual, o script tenta inserir outra sentinela pelo mesmo endpoint. Cada tentativa possui limites de conexão e consulta. Quando a escrita funciona, ele confirma:

- o outro membro tornou-se líder;
- as sentinelas anterior e posterior estão presentes;
- a aplicação voltou a escrever sem trocar o endereço.

Por fim, o antigo líder é iniciado. O roteiro aguarda sua reintegração como réplica, valida o replay das sentinelas e repete os testes funcionais.

## O que aconteceu nas execuções

O [registro de validação](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/488cc77/labs/05-failover/evidence/validation.md) documenta três execuções:

| Execução (UTC) | Líder anterior | Novo líder | Até a escrita confirmada |
|---|---|---|---:|
| 25/09/2026 21:32 | `pg1` | `pg2` | 21 s |
| 25/09/2026 21:33 | `pg2` | `pg1` | 24 s |
| 26/09/2026 11:36 | `pg1` | `pg2` | 19 s |

O tempo começa imediatamente antes da interrupção e termina na primeira escrita confirmada pelo endpoint do HAProxy. Ele inclui o comando Docker, detecção, eleição, promoção, atualização do backend e tentativas de reconexão.

Na primeira execução, os logs registraram `pg_rewind` concluído com código zero. O antigo líder havia divergido na timeline 1; ao retornar, foi ajustado e passou a seguir o novo líder.

A última validação ocorreu depois da remoção e recriação dos cinco volumes. Assim, o teste percorreu bootstrap, carga inicial, backup base, validação e failover partindo de um estado limpo.

## Por que o antigo líder não pode apenas voltar

Depois da promoção, existe uma nova timeline. O antigo líder possui um histórico divergente e não deve voltar aceitando escrita como se nada tivesse ocorrido.

O laboratório habilita checksums, `wal_log_hints` e `use_pg_rewind`. Com os WALs necessários disponíveis, `pg_rewind` ajusta o antigo diretório de dados para que o membro acompanhe o novo líder como réplica.

Se os WALs necessários já não existirem ou o rewind falhar, pode ser preciso reconstruir a réplica a partir de uma nova cópia base. O lab não configura a remoção automática do diretório diante dessa falha.

## O que os 19 a 24 segundos significam

O resultado comprova o mecanismo no cenário testado. Não é RTO contratual.

Um RTO real depende de carga, latência e disponibilidade do DCS, atraso da réplica, healthchecks, comportamento de reconexão, rede, orquestração e validação do novo líder.

Também não foi medido um RPO de zero, pois o script aguardou a reprodução da sentinela anterior. Em replicação assíncrona, escritas confirmadas que ainda não chegaram ao candidato podem ser perdidas.

Disponibilidade, RTO e RPO estão relacionados, mas não são a mesma medida.

## Idempotência depois de uma conexão perdida

O PostgreSQL pode confirmar um commit e a conexão cair antes de a aplicação receber a resposta. Ao reconectar, o cliente não sabe apenas pelo erro se a operação foi persistida.

O roteiro usa chave única e `ON CONFLICT DO NOTHING`, tornando a repetição segura para a sentinela. Em aplicações reais, a estratégia pode envolver chaves de idempotência, reconciliação por identificador de negócio ou consulta do estado antes de repetir.

Failover não elimina essa ambiguidade. Ele exige que a aplicação trate operações cujo resultado ficou desconhecido.

## Limites desta topologia

O laboratório exercita o mecanismo de failover, mas não representa uma arquitetura pronta para produção.

### Um único host e um único HAProxy

Todos os containers executam no mesmo Docker host. Se o host falhar, todo o ambiente fica indisponível. O único HAProxy também permanece como ponto único de falha.

### Sem partição de rede e fencing

O roteiro cobre a queda abrupta do líder. Ele não simula partições, perda de quorum ou um membro isolado ainda acessível a parte dos clientes. Impedir dois servidores graváveis exige decisões explícitas de quorum e fencing.

### Segurança local

etcd e a API do Patroni não usam TLS ou autenticação. Essas portas não são publicadas no host, mas a configuração não deve ser copiada diretamente para produção. As conexões TCP PostgreSQL usam SCRAM; o socket Unix usa `trust` apenas dentro do container.

### Replicação não substitui backup

Uma exclusão ou alteração incorreta pode ser propagada. Os backups e o PITR exercitados no [Lab 03](/posts/postgresql-reliability-lab-lab-03-backup-restore-pitr/) continuam necessários.

## Inspecionando o cluster

```bash
# Membros e papéis
docker compose exec client patronictl -c /etc/patroni.yml list

# Cliente pelo endpoint de escrita
docker compose exec client psql

# Recovery de um membro
docker compose exec pg1 psql -U postgres -d appdb \
  -c 'SELECT pg_is_in_recovery();'

# Eleição, promoção e reintegração
docker compose logs pg1 pg2 haproxy
```

## Da réplica disponível à recuperação coordenada

O Lab 04 mostrou uma réplica recebendo WAL. O Lab 05 acrescenta as decisões necessárias quando o servidor de escrita desaparece.

O experimento confirmou detecção da falha, eleição e promoção automáticas, redirecionamento de novas conexões, retomada da escrita pelo mesmo endpoint e retorno do antigo líder como réplica.

O principal aprendizado não é apenas que o failover ocorreu em menos de meio minuto. É que alta disponibilidade exige coordenação entre banco, consenso, roteamento e aplicação — e que cada camada possui limites que precisam ser testados explicitamente.

## Referências

- [Lab 05: código, roteiro e validação](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/488cc77/labs/05-failover)
- [Patroni: configuração e bootstrap](https://patroni.readthedocs.io/en/latest/yaml_configuration.html)
- [Patroni: healthchecks da API REST](https://patroni.readthedocs.io/en/latest/rest_api.html)
- [Patroni: modos de replicação](https://patroni.readthedocs.io/en/latest/replication_modes.html)
- [PostgreSQL 16: failover](https://www.postgresql.org/docs/16/warm-standby-failover.html)
- [PostgreSQL 16: `pg_rewind`](https://www.postgresql.org/docs/16/app-pgrewind.html)
- [etcd: execução em containers](https://etcd.io/docs/v3.5/op-guide/container/)
