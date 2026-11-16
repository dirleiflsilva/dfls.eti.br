---
title: "Automatizando PostgreSQL com Python: uma rotina prática do laboratório"
date: 2026-11-16
draft: false
toc: true
description: "Como usar Python para gerar relatórios de performance do PostgreSQL, calcular p95 e validar deltas de contadores com evidências do laboratório."
tags:
  - postgresql
  - python
  - automacao
  - performance
  - testes
topics:
  - PostgreSQL e SQL
  - Engenharia de Software
  - DevOps e Confiabilidade
---

Depois de executar um experimento de performance, ainda existe uma tarefa que parece pequena: reunir os resultados.

Um arquivo contém os planos de execução. Outro registra as latências do cliente. Há snapshots de estatísticas antes e depois, parâmetros da carga e informações sobre o ambiente. Copiar alguns números para uma tabela resolve a apresentação imediata, mas deixa perguntas: usei a mesma regra de cálculo nas duas fases? Os contadores foram reiniciados durante a medição? Consigo reconstruir o relatório amanhã?

No [Lab 07 do PostgreSQL Reliability Lab](/posts/postgresql-reliability-lab-lab-07-performance/), essa etapa virou uma rotina em Python. O benchmark coleta as evidências e um script separado produz o relatório Markdown a partir dos arquivos preservados.

Neste artigo, mostro como essa rotina lê as evidências, calcula mediana e p95, verifica a continuidade dos contadores e gera Markdown. O objetivo é **transformar medições em um relatório que possa ser reconstruído e conferido**.

## A rotina escolhida

O laboratório compara consultas e índices em uma base sintética de clientes e pedidos. A execução combina SQL, `EXPLAIN ANALYZE`, `pg_stat_statements` e `pgbench`.

A divisão de responsabilidades está em três arquivos:

| Arquivo | Responsabilidade |
|---|---|
| `scripts/benchmark.sh` | Entrada em Bash para executar o benchmark |
| `scripts/lab.py` | Coordenar comandos, consultas, verificações e coleta de evidências |
| `scripts/report.py` | Ler os arquivos coletados, calcular resumos e escrever o relatório |

O Python do host utiliza somente a biblioteca padrão. A comunicação com o banco durante o benchmark passa pelo `psql` no container cliente, acionado pelo Docker Compose. Não há um driver Python de PostgreSQL nessa implementação.

Essa escolha aproveita as ferramentas que o laboratório já utiliza. O Python organiza o fluxo e trabalha com os dados estruturados produzidos por elas.

O código apresentado está na [implementação do Lab 07, na revisão `5fd5efb`](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/5fd5efb/labs/07-performance), que também contém o registro da validação inicial. Os links e comandos deste artigo usam essa revisão para manter a correspondência entre texto e código.

## Coletar e apresentar em etapas separadas

O benchmark cria um diretório próprio em `evidence/runs/`. Entre os arquivos preservados estão:

```text
evidence/runs/<execucao>_benchmark/
├── metadata.json
├── results.json
├── daily_baseline_1.before.json
├── daily_baseline_1.after.json
├── daily_baseline_1.delta.json
└── report.md
```

Essa árvore é um recorte: a execução também guarda consultas, planos completos, logs por transação e outros arquivos de contexto.

O `metadata.json` identifica perfil, quantidade de pedidos, líder, parâmetros e horários. O `results.json` reúne planos e medições do cliente por cenário, fase e rodada. Cada cenário compara uma fase de referência (`baseline`) com uma alternativa (`optimized`). Os arquivos `before` e `after` permitem calcular as diferenças dos contadores na janela observada.

Ao concluir o benchmark, o orquestrador chama o gerador de relatório. Também é possível executá-lo depois, sem consultar novamente o banco:

```bash
python3 scripts/report.py evidence/runs/<diretorio-do-benchmark>
```

O comando deve ser executado a partir de `labs/07-performance`, substituindo o caminho pelo diretório de um benchmark concluído. Ele reescreve `report.md` e os arquivos de delta correspondentes, preservando as entradas usadas no cálculo.

Isso permite revisar a apresentação dos resultados sem repetir toda a carga. Para reconstruir a saída histórica com as mesmas regras, é preciso preservar também a versão do script.

## Um resumo pequeno, com uma regra explícita

Uma das funções centrais do relatório recebe uma coleção de valores e devolve mediana, p95, desvio padrão populacional e quantidade de amostras.

O trecho abaixo mantém a lógica da implementação, com a expressão de retorno dividida para facilitar a leitura:

