---
title: "PostgreSQL Reliability Lab - Lab 06: Observabilidade com Prometheus, Grafana e Loki"
date: 2026-10-19
draft: false
toc: true
slug: "postgresql-reliability-lab-lab-06-observabilidade"
description: "Construindo e validando uma camada de observabilidade para PostgreSQL e Patroni com métricas, logs estruturados, dashboards e regras de alerta."
tags:
  - postgresql
  - observabilidade
  - prometheus
  - grafana
  - loki
  - patroni
  - dbre
  - docker
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
series:
  - PostgreSQL Reliability Lab
series_order: 6
---

No [Lab 05 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-05-failover-automatico/), o cluster detectou a queda do líder, promoveu a réplica, retomou a escrita pelo mesmo endpoint e reintegrou o antigo líder. O mecanismo funcionou, mas operar esse ambiente exige responder a outra classe de perguntas:

> O banco está disponível? Quem é o líder? A réplica está atrasada? As conexões estão crescendo? Que erro ocorreu e em qual nó?

O [Lab 06 já está disponível no GitHub](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/594ed7b/labs/06-observability). Ele acrescenta Prometheus, PostgreSQL Exporter, Grafana, Loki e Promtail ao cluster de alta disponibilidade e cria uma cadeia reproduzível de métricas, logs, visualização e regras de alerta.

O objetivo não é apenas subir uma tela com gráficos. O roteiro automatizado verifica se os sinais saem dos nós PostgreSQL, chegam às ferramentas de observabilidade e podem ser consultados com significado operacional.

## Da disponibilidade à explicação

Um healthcheck responde a uma pergunta estreita: determinado processo ou endpoint está acessível agora? Isso é necessário, mas insuficiente para explicar o comportamento de um sistema distribuído.

Neste laboratório, a observabilidade foi dividida em duas fontes complementares:

- **métricas:** mostram estado e evolução numérica, como disponibilidade dos exporters, papel dos membros, conexões, transações e diferença de WAL;
- **logs:** preservam eventos com contexto, como conexões, checkpoints, erros e consultas que ultrapassam um limite de duração.

O Grafana reúne as duas fontes. O Prometheus armazena as séries temporais e avalia regras. O Loki recebe os logs estruturados. Essa combinação permite partir de uma mudança no dashboard e avançar para os eventos relacionados, sem tratar uma tela verde como prova suficiente de confiabilidade.

## Arquitetura do Lab 06

O ambiente executa 13 containers:

| Camada | Serviços | Responsabilidade |
|---|---|---|
| Banco | `pg1` e `pg2` | PostgreSQL 16 gerenciado pelo Patroni |
| Coordenação | `etcd1`, `etcd2` e `etcd3` | Estado distribuído e eleição do líder |
| Roteamento | `haproxy` | Endpoint estável para escrita |
| Coleta de métricas | dois PostgreSQL Exporters | Estatísticas de cada nó PostgreSQL |
| Métricas e regras | Prometheus | Coleta, armazenamento local e avaliação de alertas |
| Coleta de logs | Promtail | Leitura e envio dos logs JSON dos dois nós |
| Logs | Loki | Indexação e consulta dos eventos |
| Visualização | Grafana | Dashboard e consulta das duas fontes |
| Operação | `client` | Execução dos testes e comandos do lab |

O fluxo principal é:

```text
cliente → HAProxy → líder PostgreSQL ↔ réplica PostgreSQL
                         │                    │
                         ├── métricas ────────┼──→ Prometheus ──┐
                         └── logs JSON ───────┴──→ Loki ────────┤
                                                               ↓
                                                            Grafana
```

Os exporters se conectam com a role `monitor_user`, que recebe `pg_monitor`, sem utilizar o superusuário. O Prometheus também consulta diretamente o endpoint `/metrics` de cada membro Patroni.

Somente HAProxy, Grafana, Prometheus e Loki publicam portas no host, sempre em `127.0.0.1`. APIs do Patroni, etcd, exporters e Promtail permanecem na rede interna do Compose.

## Subindo o ambiente

Com Docker Compose e Bash disponíveis:

