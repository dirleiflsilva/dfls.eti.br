---
title: "YAML inválido, encoding e normalização segura no Protheus OpenAPI"
date: 2026-10-21
draft: false
toc: true
slug: "yaml-invalido-encoding-normalizacao-protheus-openapi"
description: "Como diagnostiquei paths duplicados e Windows-1252 no YAML do REST-DOC e construí uma normalização conservadora, testada e sem alterar o artefato original."
tags:
  - protheus
  - tlpp
  - openapi
  - yaml
  - python
  - testes
topics:
  - Protheus e AdvPL
  - Engenharia de Software
series:
  - Protheus OpenAPI
series_order: 4
---

No artigo anterior, comparei [endpoints equivalentes em TL++ e `WSRESTFUL`](/posts/tlpp-versus-wsrestful-descoberta-openapi/). Os dois responderam corretamente por HTTP, mas apenas a operação TL++ apareceu no YAML produzido pelo REST-DOC no ambiente do laboratório.

Essa não foi a única diferença entre uma exportação concluída e um documento pronto para uso.

O arquivo gerado declarava OpenAPI `3.0.3` e incluía as rotas TL++ esperadas. Ao mesmo tempo, continha chaves de path duplicadas e havia sido gravado em Windows-1252. Aberto diretamente como UTF-8, exibia acentos corrompidos; interpretado como YAML, apresentava conflitos estruturais.

Os dois sintomas tinham causas diferentes. Corrigir o encoding não eliminaria as chaves repetidas. Unir paths sem critérios também poderia esconder operações conflitantes.

Neste recorte do Protheus OpenAPI, o objetivo passou a ser mais específico: **preservar o artefato bruto, reconhecer seu encoding e consolidar somente duplicidades sem ambiguidade**.

