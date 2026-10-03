# Achado 35 — a 57ª calibrou o ETL, e as outras legislaturas não cabem nele sem ajuste

**Medido em 2026-10-01**, sobre os arquivos públicos baixados naquele dia:

- Câmara: `votacoes-{ano}.csv`, anos **2003, 2007, 2011 e 2015 a 2023**.
- Senado: `/votacao`, anos **2003, 2007, 2011 e 2015 a 2022**.

O classificador, a polaridade e o canário rodaram **sem alteração**, pelo próprio código do
ETL (`ingestao.votacoes_para_linhas`, `normalizacao.*`, `ingestao_senado.*`). ⛔ Nada foi
gravado no banco.

⚠️ Os anos de 2003, 2007 e 2011 são **amostra**, ⛔ a legislatura inteira.

---

## A pergunta

O autor pediu para trazer **todas** as legislaturas — Câmara, Senado e governos
anteriores. O ETL deduz a legislatura pela data (`legislatura_da_data`), então a pergunta
parecia ser só de volume. ⛔ Não é: quase toda regra do ETL foi medida na 57ª, e várias
dependem dela sem dizer.

## 🔴 1. A ingestão quebra em campo vazio, em vários anos

`2003` estoura em `normalizacao.sigla_do_objeto`:

```
AttributeError: 'float' object has no attribute 'strip'
```

`ultimaAberturaVotacao_descricao` vem vazio, o pandas o lê como `NaN` (float), e o
`.strip()` falha. Na 57ª toda votação nominal tem abertura preenchida, por isso nunca
apareceu.

📐 A carga de 2001 a 2022 achou mais três do mesmo tipo, cada um derrubando a carga do
ano:

| Ano | Campo | Efeito |
|---|---|---|
| 2001–2002 | `votacoesOrientacoes` **⛔ existe** (404) | Agora: aviso, e o ano entra sem orientação |
| 2010 | Voto sem UF do deputado (`NaN`) | `[:2]` em float |
| 2002 (Senado) | Ausência sem UF nem partido | `None` em coluna `NOT NULL` — o **banco** recusou |

⭐ O último foi pego pela restrição do schema, ⛔ pelo código: é a regra 4 do projeto
funcionando.

## 🟡 2. O destaque pesa muito mais na 56ª — e a polaridade ⛔ é risco ali

> ⚠️ **Corrigido no mesmo dia.** A primeira versão deste item se chamava *"a polaridade
> pesa muito mais na 56ª"* e tratava as 403 votações abaixo como risco de sinal
> invertido. ⛔ São: `inferir_polaridade` só alimenta a **curadoria** (`curar`), e o
> autor decidiu que as perguntas ficam só na legislatura mais recente. A matriz do grafo
> compara voto com voto, e ali a polaridade ⛔ entra. O que a categoria decide nas
> legislaturas antigas é só o **peso** (destaque 0,7, mérito 1,0).

Contagens de votações de **plenário** com *"mantido o texto"*, onde `inferir_polaridade`
devolveria **−1**:

| | Plenário nominal | Destaque | "Mantido o texto" (Sim = rejeitar) |
|---|---:|---:|---:|
| 55ª (2015–18) | 816 | 302 (37%) | **99** |
| **56ª (2019–22)** | **1.971** | **963 (49%)** | **403** |
| 57ª — só 2023 | 300 | 95 (32%) | 45 |

A 56ª tem **1,8×** as votações de plenário da 57ª inteira (1.103) e quase metade é
destaque. O ano da pandemia (2020) chega a **58%**.

⭐ O classificador **se sustenta** por padrão de texto: as descrições que ele ⛔ não
reconhece ficam entre **0% e 0,6%** em todos os anos medidos.

⚠️ As órfãs de 2011–2016 ⛔ são ruído. *"Suprimido o artigo"*, *"Suprimida expressão"* e
*"Restabelecido o texto da Câmara"* são **destaque supressivo** escrito como resultado,
e caem no default `SUBSTANTIVA`, com peso 1,0.

## 🟡 3. O cruzamento com `DTQ` acusa mais divergência

`divergencias_de_destaque` aponta **28** votações na 56ª (6 + 2 + 14 + 6), contra **3** em
2023. Parte delas é de fato rito, como *"Destaque de preferência"*. Outra parte é erro
real do padrão: *"Destaque do §1º do art. 1º…"* classificado como `SUBSTANTIVA`.

## 🔴 4. O Senado tem um buraco em 2015–2016 e votos fora do domínio

| Ano | Votações | Abertas | Siglas de voto fora do domínio medido |
|---|---:|---:|---|
| 2003 | 173 | 84 | `REP` 23 |
| 2007 | 155 | 34 | `REP` 16 · `P-OD` 21 |
| 2011 | 172 | 55 | `REP` 5 · `Obstrução` 1 |
| **2015** | **17** | 15 | — |
| **2016** | **13** | 10 | — |
| 2017 | 146 | 68 | — |
| 2018 | 112 | 31 | `P-OD` 3 |
| 2019 | 133 | 61 | `MERC` 5 |
| 2020 | 193 | 123 | `P-OD` 4 · **`LG` 59** |
| 2021 | 225 | 137 | — |
| 2022 | 169 | 82 | — |

- **2015 e 2016 vêm quase vazios.** É lacuna da fonte, ⛔ ano calmo: 2016 é o ano do
  impeachment. O canário `MINIMO_POR_ANO = 20` **para** a ingestão nos dois anos, como
  deve.
- **Sigla fora do domínio vira `None`.** O voto entra sem posição, e a ingestão só avisa
  no log. Em 2020 são 59 votos `LG`.
- ⭐ A 56ª do Senado tem **403** votações abertas, contra **182** na 57ª. O grafo do Senado
  ficaria mais firme ali do que na legislatura corrente.