```python
import math
import statistics


def summary(values):
    values = sorted(values)
    return (
        f'{statistics.median(values):.3f} / '
        f'{values[math.ceil(len(values) * .95) - 1]:.3f} / '
        f'{statistics.pstdev(values):.3f} (n={len(values)})'
    )
```

O p95 usa o método *nearest-rank*: ordena os valores, calcula a posição `ceil(n × 0,95)` e ajusta o índice porque as listas começam em zero.

Para conferir o cálculo sem banco ou containers, acrescente esta chamada ao exemplo:

```python
print(summary(range(1, 101)))
```

A saída segue a ordem `mediana / p95 / desvio padrão (n=amostras)`:

```text
50.500 / 95.000 / 28.866 (n=100)
```

O p95 é 95: pelo menos 95% dos valores desse conjunto são menores ou iguais a ele. Usar sempre o maior valor produziria outro indicador. Com poucas amostras, esse método pode selecionar o máximo; por isso, o tamanho do conjunto acompanha o resumo. Os valores mantêm a unidade de entrada: quando as amostras estão em milissegundos, as três estatísticas também estão.

A mediana e o desvio padrão populacional vêm do módulo [`statistics` da biblioteca padrão](https://docs.python.org/3/library/statistics.html). O script usa `pstdev`, que descreve a dispersão do conjunto recebido.

Há uma condição nessa função: a coleção precisa conter valores numéricos válidos e não pode estar vazia. O fluxo do laboratório verifica a presença de amostras do `pgbench` durante a coleta, mas o gerador de relatório não implementa uma validação completa para entradas arbitrárias.

## O significado do número acompanha a origem

O relatório apresenta separadamente tempos de execução do servidor e latências do cliente. TPS significa transações por segundo.

| Origem | O que entra no resumo |
|---|---|
| Planos JSON de `EXPLAIN ANALYZE` | Campo `Execution Time` de cada plano coletado |
| Logs por transação do `pgbench` | Amostras de latência do cliente, convertidas para milissegundos |
| Snapshots de `pg_stat_statements` | Diferenças de contadores entre o início e o fim da janela |

O `EXPLAIN ANALYZE` executa a consulta e acrescenta instrumentação. Essa medição precisa ser interpretada com esse custo, conforme a [documentação de EXPLAIN do PostgreSQL 16](https://www.postgresql.org/docs/16/using-explain.html). Já as latências do cliente incluem a comunicação com o servidor.

Os planos de todas as rodadas de um mesmo cenário e fase são reunidos para calcular o resumo do servidor. Na tabela do cliente, as latências também são reunidas entre rodadas, mas cada quantidade de clientes permanece em um grupo separado. Assim, as amostras de um cliente não são misturadas às de quatro clientes.

O TPS exibido nessa tabela é a média aritmética dos valores por rodada. Já o p95 é calculado sobre as latências individuais reunidas, e não pela média dos percentis de cada rodada. São regras específicas desta implementação, que precisam acompanhar a leitura dos resultados.

O p95 vem das amostras individuais preservadas. Os contadores agregados do `pg_stat_statements` não permitem reconstruir essa distribuição de latências.

## Subtrair contadores exige conferir a janela

Suponha que uma consulta tenha 100 chamadas no início e 140 no final. A diferença sugere 40 chamadas durante a janela.

Essa conta depende da continuidade do contador. Um reset ou a remoção de entradas por falta de espaço pode quebrar a comparação. A extensão expõe `stats_reset` e `dealloc` em `pg_stat_statements_info`, como detalha a [documentação do PostgreSQL 16](https://www.postgresql.org/docs/16/pgstatstatements.html).

No script, a função `deltas` começa verificando o bloco `reset` dos snapshots:

```python
def deltas(before, after):
    if before['reset'] != after['reset']:
        return {
            'valid': False,
            'reason': 'stats_reset ou dealloc mudou durante a janela',
        }
```

Esse é o início da função real. O restante associa as entradas por `userid`, `dbid` e `queryid`, calcula diferenças de chamadas, tempo total e buffers, e invalida a janela se algum desses contadores diminuir.

Uma consulta que aparece somente no snapshot final usa zero como base. Quando há chamadas no intervalo, o delta inclui também o texto representativo da consulta.

O retorno distingue uma janela válida de uma inválida. Por exemplo, quando há mudança no bloco de reset:

```json
{
  "valid": false,
  "reason": "stats_reset ou dealloc mudou durante a janela"
}
```

Essa informação fica no arquivo `.delta.json`. **Na implementação publicada, uma janela inválida não interrompe a geração do Markdown nem ganha um aviso destacado nas tabelas principais.** É necessário conferir os deltas antes de usar essas diferenças na análise. Levar esse estado ao relatório principal é uma melhoria possível.

Também há um limite de identificação: o script usa uma chave de três campos. A extensão distingue ainda `toplevel`. Uma adaptação para coleta que misture comandos de nível superior e comandos aninhados precisa considerar esse campo.

Os snapshots incluem atividade de monitoramento. Mesmo quando o delta é válido, ele não representa exclusivamente as consultas do experimento.

## Como reproduzir

Para obter o código do laboratório em um diretório novo:

```bash
git clone https://github.com/dirleiflsilva/postgresql-reliability-lab.git
cd postgresql-reliability-lab
git checkout --detach 5fd5efb
cd labs/07-performance
```

Os testes do cálculo podem ser executados sem subir os containers:

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Para produzir suas próprias evidências, siga a preparação do ambiente no [README do Lab 07](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/README.md). O fluxo completo exige Linux, Python 3, Bash, Docker Compose e recursos para os 13 containers. Inclui configurar o `.env`, subir a stack, verificar o ambiente e gerar a massa explicitamente.

Com o lab preparado e os dados carregados, a execução curta documentada é:

```bash
bash scripts/benchmark.sh \
  --seconds 3 --warmup-seconds 2 --rounds 2 --clients 1 4 --writes
```

Esse comando executa consultas, aplica e remove índices experimentais e, com `--writes`, cria duas cópias de teste para medir atualizações. Ele pertence ao ambiente isolado do laboratório. A execução curta verifica o fluxo; não estabelece capacidade sustentada.

O caminho do relatório aparece ao final. Para reconstruí-lo depois, use `scripts/report.py` com o diretório gerado. Os artefatos completos de execução são locais e ignorados pelo Git; um clone contém o código e a evidência curada, mas não os arquivos brutos necessários para reconstruir o relatório histórico.

## O que foi validado

O [registro publicado de 02/11/2026](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/evidence/validation.md) documenta o fluxo integrado com PostgreSQL 16.15, 10 mil clientes e 100 mil pedidos. Naquela execução, os 16 deltas foram considerados válidos.

Na revisão deste artigo, em 16/11/2026, os cinco testes existentes foram executados novamente com os scripts da revisão `5fd5efb`. O relatório também foi reconstruído usando uma cópia isolada dos arquivos locais daquela execução. O Markdown produzido foi idêntico, byte a byte, ao relatório preservado, e os 16 deltas continuaram válidos. Essa conferência reutilizou as medições existentes; não houve nova execução do benchmark no PostgreSQL.

Os testes cobrem p95 por nearest-rank, reset de estatísticas, diferenças de contadores, consulta nova, contador decrescente e leitura de JSON distribuído em várias linhas. São verificações pequenas, voltadas a erros que poderiam produzir uma análise incorreta sem uma falha evidente do processo.

O script ainda assume a estrutura esperada dos arquivos e mantém as amostras em memória. Diretórios incompletos podem causar erro ou permitir apenas uma saída parcial; a ausência de `finished_utc` identifica uma execução incompleta, mas não impede automaticamente a tentativa de gerar o relatório.

## O aprendizado da automação

Essa rotina resolveu uma etapa concreta do laboratório: aplicar as mesmas regras de cálculo a várias fases e manter o caminho dos números até os arquivos de origem.

A utilidade do Python aparece na combinação de leitura de JSON, organização de coleções, cálculo e geração de texto. A qualidade da análise depende também de preservar o contexto: origem da amostra, unidade, quantidade de observações e continuidade dos contadores.

Para evoluir o script, eu começaria por destacar deltas inválidos no Markdown e recusar explicitamente entradas incompletas antes de reescrever o relatório. São melhorias ligadas ao uso real da ferramenta: tornar mais difícil interpretar uma execução interrompida como um experimento concluído.

## Referências

- [Lab 07: implementação](https://github.com/dirleiflsilva/postgresql-reliability-lab/tree/5fd5efb/labs/07-performance)
- [Gerador de relatório em Python](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/scripts/report.py)
- [Testes das métricas e da leitura de JSON](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/scripts/test_report.py)
- [Validação integrada de 02/11/2026](https://github.com/dirleiflsilva/postgresql-reliability-lab/blob/5fd5efb/labs/07-performance/evidence/validation.md)
- [PostgreSQL 16: pgbench](https://www.postgresql.org/docs/16/pgbench.html)