```bash
git clone https://github.com/dirleiflsilva/postgresql-reliability-lab.git
cd postgresql-reliability-lab/labs/06-observability
cp .env.example .env
```

Substitua no `.env` todas as senhas de exemplo. Em seguida:

```bash
docker compose build
docker compose up -d --wait --wait-timeout 300
bash scripts/check.sh
bash scripts/status.sh
```

O primeiro build requer acesso à internet e o ambiente precisa de recursos para os 13 containers. O registro publicado foi validado com PostgreSQL 16, Patroni 4.1.0, etcd 3.5.21, PostgreSQL Exporter 0.17.1, Prometheus 3.1.0, Grafana 11.4.0 e Loki/Promtail 3.3.2.

Os acessos locais padrão são:

| Serviço | Endereço |
|---|---|
| PostgreSQL para escrita | `127.0.0.1:5440` |
| Grafana | `http://127.0.0.1:3000` |
| Prometheus | `http://127.0.0.1:9090` |
| Loki | `http://127.0.0.1:3100/ready` |

No Grafana, o dashboard **PostgreSQL Reliability — Overview** é provisionado automaticamente dentro da pasta **PostgreSQL Reliability Lab**.

## Métricas do PostgreSQL e do Patroni

Os dois PostgreSQL Exporters expõem estatísticas de cada instância. Isso permite verificar, por exemplo, se ambos estão disponíveis:

```promql
pg_up
```

O endpoint do Patroni complementa essa visão com o papel de cada membro. A consulta abaixo deve apontar exatamente um líder:

```promql
sum(patroni_primary)
```

Para observar atividade na base:

```promql
rate(pg_stat_database_xact_commit{datname="appdb"}[1m])
```

E, para a diferença entre a posição de WAL recebida e reproduzida na réplica:

```promql
clamp_min(
  patroni_xlog_received_location - patroni_xlog_replayed_location,
  0
)
and on(node) (patroni_replica == 1)
```

Essa diferença é expressa em bytes, não em segundos. Ela mostra a distância observada entre recebimento e replay, mas não permite deduzir isoladamente quanto tempo a réplica levará para alcançar o líder.

## Logs estruturados do PostgreSQL

O PostgreSQL foi configurado para gravar em `jsonlog`, com arquivos separados por nó. Entre os eventos habilitados estão conexões, desconexões, checkpoints, esperas por lock e consultas com duração mínima de 250 ms.

O Promtail lê os volumes de log de `pg1` e `pg2`, extrai campos do JSON e adiciona labels como nó, severidade, banco e usuário. No Loki, algumas consultas úteis são:

```logql
{job="postgresql"} | json
```

```logql
{job="postgresql", severity="ERROR"} | json
```

```logql
{job="postgresql"} |= "duration:" | json
```

Labels ajudam a filtrar, mas precisam ser escolhidos com cuidado. Campos com cardinalidade muito alta aumentam o custo do índice. Neste lab, o conteúdo completo continua no evento e somente um conjunto pequeno de dimensões é promovido a label.

## Gerando sinais de forma controlada

Um dashboard vazio pode estar corretamente configurado e ainda assim não demonstrar o caminho de coleta. Por isso, o lab inclui um gerador simples:

```bash
bash scripts/generate_load.sh 60
```

Durante 60 segundos, ele executa agregações sobre pedidos e uma espera de 300 ms. A espera ultrapassa deliberadamente `log_min_duration_statement = 250`, criando eventos previsíveis para consulta no Loki.

O artifício é didático. Em produção, o limite de duração, a amostragem e o conteúdo registrado devem considerar volume, custo e privacidade. Logs de instruções SQL podem conter dados sensíveis.

## Alertas: detectar ainda não é notificar

O Prometheus carrega cinco regras:

- exporter PostgreSQL indisponível;
- membro Patroni indisponível;
- ausência de líder observado;
- mais de 80 conexões em um nó;
- lag de replicação superior a 16 MiB.

As regras possuem uma duração mínima antes de entrar em estado de alerta, reduzindo reações a oscilações muito breves. Por exemplo, a ausência de líder precisa persistir por 15 segundos, enquanto o lag precisa permanecer acima do limite por um minuto.

