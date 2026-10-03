# Achado 38 — a emenda sem autor

**Medido em 2026-10-02**, no arquivo único de emendas do Portal da Transparência
(`emendas-parlamentares/UNICO`, baixado no mesmo dia, 32 MB), de 2014 a 2026.

---

## Como apareceu

A carga de emendas descarta a linha **incoerente**: aquela em que o código do autor não bate
com o trecho do código da emenda que deveria contê-lo (`emendas.codigo_do_autor`). Medido em
2026-09-25, eram zero em 2023–2026. Ao carregar de 2015 em diante, o log passou a dizer
"6.655 emendas com código de autor incoerente — a fonte mudou?".

A fonte não mudou. As incoerentes têm só dois códigos de autor, e nenhum é de parlamentar.

## O que são

| Código do autor | Nome no arquivo | Tipo de emenda no arquivo | Empenhado |
|---|---|---|---:|
| `S/I` | "Sem informação" | Emenda de Relator | R$ 20,38 bi |
| `S/I` | "Sem informação" | Emenda de Bancada | R$ 6,60 bi |
| `S/I` | "Sem informação" | Emenda Individual, transferência com finalidade definida | R$ 6,10 bi |
| `-99` | "RELATOR GERAL" | **Emenda de Comissão** | R$ 2,56 bi |

ATENÇÃO: o nome engana nos dois sentidos. O código chamado "RELATOR GERAL" está em emendas
de **comissão**; a emenda de relator (RP9) vem como "Sem informação".

## Por ano

| Ano | Linhas sem autor | Empenhado sem autor | Pago sem autor | Empenhado no ano | Parte sem autor |
|---|---:|---:|---:|---:|---:|
| 2014 | 11.155 | R$ 6,09 bi | R$ 0,13 bi | R$ 6,09 bi | **100%** |
| 2015 | 3 | R$ 0,00 bi | R$ 0,00 bi | R$ 3,38 bi | 0% |
| 2016 | 1.938 | R$ 18,70 bi | R$ 14,25 bi | R$ 25,92 bi | **72%** |
| 2017 | 4.074 | R$ 6,86 bi | R$ 3,10 bi | R$ 17,53 bi | 39% |
| 2018 | 66 | R$ 0,70 bi | R$ 0,35 bi | R$ 12,01 bi | 6% |
| 2019 | 333 | R$ 0,89 bi | R$ 0,30 bi | R$ 13,86 bi | 6% |
| 2020 | 241 | R$ 2,39 bi | R$ 1,52 bi | R$ 37,54 bi | 6% |
| 2021–2026 | 0 | — | — | — | 0% |
| **Total** | **17.810** | **R$ 35,64 bi** | **R$ 19,67 bi** | | |

## O que isso faz com a base

| Onde | Efeito |
|---|---|
| Ficha do parlamentar | **Nenhum.** Emenda sem autor não seria atribuída a ninguém de qualquer jeito |
| Totais de emendas por ano, no país e no mapa | **Faltam** as linhas descartadas: em 2016, 72% do empenhado. O número na tela fica plausível e menor que o real |
| 2014 | Não está na base: a carga começa em 2015, e o ano inteiro é sem autor |

RISCO: é o tipo de erro que o projeto já pagou caro: um número plausível, sem erro nenhum na
tela. Quem comparar 2016 com 2020 veria o dinheiro de emenda multiplicar, quando o que
mudou foi a identificação do autor.

## Dá para achar o autor por outro caminho? (medido em 2026-10-02)

Dentro do arquivo do Portal, não: a linha `S/I` não tem nem código de emenda ("Sem
informação"), e só 2 das 17.810 têm ação, plano orçamentário e localidade iguais aos de uma
emenda com autor. O SIOP, sistema de orçamento do governo, também não tem o autor de 2014.
Por tipo, a resposta muda:

| Tipo | Valor | Caminho | Resultado |
|---|---:|---|---|
| **Bancada** (2016–2020) | R$ 6,60 bi | A UF da linha diz de qual bancada estadual é | Validado nas 2.279 emendas de bancada **com** autor e UF: a UF bate com a da bancada em **97,1%** das linhas (97,6% do valor). As exceções são repasses a entidade nacional registrados em "São Paulo (UF)". O autor é a bancada, não uma pessoa |
| **Individual de 2014** | R$ 6,09 bi | A relação de emendas individuais aprovadas da CMO (PDF do relatório final, 7.787 emendas e 592 autores, extraídas) cruzada por ação e localidade | Validado em 2015, onde o Portal tem o autor: o código do Portal está no PDF em 99,4% dos casos, e quando ação e localidade dão **um autor só**, ele é o certo em **95,5%** das linhas (94,4% do valor). Em 2014 isso cobre **1.322 linhas e R$ 0,96 bi (16%)**; o resto tem vários autores possíveis (R$ 1,52 bi) ou nenhum casamento exato (R$ 3,61 bi). Por ação e UF quase tudo casa, mas 94% com mais de um autor |
| **Relator** (2016–2020) | R$ 20,38 bi | O autor formal é o relator-geral daquele orçamento | Atribuir ao relator-geral diria que ele escolheu o destino, e não escolheu: a emenda de relator acolhia pedidos de muitos parlamentares sem registrar quais. Para 2020 em diante, depois do STF (ADPF 850), o Congresso publicou listas de quem indicou; para 2016–2017, não há |
| **Comissão** (`-99`) | R$ 2,56 bi | Nenhum campo diz qual comissão | Não dá |

ATENÇÃO: 95,5% de acerto ainda é 1 erro em 22. Uma emenda de 2014 atribuída por este caminho
precisaria dizer na ficha que a autoria foi inferida pelo relatório da CMO, e não publicada
pelo Portal.

## O que decidir (Pendência 81)

| Opção | Efeito |
|---|---|
| Gravar a linha sem autor, com `pessoa_id` nulo e o tipo de emenda | Os totais do país voltam a ser os do Portal; a ficha não muda. É o que a carga já faz com emenda de bancada e de comissão |
| Gravar a de bancada como da bancada da UF | 97,1% de acerto medido; nenhuma pessoa recebe autoria |
| ~~Atribuir a individual de 2014 com autor único pela CMO~~ | Descartada pelo autor em 2026-10-02: a fonte é um PDF isolado por orçamento, sem carga periódica possível, para recuperar R$ 0,96 bi |
| Manter o descarte e dizer na tela | "Em 2016, R$ 18,7 bi de emendas não têm autor identificado no Portal e não entram nesta soma" |

O descarte existia para pegar código **incoerente** por erro de leitura, e cumpriu: em
2021–2026, zero. A linha sem autor é outra coisa, e o log não deveria chamá-la de mudança
da fonte.