O código e as evidências citados estão na [referência `ca22602` do repositório](https://github.com/dirleiflsilva/protheus-openapi/tree/ca2260262f2be39401589139de29f6acf3a066de). O projeto já contém incrementos posteriores; este artigo acompanha a etapa de investigação e normalização do YAML nativo.

## Quando gerar o arquivo não é o fim da validação

O exportador experimental acionava o mecanismo nativo com:

```tlpp
tlpp.doc.generate("swagger", "hello_openapi", {8084}, {"pt-br"})
```

No ambiente testado, o comando produziu `hello_openapi_8084.yaml` em `protheus_data/system`. O documento continha o Hello World em TL++, a rota do próprio exportador e operações de outros módulos disponíveis na porta REST.

O retorno HTTP `200` do acionador comprovava que a chamada havia sido processada. Ele não comprovava, sozinho, que o arquivo resultante era estruturalmente válido.

Essa distinção mudou o critério de conclusão do experimento:

1. acionar a exportação;
2. confirmar que o arquivo foi atualizado;
3. abrir o documento com o encoding correto;
4. inspecionar sua estrutura completa;
5. validar o resultado antes de entregá-lo a outra ferramenta.

Cada passo produz uma evidência diferente. Pular da resposta HTTP diretamente para uma interface como Swagger UI deixaria problemas do artefato sem diagnóstico.

## O que apareceu no YAML real

A inspeção encontrou 232 declarações de path, correspondentes a 226 paths únicos. Cinco paths de módulos padrão apareciam mais de uma vez, com métodos HTTP separados sob a mesma chave.

Um dos paths foi declarado três vezes. Por isso, as cinco chaves repetidas resultaram em seis declarações excedentes e o editor apresentou seis diagnósticos `Map keys must be unique`.

Em uma representação reduzida, o problema se parece com isto:

```yaml
paths:
  /api/items/{id}:
    get:
      summary: Consulta um item

  /api/items/{id}:
    put:
      summary: Atualiza um item
```

Para uma pessoa, é possível perceber que as duas operações parecem pertencer ao mesmo path. Para um consumidor YAML, entretanto, a segunda chave pode substituir a primeira, provocar erro ou ser tratada de outra maneira, dependendo do parser.

As rotas do experimento não causaram as duplicidades. `/api/v1/hello` e `/api/v1/openapi/export` apareciam uma vez cada e continham os metadados esperados. Ainda assim, um problema em outras operações comprometia o documento agregado.

| Medida do artefato bruto | Resultado observado |
|---|---:|
| Declarações de path | 232 |
| Paths únicos | 226 |
| Grupos com duplicidade | 5 |
| Declarações excedentes | 6 |
| Versão declarada | OpenAPI `3.0.3` |
| Encoding | Windows-1252 |

Esses números pertencem ao ambiente e à exportação registrados no laboratório. Eles não devem ser generalizados para todas as versões do Protheus, do AppServer ou do TLPPCore.

## Encoding incorreto e estrutura inválida são problemas diferentes

O arquivo nativo foi gravado em Windows-1252. Quando um editor o interpretava como UTF-8, caracteres acentuados pareciam corrompidos.

Isso é um problema de decodificação: os mesmos bytes estão sendo interpretados segundo outra tabela de caracteres.

A duplicidade dos paths é estrutural. Mesmo depois de ler corretamente todos os acentos, o documento continua contendo a mesma chave YAML mais de uma vez.

Separar os diagnósticos evita duas conclusões erradas:

- converter o arquivo para UTF-8 não corrige paths duplicados;
- consolidar paths não basta se o texto for lido com o encoding errado.

O normalizador precisa lidar com os dois aspectos em uma ordem explícita: primeiro reconhecer o texto de entrada; depois analisar e consolidar a estrutura suportada; por fim gravar uma nova saída em UTF-8 sem BOM.

## Por que preservar o arquivo bruto

O artefato original permaneceu fora do Git, em um diretório local ignorado pelo repositório. Antes e depois da normalização, o laboratório registrou para ele:

| Propriedade | Valor registrado |
|---|---|
| Tamanho | 54.260 bytes |
| Data da exportação | 21/08/2026 15:36:11 |
| SHA-256 | `51998A70AAC61EE782E233033FD2A5A607DCF693F7C0CAF9F4321F9301F3467E` |

O hash permaneceu igual porque o normalizador não edita a entrada. Ele recebe caminhos diferentes para entrada e saída e rejeita a execução quando ambos apontam para o mesmo arquivo.

Essa separação permite comparar o que o REST-DOC realmente produziu com o resultado processado. Também evita transformar uma correção experimental em uma alteração silenciosa da evidência original.

O YAML completo pode conter informações sobre outras APIs do ambiente. Por isso, ele não foi publicado no repositório. As fixtures versionadas reproduzem casos mínimos para teste; não são cópias da exportação real.

## O que significa normalizar com segurança

Unir todo bloco repetido seria simples, mas perigoso. O mesmo path pode aparecer duas vezes por razões compatíveis ou incompatíveis.

Considere primeiro operações diferentes:

```yaml
paths:
  /api/items/{id}:
    get:
      summary: Consulta um item

  /api/items/{id}:
    put:
      summary: Atualiza um item
```

Esse caso pode ser consolidado em um único path, preservando os dois verbos:

```yaml
paths:
  /api/items/{id}:
    get:
      summary: Consulta um item
    put:
      summary: Atualiza um item
```

Agora considere duas operações `get` para o mesmo path:

```yaml
paths:
  /api/items/{id}:
    get:
      summary: Primeira definição

  /api/items/{id}:
    get:
      summary: Segunda definição
```

Escolher uma delas, mesclar seus campos ou manter a última exigiria uma regra que o artefato não fornece. Nesse cenário, o normalizador interrompe a execução e informa o path, o verbo e as linhas conflitantes.

O mesmo princípio vale para campos compartilhados no nível do path, como `parameters`:

- campos idênticos são preservados uma única vez;
- campos incompatíveis causam falha;
- métodos HTTP diferentes podem ser reunidos;
- o mesmo método repetido nunca é escolhido silenciosamente.

A ferramenta não tenta adivinhar a intenção do documento. Na presença de ambiguidade, falhar é mais seguro do que publicar uma especificação aparentemente válida, mas possivelmente incorreta.

## Um utilitário restrito, não um parser YAML completo

O normalizador está em [`scripts/normalize-openapi-paths.py`](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/scripts/normalize-openapi-paths.py). Ele foi construído para a forma do documento observado no laboratório.

O script usa um subparser restrito a pares `chave: valor`, com indentação por espaços e a estrutura esperada da seção raiz `paths`. Ele não deve ser apresentado como um parser YAML de uso geral.

Essa limitação é intencional. O objetivo não era implementar a especificação YAML, mas automatizar de forma testável uma transformação pequena e conhecida, sem adicionar uma dependência externa ao experimento.

Antes de processar os paths, o utilitário verifica condições como:

- arquivo de entrada existente e não vazio;
- entrada e saída diferentes;
- proteção de um destino já existente, salvo quando `--force` é informado;
- ausência de tabulações;
- existência de exatamente uma seção raiz `paths`;
- entrada em UTF-8, com ou sem BOM, ou em CP1252.

Depois da consolidação, a saída é gravada em UTF-8 sem BOM. A escrita ocorre primeiro em um arquivo temporário no diretório de destino e somente depois é substituída com `os.replace()`.

Essa escrita atômica reduz o risco de deixar um documento parcial se a gravação falhar. O arquivo temporário também é removido ao final.

## Executando a normalização

Na versão atual do repositório, os utilitários dessa etapa estão em Python. A partir da raiz do Protheus OpenAPI, o comando é:

```powershell
python scripts/normalize-openapi-paths.py `
  --input "D:\TOTVS12\Protheus12_2510\protheus_data\system\hello_openapi_8084.yaml" `
  --output "artifacts\local\hello-openapi-normalized.yaml" `
  --force
```

O caminho de entrada corresponde ao ambiente do laboratório. Em outra instalação, é necessário localizar o arquivo efetivamente produzido pelo AppServer.

No artefato registrado, o resumo da operação informou:

```text
Normalização concluída. Declarações: 232; Paths únicos: 226; Grupos consolidados: 5; Operações incorporadas: 6.
```

Depois, o documento normalizado pode ser verificado pelo validador do experimento:

```powershell
python scripts/validate-hello-openapi.py `
  --path "artifacts\local\hello-openapi-normalized.yaml"
```

Esse validador confirma o contrato necessário para o Hello World e rejeita chaves de path duplicadas. Ele também tem escopo restrito e não substitui um validador completo da especificação OpenAPI.

## Os testes que sustentam a transformação

A suíte está em [`tests/openapi-normalization/run-tests.py`](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/tests/openapi-normalization/run-tests.py) e pode ser executada sem o AppServer:

```powershell
python tests/openapi-normalization/run-tests.py
```

Os 15 cenários cobrem os caminhos de sucesso e, principalmente, as condições em que o script deve se recusar a produzir uma saída.

| Grupo | Comportamentos verificados |
|---|---|
| Preservação | Mantém path único, seções externas e ordem dos métodos |
| Consolidação | Une duas ou três ocorrências com métodos distintos |
| Campos compartilhados | Deduplica valores idênticos e rejeita conflitos |
| Ambiguidade | Rejeita o mesmo verbo repetido |
| Estrutura | Rejeita ausência ou duplicidade da seção raiz `paths` e tabulações |
| Encoding | Aceita UTF-8 com ou sem BOM e CP1252; produz UTF-8 sem BOM |
| Proteção de arquivos | Rejeita entrada igual à saída e protege destino sem `--force` |
| Escrita | Substitui o destino com `--force`, informa resumo e remove temporários |

Na validação desta etapa, o resultado foi:

```text
Testes aprovados: 15; falhas: 0.
```

As fixtures permitem exercer decisões que seriam difíceis ou arriscadas de testar diretamente no documento do ambiente. Há exemplos mínimos para path único, dois e três métodos, verbo duplicado, campos compartilhados compatíveis e incompatíveis, tabulação e seções `paths` ausentes ou repetidas.

## O que a normalização não resolve

O utilitário reorganiza operações que já existem no YAML. Ele não descobre endpoints e não inventa metadados ausentes.

Por isso, a operação AdvPL baseada em `WSRESTFUL`, que não apareceu na exportação nativa, continua ausente depois da normalização. Acrescentá-la exigiria outra fonte de informação e outra responsabilidade arquitetural.

A ferramenta também não:

- valida todos os requisitos da especificação OpenAPI;
- interpreta qualquer construção válida de YAML;
- modifica o fonte TL++ ou AdvPL;
- altera o arquivo bruto;
- afirma que toda exportação do REST-DOC terá as mesmas duplicidades;
- substitui a inspeção do ambiente e das versões utilizadas.

Esses limites ajudam a manter o resultado verificável. O normalizador resolve apenas o problema para o qual existem regras e testes explícitos.

## Por que esse utilitário não virou o núcleo da biblioteca

Seria possível continuar ampliando o pós-processamento da saída nativa. Isso, porém, faria o projeto herdar o formato, as limitações e os comportamentos específicos do REST-DOC.

O normalizador permaneceu como um utilitário experimental independente. A arquitetura principal do Protheus OpenAPI seguiu outra direção: separar descoberta, modelo intermediário e serialização.

```text
Endpoints TL++ ──> Adaptador TL++ ──┐
                                    │
Endpoints AdvPL ─> Adaptador AdvPL ─┼─> Modelo OpenAPI ─> JSON/YAML
                                    │
Metadados explícitos ───────────────┘
```

Nessa arquitetura, a representação OpenAPI não depende de corrigir um documento agregado já pronto. Os adaptadores coletam informações de cada origem; o modelo aplica suas invariantes; o serializador produz o formato final.

O normalizador ainda tem valor: ele registra um problema real, permite trabalhar com a exportação observada e oferece uma referência para comparar resultados. Mas não precisa carregar responsabilidades que pertencem ao núcleo da biblioteca.

## O aprendizado desta etapa

Um arquivo gerado com sucesso não é necessariamente um artefato válido. A exportação precisa ser tratada como entrada de outro processo de verificação, e não como evidência final apenas porque existe no disco.

Neste experimento, separar encoding, estrutura e descoberta foi essencial:

- Windows-1252 explicava os caracteres exibidos incorretamente;
- paths repetidos explicavam a invalidade estrutural;
- a ausência do `WSRESTFUL` era um problema de descoberta, não de normalização.

Ao preservar o arquivo original, recusar ambiguidades e testar os limites da transformação, o utilitário produz uma saída mais previsível sem esconder o que foi observado no ambiente.

O próximo passo da série deixa o pós-processamento do YAML nativo e entra no desenho de um modelo OpenAPI independente: uma representação que possa receber informações de TL++, AdvPL ou metadados explícitos sem depender da estrutura produzida pelo REST-DOC.

## Referências

- [Diário do experimento Hello World e diagnóstico do YAML](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/docs/experiments/hello-world.md)
- [Normalizador de paths OpenAPI](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/scripts/normalize-openapi-paths.py)
- [Suíte de testes da normalização](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/tests/openapi-normalization/run-tests.py)
- [Validador do contrato Hello World](https://github.com/dirleiflsilva/protheus-openapi/blob/ca2260262f2be39401589139de29f6acf3a066de/scripts/validate-hello-openapi.py)
- [Repositório Protheus OpenAPI](https://github.com/dirleiflsilva/protheus-openapi)
