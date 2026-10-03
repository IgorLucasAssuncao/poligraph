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

## O que decidir (PL81)

| Opção | Efeito |
|---|---|
| Gravar a linha sem autor, com `pessoa_id` nulo e o tipo de emenda | Os totais do país voltam a ser os do Portal; a ficha não muda. É o que a carga já faz com emenda de bancada e de comissão |
| Manter o descarte e dizer na tela | "Em 2016, R$ 18,7 bi de emendas não têm autor identificado no Portal e não entram nesta soma" |

O descarte existia para pegar código **incoerente** por erro de leitura, e cumpriu: em
2021–2026, zero. A linha sem autor é outra coisa, e o log não deveria chamá-la de mudança
da fonte.
