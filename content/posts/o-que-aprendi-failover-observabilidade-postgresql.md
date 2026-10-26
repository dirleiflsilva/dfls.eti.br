---
title: "O que aprendi levando um laboratório PostgreSQL até failover e observabilidade"
date: 2026-10-26
draft: false
toc: true
slug: "o-que-aprendi-failover-observabilidade-postgresql"
description: "Aprendizados dos Labs 04 a 06 do PostgreSQL Reliability Lab sobre replicação, failover, observabilidade, validação e limites de um ambiente local."
tags:
  - postgresql
  - dbre
  - replicação
  - failover
  - observabilidade
  - laboratórios
  - aprendizado
topics:
  - PostgreSQL e SQL
  - DevOps e Confiabilidade
  - Carreira e Aprendizado
---

Nos três primeiros labs do PostgreSQL Reliability Lab, o desafio principal era construir um ambiente reproduzível, inicializar uma base coerente e provar que backups podiam ser restaurados.

Nos três seguintes, a pergunta mudou. Já não bastava reconstruir um estado conhecido depois de uma falha. Era preciso manter outra cópia do banco, coordenar a troca de liderança e reunir sinais para explicar o comportamento do ambiente.

Essa evolução adicionou PostgreSQL em streaming replication, Patroni, etcd, HAProxy, Prometheus, Grafana e Loki. Mas o aprendizado mais importante não foi acumular ferramentas. Foi perceber que replicação, failover e observabilidade resolvem problemas diferentes — e que cada camada precisa de uma evidência própria.

Neste artigo, reúno os aprendizados dos **Labs 04 a 06** e fecho o primeiro ciclo do projeto, iniciado com a fundação do ambiente e levado até um cluster local com recuperação coordenada e telemetria validada.

## A arquitetura cresceu porque as perguntas cresceram

Cada lab partiu de uma pergunta operacional mais exigente:

| Etapa | Pergunta central | Evidência procurada |
|---|---|---|
| Lab 04 — Replicação | Uma escrita no primário chega à réplica e o fluxo retoma após uma interrupção? | Estado de streaming, posição de WAL e dado consultável no standby |
| Lab 05 — Failover | A escrita continua por um endpoint estável depois da queda do líder? | Novo líder, retomada da escrita e reintegração do nó antigo |
| Lab 06 — Observabilidade | É possível observar e investigar o estado do cluster? | Métricas, logs, regras e um sinal rastreado ponta a ponta |

O [Lab 04](/posts/postgresql-reliability-lab-lab-04-streaming-replication/) tinha dois nós PostgreSQL e um mecanismo de replicação física. O [Lab 05](/posts/postgresql-reliability-lab-lab-05-failover-automatico/) acrescentou coordenação distribuída e roteamento. O [Lab 06](/posts/postgresql-reliability-lab-lab-06-observabilidade/) adicionou coleta, armazenamento e visualização de sinais.

O aumento do número de componentes não era o objetivo. Ele foi consequência das novas responsabilidades. Essa distinção ajuda a evitar arquiteturas em que ferramentas são adicionadas antes de existir uma pergunta que justifique sua presença.

## Replicação não decide quem deve receber escrita

No Lab 04, a réplica acompanha o primário por streaming e aceita consultas em modo somente leitura. O cenário valida a propagação de uma escrita, a rejeição de escrita no standby e a retomada do fluxo depois de uma interrupção.

Isso demonstra que existe outra cópia dos dados acompanhando o servidor principal. Não demonstra que uma aplicação saberá para onde enviar a próxima escrita se o primário desaparecer.

Essa separação ficou mais clara ao avançar para o Lab 05:

- a replicação transporta alterações entre os nós;
- o Patroni gerencia o papel de cada membro;
- o etcd mantém o estado usado na coordenação da liderança;
- o HAProxy oferece um endpoint estável e encaminha a escrita ao líder atual.

Sem coordenação, dois servidores não formam automaticamente um serviço de alta disponibilidade. Ainda é necessário decidir quem pode aceitar escrita, evitar lideranças conflitantes e atualizar o caminho usado pelo cliente.

O aprendizado foi tratar **cópia, eleição e roteamento como responsabilidades independentes**. Elas participam do mesmo cenário de disponibilidade, mas falham de formas diferentes e exigem verificações diferentes.

## Failover é um intervalo, não um instante