Esses valores são didáticos. Eles não representam SLOs e não devem ser transportados diretamente para produção. Limites úteis dependem da capacidade, do baseline, do orçamento de erro e do impacto percebido pelos usuários.

O lab também não inclui Alertmanager. Portanto, comprovar que uma regra foi carregada ou entrou em estado *firing* não comprova que uma notificação chegou à pessoa responsável. Detecção, roteamento, entrega e resposta são etapas diferentes.

## A validação ponta a ponta

O `scripts/check.sh` não se limita a conferir se os containers estão em execução. Ele valida:

1. dados, endpoint de escrita e streaming replication;
2. dois exporters PostgreSQL disponíveis no Prometheus;
3. exatamente um líder observado por `patroni_primary`;
4. carregamento das regras de alerta;
5. saúde do Loki e do Grafana;
6. provisionamento do dashboard;
7. ingestão ponta a ponta de um log identificado por token.

Na última etapa, o script cria um token único dentro de uma consulta com `pg_sleep(0.35)`. Depois, procura esse mesmo token pela API do Loki. Assim, o teste percorre:

```text
consulta → PostgreSQL → arquivo JSON → Promtail → Loki → consulta da evidência
```

Cada execução bem-sucedida grava um arquivo local em `evidence/`. O [registro de validação publicado](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/594ed7b/labs/06-observability/evidence/validation.md) documenta a execução de 18/10/2026, que confirmou 100 clientes, 500 pedidos, uma réplica em streaming, os dois exporters, um líder, regras carregadas, dashboard provisionado e o token encontrado no Loki.

Essa evidência demonstra o caminho básico de telemetria no ambiente local. Ela não valida retenção, notificações, carga prolongada nem a disponibilidade das próprias ferramentas de observabilidade.

## Observabilidade também pode falhar

Prometheus, Loki e Grafana executam em instância única e armazenam dados localmente. Se um deles parar, parte da visibilidade desaparece justamente quando pode ser mais necessária.

Também não há TLS nas interfaces do lab. Prometheus e Loki não possuem autenticação, e a senha do usuário de monitoramento aparece na configuração resolvida do Compose. A publicação apenas em loopback reduz a exposição no ambiente local, mas não transforma essa configuração em arquitetura de produção.

Outro limite importante está no agente de logs. O Promtail foi mantido pela simplicidade didática e pela compatibilidade com o cenário, mas está em modo de manutenção de longo prazo no ecossistema Grafana. Uma plataforma nova deve avaliar o Grafana Alloy ou outro agente compatível antes de adotar a mesma escolha.

Por fim, a role `monitor_user` usa `pg_monitor`. Embora não seja superusuária, ela pode acessar estatísticas e informações de atividade que merecem proteção.

## Uma tela verde não encerra a investigação

O Lab 06 acrescenta visibilidade ao cluster do Lab 05: métricas dos dois nós, estado do Patroni, logs estruturados, dashboard provisionado e regras de detecção. Mais importante, acrescenta um teste automatizado que comprova o caminho de um sinal conhecido até sua consulta.

O aprendizado central é que observabilidade não nasce da quantidade de gráficos. Ela depende de sinais que respondam a perguntas operacionais, contexto para investigar mudanças e validação do caminho completo de coleta.

Uma tela verde mostra apenas o que foi medido e entregue naquele instante. Testes de recuperação, alertas exercitados, notificações, runbooks e sinais da aplicação continuam sendo partes separadas da confiabilidade.

## Referências

- [Lab 06: código, roteiro e validação](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/594ed7b/labs/06-observability)
- [PostgreSQL 16: estatísticas de monitoramento](https://www.postgresql.org/docs/16/monitoring-stats.html)
- [PostgreSQL 16: configuração de logs](https://www.postgresql.org/docs/16/runtime-config-logging.html)
- [Prometheus: configuração](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [Prometheus: regras de alerta](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [Grafana: provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Loki: configuração](https://grafana.com/docs/loki/latest/configure/)
