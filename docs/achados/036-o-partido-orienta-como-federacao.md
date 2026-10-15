# Achado 36 — o partido orienta como federação, e a disciplina não via

**Medido em 2026-10-01**, sobre as orientações de bancada da Câmara na 57ª legislatura
(`votacoesOrientacoes-{ano}`, 2023 a 2026) e a análise refeita no mesmo dia.

---

## O que a ficha dizia

"Votou com o PP: **100% de 4 votações orientadas**." Quatro, num mandato de mais de mil
votações de plenário.

## A causa

A disciplina compara o voto do deputado com a orientação da bancada do partido dele. O
ETL procurava a bancada de nome **exatamente igual** à sigla. A Câmara quase nunca publica
assim:

| Publicado | Votações orientadas na 57ª | Quem está dentro |
|---|---:|---|
| `Fdr PT-PCdoB-PV` | 1.277 | Federação PT, PCdoB, PV |
| `Fdr PSOL-REDE` | 1.369 | Federação PSOL, Rede |
| `Bl UniPpFdrPsdbCid...` | 561 | Bloco com União, PP, federação PSDB-Cidadania e outros, cortados pelo "..." |
| `PP` sozinho | 209 | O PP |
| `PT` sozinho | **0** | — |
| `NOVO` e `Novo` | 140 e 1.121 | A mesma sigla, em caixas diferentes |
| `Solidaried`, `Republican` | — | Siglas cortadas pela própria fonte |

**Nenhum dos 75 deputados do PT tinha disciplina medida**, nem 14 dos 15 do PSOL, nem 10 dos
11 do PCdoB. Nada dava erro: a ficha mostrava um número plausível, sobre uma base que
não representava o mandato.

Um segundo defeito no mesmo trecho: a sigla usada era "a do voto mais recente lido", numa
consulta **sem ordem**. Para quem trocou de partido, a sigla era sorteada.

## A regra nova — decisão do autor

| | Regra | Por quê |
|---|---|---|
| 1 | **A própria sigla vence**, sem diferença de caixa ou acento. Nome cortado pela fonte casa com a sigla que começa, a partir de 6 letras | `PSD` ⛔ pode casar com `PSDB` |
| 2 | **A federação conta como o partido** | A Lei 14.208/2021 manda a federação atuar como um partido só durante a legislatura |
| 3 | **Bloco ⛔ conta** | Bloco é aliança de liderança: o partido pode estar no bloco e votar diferente. E o nome vem cortado, sem dizer quem está dentro |
| 4 | **O partido é o de cada voto** | Quem trocou de sigla é medido contra a de então |

Votação em que nenhuma bancada representa o partido sai da base. ⛔ Entra como
desobediência.

A base da medida passou a ser gravada pelo ETL (`nos_metrica.base_disciplina`). A API a
recontava com a regra antiga e mostraria um percentual novo sobre uma base velha.

## Depois — 57ª legislatura

| Partido | Deputados | Com disciplina, antes | Com disciplina, depois | Base média | Disciplina média |
|---|---:|---:|---:|---:|---:|
| PL | 116 | 113 | 115 | 411 | 92% |
| PT | 75 | **0** | **75** | 683 | 99% |
| PSOL | 15 | 1 | 15 | 705 | 99% |
| PCdoB | 11 | 1 | 11 | 607 | 97% |
| PV | 6 | 2 | 6 | 555 | 96% |
| PP | 62 | 46 | 52 | 36 | 92% |
| UNIÃO | 67 | 46 | 59 | 27 | 95% |
| MDB | 48 | 38 | 41 | 18 | 94% |

No total, 563 dos 643 deputados têm a medida.

⚠️ **União, PP e MDB seguem com base pequena** (18 a 36 votações em média): eles orientam
quase sempre pelo bloco, que ficou de fora. A ficha mostra a base ao lado do percentual,
e é ela que diz quanto o número pesa.

## O que fica em aberto

Contar o bloco exigiria a composição oficial de cada bloco (a API da Câmara publica em
`/blocos`), e a ficha teria de dizer "votou com o bloco do PP", ⛔ "com o PP".
