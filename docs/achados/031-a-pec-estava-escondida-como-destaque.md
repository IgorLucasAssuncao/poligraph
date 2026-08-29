# Achado 31 — a PEC estava escondida como destaque

**Medido em 2026-08-29**, ao investigar por que duas perguntas curadas apontavam para
votações que a RN-04 deveria ter excluído.

---

## O defeito

O padrão de `DESTAQUE` continha `emenda` solto. **"Proposta de Emenda à Constituição"**
contém "emenda".

📐 Resultado, na legislatura 57:

| | |
|---|---:|
| 🔴 Votações de PEC classificadas como `DESTAQUE` | **73** |
| Classificadas como `SUBSTANTIVA` | **0** |

⛔ **O voto mais substantivo que existe** — emendar a Constituição, em dois turnos, com
3/5 de quórum — entrava na matriz com **peso 0,7** e ficava **fora do universo de
curadoria**.

⚠️ E são votações **divididas**, exatamente o material que o questionário procura:
382×118, 371×121, 348×146.

## Os outros três, na mesma varredura

| Padrão | Votações | O que estava errado |
|---|---:|---|
| `ressalvad**o o** destaque` | **38** | O lookbehind cobria só o **plural** (`ressalvados os`) |
| `Subemenda Substitutiva **Global**` | 36 | A subemenda global **troca o texto inteiro**; ⛔ não é recorte |
| `Emenda**s** do Senado` | 9 | O mérito das mudanças da outra casa. ⚠️ No **singular** é destaque de verdade |

## 🔴 O que mudou

📐 **156 votações reclassificadas**, todas de `DESTAQUE` para `SUBSTANTIVA` — ⛔ nenhuma
no sentido contrário.

| Câmara, legislatura 57 | Antes | Depois |
|---|---:|---:|
| SUBSTANTIVA | 266 | ⭐ **370** |
| DESTAQUE | 431 | 327 |

| Universo de curadoria (plenário, aberta, substantiva) | Antes | Depois |
|---|---:|---:|
| Câmara | 141 | ⭐ **243** |
| 🔴 **Senado** | 52 | ⭐ **104** |

## ⚠️ Isto DERRUBA uma conclusão anterior

O lote 2 do Senado registrou que **o poço estava esgotado**: *"das 52 substantivas
abertas, 39 dividem menos de 5% e 7 das 8 acima de 25% já estavam curadas"*.

🔴 **Estava errado — porque as PECs estavam escondidas.** Com a classificação corrigida:

| | Antes | Depois |
|---|---:|---:|
| Candidatas novas do Senado com divisão ≥ 25% | 2 | ⭐ **10** |
| Candidatas novas da Câmara | 38 | 45 |

⭐ E as do Senado são de peso: **reforma tributária (PEC 45)**, número de deputados
federais, crédito fiscal de subvenção.

## ⛔ Foi verificado se a fonte dá o tipo, e ⛔ NÃO dá

⚠️ A pergunta certa, feita pelo autor: *"regex para definir um tipo é um caso ruim, se
mudar algo fudeu"*. ⭐ Está certo — então foi medido se existe alternativa.

`votacoesObjetos-{ano}.csv` traz `proposicao_siglaTipo`, o tipo do objeto votado:

| | |
|---|---|
| Cobertura das nossas votações (2024-25) | 954 de 998 — **95,6%** |
| 🔴 Tipos numa **mesma** votação | até **10**: `DTQ, EMP, PEP, PPP, PRLE, PRLP, RDF, REQ, RPD, SBT` |
| 🔴 A combinação `PRL, RPD` | **69×** PROCEDIMENTAL e **18×** SUBSTANTIVA |

⛔ **`votacoesObjetos` lista tudo que estava em pauta na sessão, ⛔ não o que aquela
votação decidiu.** Ele ⛔ não discrimina, e a Câmara ⛔ não publica o tipo da decisão em
lugar nenhum — só a descrição diz.

## ⭐ A mitigação: canário, ⛔ não esperança

Já que o regex fica, o risco real ⛔ não é ele errar hoje — é a fonte **mudar a redação**
e tudo virar `SUBSTANTIVA` **em silêncio**, porque esse é o default.

⭐ `descricoes_nao_reconhecidas` acusa toda frase que **nenhum** padrão alcança — nem de
rito, nem de destaque, nem de mérito. É o mesmo desenho de
`ingestao_senado.siglas_desconhecidas`, que já protege o domínio do voto.

📐 Na primeira execução: **4 órfãs em 2.015 descrições**. Duas ⛔ não são ruído:

| Órfã | O que era |
|---|---|
| *"Resultado. Sim: 182; Não: 182"* | A votação do `q-preco-abusivo` — que a curadoria já havia marcado **à mão** como *"precisa de conferência"*, porque ⛔ não diz o que foi votado |
| *"Votação, em segundo turno, da PEC nº 72/2023"* | PEC escrita pela **sigla**; o padrão só cobria o nome por extenso |

🔴 **O canário chegou sozinho ao que a leitura humana tinha achado, e ainda trouxe uma a
mais.** É o que transforma "confiamos no regex" em "sabemos quando ele ⛔ não alcança".