É comum resumir um failover à promoção da réplica. Para o cliente, porém, a experiência começa quando a conexão deixa de funcionar e termina somente quando uma nova operação pode ser concluída.

No roteiro do Lab 05, a queda do líder inicia uma sequência:

```text
falha do líder
    ↓
detecção da indisponibilidade
    ↓
eleição e promoção da réplica
    ↓
atualização do roteamento
    ↓
nova conexão e retomada da escrita
```

As execuções observadas levaram de 19 a 24 segundos para retomar a escrita. Esse número não é uma promessa de disponibilidade nem um valor transportável para produção. Ele é o resultado de uma topologia local, das configurações usadas e do critério adotado pelo teste.

Ainda assim, medir o intervalo tornou o experimento mais útil. Dizer apenas que o failover foi automático esconderia a janela em que o serviço esteve indisponível.

Também ficou evidente que uma conexão perdida deixa incerteza sobre a última operação. A aplicação precisa saber se pode repetir uma escrita com segurança. Alta disponibilidade no banco não elimina a necessidade de timeouts, retentativas controladas e idempotência na camada cliente.

## O retorno de um nó exige reconciliação

Depois da promoção, o antigo líder não pode simplesmente voltar ao cluster mantendo seu histórico anterior. Enquanto esteve isolado, a linha temporal do novo líder avançou.

No laboratório, o `pg_rewind` permite alinhar o nó antigo ao estado do líder atual antes de reintegrá-lo como réplica. Essa etapa mostrou que recuperar a capacidade do cluster não encerra o incidente: ainda existe trabalho para restaurar a redundância.

Por isso, o teste de failover não termina na primeira escrita bem-sucedida. Ele também verifica:

1. qual nó assumiu a liderança;
2. se o endpoint voltou a aceitar escrita;
3. se o antigo líder retornou como réplica;
4. se os dados voltaram a convergir entre os membros.

O critério de sucesso precisa acompanhar todo o ciclo estudado. Se o objetivo inclui reintegração, parar a validação na promoção produz uma evidência incompleta.

## Observabilidade precisa acompanhar uma pergunta

Ao chegar ao Lab 06, era possível verificar a topologia por comandos e APIs. Faltava uma camada que ajudasse a perceber mudanças e investigar o que aconteceu ao longo do tempo.

O ambiente passou a coletar métricas dos dois nós PostgreSQL e do Patroni, armazenar logs estruturados e provisionar um dashboard e regras de alerta. Mesmo assim, a quantidade de gráficos não foi usada como critério de conclusão.

As métricas foram escolhidas para responder perguntas como:

- os exporters e membros estão acessíveis?
- existe exatamente um líder observado?
- quantas conexões cada nó possui?
- qual é a diferença de WAL entre os membros?
- uma condição anormal permaneceu tempo suficiente para acionar uma regra?

Os logs cobrem outro tipo de investigação: qual evento ocorreu, em qual nó e com qual contexto. Métricas ajudam a identificar uma mudança; logs podem ajudar a explicar eventos relacionados a ela.

O aprendizado aqui foi começar pela pergunta operacional e depois selecionar o sinal. Um dashboard visualmente completo pode continuar inútil se não houver uma decisão ou investigação associada aos painéis.

## Um sinal sintético pode validar o caminho inteiro

Verificar que Prometheus, Loki e Grafana estão em execução não prova que os dados chegaram até eles. Um container saudável pode estar configurado com o alvo errado, sem permissão ou sem receber eventos.

Para testar a cadeia de logs, o Lab 06 cria um token único dentro de uma consulta deliberadamente lenta e depois procura esse mesmo token pela API do Loki:

```text
consulta identificável
    ↓
log JSON do PostgreSQL
    ↓
coleta pelo Promtail
    ↓
ingestão no Loki
    ↓
consulta do token
```

Esse padrão foi um dos aprendizados mais reutilizáveis do projeto. Em vez de validar componentes isolados, o teste cria uma entrada conhecida e procura seu efeito no destino final.

A mesma ideia já aparecia em outras etapas: inserir uma linha para confirmar a replicação, registrar uma referência antes do incidente para validar o PITR e executar uma escrita pelo mesmo endpoint após o failover. Em todos os casos, uma evidência identificável conecta a ação ao resultado esperado.

## Automação não substitui interpretação

Os scripts reduzem o trabalho manual e tornam as execuções comparáveis. Eles também podem produzir uma falsa sensação de certeza se o alcance de cada verificação não estiver documentado.