## 🔴 5. "Tem voto na base" é usado como "é da 57ª"

Com uma legislatura só, as duas coisas coincidiam. Com várias, ⛔ coincidem mais:

| Onde | O que acontece com outras legislaturas |
|---|---|
| `_desempatar` (Pendência 47, regra A) | O homônimo histórico **passa a ter voto**, e os empates que a regra resolvia voltam |
| `deputados_da_legislatura`, `pessoas_sem_cpf` | Buscam CPF, redes e patrimônio de **todo** deputado com voto, ⛔ só da 57ª |
| `senadores_da_legislatura` | Idem para o Senado |
| Notícias (`_noticias`) | Associa notícia de hoje a **ex-parlamentar** homônimo |
| `ELEICOES_DO_SENADO = (2018, 2022)` | Fixo na 57ª: o CPF de senador de outra legislatura ⛔ é buscado |
| `fundo --eleicao 2022` | Uma eleição por execução. ⚠️ O nome de arquivo do TSE muda antes de 2018 (`prestacao_de_contas_eleitorais_candidatos_2014.zip` dá 404) |

## 🔴 6. A API escolhe a execução sem olhar a legislatura — e um caso já está errado hoje

Três consultas pegam *"a execução CONCLUÍDA mais recente"*:

| Consulta | Filtra casa? | Filtra legislatura? |
|---|---|---|
| `ServicoGrafo.ObterAsync` | ✅ | ⛔ |
| `ServicoAfinidade.PosicionarAsync` | ✅ | ⛔ |
| `ServicoParlamentares.MaisSimilaresAsync` | ⛔ | ⛔ |

Rodar `analisar --legislatura 56` depois da 57ª trocaria o grafo da página inicial pelo
da 56ª, sem erro.

🔴 **O terceiro já falha hoje.** A última análise rodou no Senado, e por isso os **643
deputados** aparecem com **0** "mais parecidos" na ficha. O senador conferido tem 10.
Medido pela API local em 2026-10-01: Abilio Brunini, Acácio Favacho e Adail Filho com 0;
Alan Rick com 10.

## 🟡 7. Governos anteriores: a gestão é uma eleição, e 2016 ⛔ cabe nisso

`gestoes` tem uma linha por eleição presidencial, com `ck_gestao_posse: primeiro_ano =
eleicao + 1`. Funciona de 2003 a 2015. ⛔ Representa **2016–2018**: a eleição de 2014
elegeu Dilma, e Temer governou a partir de maio de 2016. A página afirmaria quem
governava o orçamento de 2017 errado, sem erro.

## Disponibilidade das fontes de dinheiro

Sondado por requisição de 1 byte, sem baixar os arquivos:

| Fonte | Responde desde |
|---|---|
| Cota da Câmara (CEAP) e do Senado (CEAPS) | 2008 ou antes |
| Portal — `orcamento-despesa` | **2014** (2013 e 2009: 403) |
| Portal — `receitas`, `cpgf` | 2013 (2009: 403) |
| TSE — candidatos | 2002 |
| TSE — bens | 2006 |
| TSE — prestação de contas | 2018 com o nome atual; antes disso o arquivo tem outro nome |

⚠️ **403 ⛔ prova inexistência**: pode ser o WAF. A cobertura da Câmara também afina para
trás: **32** votações nominais de plenário em 2003 e **108** em 2007, contra 300 a 755 de
2015 em diante. Medido no arquivo, ⛔ conferido contra o registro histórico da Casa.

## O que foi feito — branch `legislaturas-historicas`, 2026-10-01

| | Estado |
|---|---|
| Consultas de execução com casa **e** legislatura (Pendência 54), na API e no `validar` | ✅ |
| Campo vazio (`NaN`, `None`) em abertura, descrição, partido, UF, nos dois lados | ✅ |
| Vocabulário supressivo antigo no classificador — 5 votações mudam, 0 da 57ª | ✅ |
| *"Tem voto"* → *"votou na legislatura corrente"*; CEAPS pelo da legislatura da despesa | ✅ |
| Siglas do Senado: `REP`, `P-OD`, `LG`, `LA`, `Obstrução` com a descrição da fonte | ✅ · `MERC` fica no log |
| Lacuna do Senado em 2015–16 aceita com piso | ✅ |
| Legislatura com menos de 100 votações de plenário abertas fica **sem grafo** | ✅ |
| Ficha com mandatos · grafo com período · lista e busca com quem já saiu | ✅ |
| Votações e votos de 2001 a 2022, nas duas casas | ✅ no banco de desenvolvimento |
| Orçamento do governo 2019–2022 | ✅ já estava na base desde 25/09, com as gestões eleitas em 2018 e 2022 |
| Orçamento 2015–2018 | ⛔ — a gestão de 2014 ⛔ cabe no modelo (§7, Pendência 56). 2014 sozinho ⛔ entra: "todos os anos" somaria 2014 e 2019–2026 pulando o buraco calado |
| Emendas antes de 2023 | ⛔ — o desempate de autor homônimo usa quem votou na legislatura corrente; para emenda antiga escolheria o homônimo errado. Precisa do desempate pela legislatura da emenda |
| Financiamento e patrimônio antes de 2018 | ⛔ — o CPF só é buscado para a legislatura corrente, e o arquivo de contas do TSE muda de nome antes de 2018 |

⭐ **Decisão do autor (2026-10-01): o questionário fica só na legislatura mais recente.**
As outras entram na ficha, no grafo e no dinheiro. Com isso, a curadoria (`curar`,
`validar`) ⛔ precisa rodar nas legislaturas antigas, e a polaridade ⛔ entra nelas (§2).
O que a categoria ainda decide ali é o **peso** no grafo.
