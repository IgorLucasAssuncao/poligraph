# Achado 37 — a votação de 1998 datada de 2015

**Medido em 2026-10-02**, ano a ano de 2001 a 2026, no endpoint `/votacao` do Senado
(`dataInicio`/`dataFim`), e conferido contra a base depois da recarga.

---

## Como apareceu

Ao abrir a navegação por legislatura, o painel da **55ª** (2015–2019) mostrou **203
senadores**. O Senado tem 81 cadeiras, e as outras legislaturas da base ficavam entre 104
e 111, contando suplentes. Na lista daquele período apareciam Ramez Tebet, Antonio Carlos
Magalhães, Jefferson Peres e Abdias Nascimento, que deixou o Senado em 1999 e morreu em
2011, com 15 votos em 2015, todos com partido "Sem registro".

## A causa — da fonte

O `/votacao` devolve, para 2015, **17 votações**, e as 17 são de 1998:

| Campo | Valor do primeiro registro |
|---|---|
| `dataSessao` | **2015-04-01** |
| `ano` (da matéria) | 1998 |
| `informeLegislativo.texto` | "VOTAÇÃO APROVADO (SIM 62, NÃO 01, TOTAL= 63)", de **1998-11-04** |
| `codigoSessaoVotacao` | **1483** |
| Votantes | Ademir Andrade, ACM, Artur da Tavola... senadores de 1998 |

Só a data está errada, e ela é o que a ingestão usa para achar a legislatura. Por isso as
votações caíam na 55ª.

## Como se reconhece — o código anda com o tempo

Desde 2004 o `codigoSessaoVotacao` cresce com a data, sem nenhum código fora da ordem:

| Ano | Menor código | Maior código |
|---|---:|---:|
| 2004 | 2.523 | 3.135 |
| 2014 | 5.243 | 5.329 |
| 2016 (as reais) | 5.560 | 5.601 |
| 2017 | 5.602 em diante | 5.826 |
| 2026 | 7.047 | 7.105 |

Antes de 2004 a numeração é outra: 2003 vai de 21 a 2.503. Assim, **código abaixo de 2.523
com data de 2004 em diante, ou código a partir de 2.523 com data anterior a 2004, é de
outra época**.

| Ano pela data | Votações | Fora de época | Códigos | O que eram |
|---|---:|---:|---|---|
| 2002 | 65 | **6** | 3.344 a 5.293 | Votações de 2005 a 2012: os votantes têm código de senadores dessa época |
| 2015 | 17 | **17** | 1.483 a 1.630 | Votações de 1998 |
| 2016 | 13 | **7** | 947 a 971 | Votações de 1998 e 1999 |
| 2017 | 146 | **8** | 972 a 987 | Votações de 1999 |

São **38 votações**. Nos outros 22 anos, nenhuma.

⚠️ O `informeLegislativo.data` ⛔ serve de critério: em 2005 há 9 votações com informe de
2002–2003 e código na sequência certa. O informe é da matéria, e a matéria pode ser antiga.

## O que mudou

| | Antes | Depois |
|---|---|---|
| Ingestão | Gravava pela `dataSessao` | `separar_fora_de_epoca` descarta e registra no log. A que já estava gravada é **apagada**, com os votos dela |
| Votação com pergunta do questionário | — | `apagar_votacoes` **recusa** e diz qual: a FK em cascata apagaria a pergunta junto |
| Volume mínimo | Conferido sobre o que veio | Conferido **depois** do descarte |
| Lacuna conhecida | 2015: 17 · 2016: 13 | 2015: **0** · 2016: **6** |

A votação fora de época ⛔ é re-datada. A data verdadeira só se infere, e a de 1998 cairia
na 50ª legislatura, que a base ⛔ tem.

## Depois — o Senado na base

| Legislatura | Senadores, antes | Senadores, depois | Votações | Abertas |
|---|---:|---:|---:|---:|
| 51ª (só 2001–2002) | 228 | **102** | 131 | 120 |
| 52ª | 107 | 107 | 554 | 224 |
| 53ª | 110 | 110 | 537 | 178 |
| 54ª | 111 | 111 | 513 | 208 |
| 55ª | 203 | **100** | 254 | **103** |
| 56ª | 111 | 111 | 719 | 402 |
| 57ª | 104 | 104 | 423 | 183 |

O grafo das duas foi refeito: 55ª com **100 nós e 613 arestas**, 51ª com **102 e 630**.

## O que fica

🔴 **A 55ª do Senado é a legislatura com menos dado da base.** Sem as votações antigas,
2015 tem **zero** votações e 2016 tem **seis**. Pela sequência do código, faltam ~230
votações entre a última de 2014 (5.329) e a primeira de 2016 (5.560), e o `/votacao` ⛔ as
devolve. O grafo passa do mínimo (100 votações abertas de plenário) por **3**, e descreve
2016–2018, ⛔ a legislatura inteira. Desde a PL59 a tela diz o recorte: "as abertas vão
de mai/2016 a ...", em todo grafo.

⚠️ Outra fonte do Senado para 2015–2016 ainda ⛔ foi procurada. Ver PL58 em
[`PENDENCIAS`](../PENDENCIAS.md).

## A lição

O número errado era **plausível dentro da própria tela**: um grafo do Senado com nomes
conhecidos, com ligações, com grupos. Ele só ficou visível quando duas legislaturas
apareceram lado a lado, e 203 destoou de 104. É a regra metodológica do projeto mais uma
vez: **medir um ano e generalizar**. O `/votacao` foi validado em 2023–2026 e confiado
para 2001–2022.