No Lab 06, por exemplo, o roteiro confirma que as regras foram carregadas. Isso não comprova que uma notificação chegou a alguém, porque o ambiente não inclui Alertmanager. Encontrar um log no Loki comprova o caminho básico de ingestão, não a retenção de longo prazo. Observar um líder confirma o estado naquele instante, não a ausência futura de split-brain em qualquer cenário de rede.

Passei a enxergar a validação em três partes:

1. **ação:** o evento controlado produzido pelo teste;
2. **evidência:** o estado ou sinal consultado depois da ação;
3. **limite:** o que essa evidência não permite concluir.

Registrar o limite não enfraquece o laboratório. Ele impede que um teste local seja apresentado como garantia maior do que realmente é.

## Disponibilidade, recuperação e visibilidade são camadas diferentes

Ao olhar para os seis labs em conjunto, três conceitos que costumam aparecer próximos ficam mais fáceis de separar:

- **recuperação:** voltar a um estado utilizável a partir de backups e WAL;
- **disponibilidade:** manter ou restaurar o serviço por meio de réplica, eleição e roteamento;
- **observabilidade:** produzir sinais que permitam perceber e investigar o comportamento do sistema.

Uma camada não substitui a outra. Replicação pode copiar uma exclusão acidental. Failover pode promover um nó com o mesmo erro lógico. Um dashboard pode continuar verde enquanto uma regra importante não foi definida. Backup pode estar disponível e ainda falhar no restore.

Confiabilidade surge da combinação dessas capacidades com critérios explícitos de operação. O laboratório tornou essa ideia concreta porque cada etapa exigiu uma falha, uma ação e uma evidência diferentes.

## O que o ambiente local ainda não demonstra

O projeto é um laboratório em Docker Compose executado em um único host. Essa escolha favorece estudo, repetição e inspeção, mas mantém limites importantes:

- os nós não estão distribuídos entre hosts ou zonas de falha;
- HAProxy, Prometheus, Loki e Grafana são instâncias únicas;
- o cenário não implementa fencing para partições de rede;
- não há TLS e gestão completa de segredos entre os componentes;
- alertas são avaliados, mas não existe fluxo de notificação e resposta;
- carga prolongada, retenção e capacidade não foram dimensionadas;
- os testes não representam um SLO de produção.

Esses limites apontam próximos experimentos possíveis. Eles não precisam ser escondidos nem resolvidos todos de uma vez. Precisam estar claros para que o leitor saiba qual pergunta o projeto responde hoje.

## Fechando o primeiro ciclo

O [PostgreSQL Reliability Lab](/projects/postgresql-reliability-lab/) começou com uma instância reproduzível e avançou por inicialização, backup, PITR, replicação, failover e observabilidade.

O fio que conecta as seis etapas não é uma ferramenta específica. É a tentativa de transformar afirmações amplas em comportamentos verificáveis:

- não apenas ter um backup, mas restaurá-lo;
- não apenas configurar uma réplica, mas interromper e retomar o fluxo;
- não apenas promover outro nó, mas recuperar a escrita e reintegrar o anterior;
- não apenas exibir dashboards, mas rastrear um sinal conhecido até a consulta.

Se eu tivesse de resumir o aprendizado deste ciclo, seria este: **um sistema confiável não é definido pelo desenho da arquitetura, mas pelas situações que conseguimos exercitar, observar e explicar dentro dos limites declarados**.

O repositório continuará evoluindo para novos cenários, como performance e pipeline de dados. A base para essas próximas etapas está menos nas ferramentas já instaladas e mais no método consolidado: formular a pergunta, provocar o comportamento, guardar a evidência e registrar até onde a conclusão alcança.

## Continue explorando

- [PostgreSQL Reliability Lab: projeto, código e estado atual](/projects/postgresql-reliability-lab/)
- [O que aprendi estruturando um laboratório PostgreSQL reproduzível](/posts/o-que-aprendi-laboratorio-postgresql-reproduzivel/)
- [Lab 04: Streaming Replication no PostgreSQL](/posts/postgresql-reliability-lab-lab-04-streaming-replication/)
- [Lab 05: Failover automático com Patroni, etcd e HAProxy](/posts/postgresql-reliability-lab-lab-05-failover-automatico/)
- [Lab 06: Observabilidade com Prometheus, Grafana e Loki](/posts/postgresql-reliability-lab-lab-06-observabilidade/)
