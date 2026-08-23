# Contratos — entradas, saídas e uso

> **Status:** v1.1 — 2026-08-23
> **v1.1:** §7.1–7.3 — o suplente é tratado de forma diferente em cada casa; §9 — contrato
> do grafo especificado (kNN k=10, limiar global descartado por medição).
> **Regra deste documento: nada aqui é suposição.** Todo formato, cardinalidade e domínio
> foi medido contra o dado real. Onde algo não pôde ser validado, está marcado
> ⛔ **NÃO VALIDADO**.

---

## 0. Índice de contratos

```mermaid
flowchart LR
    F["Fontes"] -->|C1..C6| B[("bronze")]
    B -->|C7..C9| S[("silver")]
    S -->|C10..C12| G[("gold")]
    G -->|C13| API["API REST"]
    G <-->|C14| PY["Job Python"]
    API -->|C15| W["Front"]
    style G fill:#238636,color:#fff
```

| # | Contrato | Validado? |
|---|---|---|
| C1–C4 | Câmara: CSVs anuais | ✅ |
| C5 | Câmara: API REST (CPF) | ✅ |
| C6 | Senado: `/votacao` | ✅ |
| C7 | TSE: `consulta_cand` | ✅ |
| C8 | Normalização de voto | ✅ |
| C9 | Entity resolution | ✅ testado |
| C10 | Matriz de votos | ✅ dimensionado |
| C11 | Similaridade | ✅ dimensionado |
| C12 | Grafo | ✅ **kNN k=10, medido** |
| C13 | API REST pública | ⛔ proposto |
| C14 | Fronteira Python ↔ Postgres | ⛔ proposto |

---

## 1. 🔴 Regra transversal de parsing — leia antes de tudo

**Os CSVs da Câmara contêm campos com quebra de linha e aspas escapadas.** Isto não é
detalhe: é a diferença entre um número certo e um errado.

**Evidência medida:**

```
votacoes-2025.csv       17.421 linhas físicas  →  13.825 registros reais
votacoesOrientacoes     5.020 linhas físicas   →   4.947 registros reais
votacoesVotos-2025.csv  167.296 linhas         →  167.296 registros  (não afetado)
```

Exemplo de campo `descricao` real, com aspas escapadas em RFC4180 (`""`):

```
"Aprovada a matéria destacada. Fica mantido o texto do Relator. Resultado:
 44 votos ""Sim"", 14 votos ""Não"". Quórum de votação: 58 votos."
```

⚠️ **Consequência já observada neste projeto:** contar votações com
`cut -d';' -f1 | sort -u` devolveu **15.037**; a contagem correta é **13.825**. As
1.212 extras eram fragmentos de linhas de continuação interpretados como ids.

> 🔑 **Contrato de parsing:** use um leitor CSV compatível com **RFC 4180**
> (`CsvHelper` no .NET, `csv`/`pandas` no Python). **`split(';')` e leitura linha-a-linha
> produzem números errados sem falhar.**

**Checklist obrigatório para todo CSV da Câmara:**

| Item | Tratamento |
|---|---|
| Separador | `;` |
| Aspas escapadas | `""` dentro de campo entre aspas |
| **Quebra de linha dentro de campo** | Parser RFC 4180 obrigatório |
| **BOM UTF-8** | Remover, ou a 1ª coluna vem com nome corrompido |
| Encoding | UTF-8 (Câmara) · **ISO-8859-1 (TSE)** |

---

## 2. C1–C4 · Câmara — CSVs anuais

**Endpoint:** `https://dadosabertos.camara.leg.br/arquivos/{dataset}/csv/{dataset}-{ano}.csv`
**Autenticação:** nenhuma · **Reconstrução:** ✅ diária, ~07:00 GMT (achado #19)

### C1 · `votacoesVotos-{ano}` — a base da matriz

```
idVotacao;uriVotacao;dataHoraVoto;voto;deputado_id;deputado_uri;deputado_nome;
deputado_siglaPartido;deputado_uriPartido;deputado_siglaUf;deputado_idLegislatura;
deputado_urlFoto
```

| Aspecto | Valor medido (2025) |
|---|---|
| Tamanho | 55,5 MB |
| Registros | **167.296** (= linhas físicas; ✅ sem multilinha) |
| Votações distintas | **526** |
| Deputados distintos | 552 |
| Domínio de `voto` | `Sim` 96.839 · `Não` 68.923 · *vazio* 421 · `Artigo 17` 401 · `Obstrução` 375 · `Abstenção` 336 |

**Cobertura por ano (legislatura 57):**

| Ano | Tamanho | Votações nominais | Das quais PLEN | Votos |
|---|---|---|---|---|
| 2023 | 40,8 MB | 447 | 300 | 128.679 |
| 2024 | 36,9 MB | 448 | 273 | 116.400 |
| 2025 | 55,5 MB | 526 | 410 | 167.296 |
| 2026* | 16,0 MB | 149 | 120 | 50.581 |
| **Total** | ~149 MB | **1.570** | **1.103** | **~463.000** |

\* parcial, até agosto. Série completa disponível de **2001 a 2026**.

### C2 · `votacoes-{ano}` — metadados da votação

```
id;uri;data;dataHoraRegistro;idOrgao;uriOrgao;siglaOrgao;idEvento;uriEvento;aprovacao;
votosSim;votosNao;votosOutros;descricao;ultimaAberturaVotacao_*;ultimaApresentacaoProposicao_*
```

| Aspecto | Valor medido (2025) |
|---|---|
| Registros reais | **13.825** ⚠️ (a contagem ingênua dá 15.037 — ver §1) |
| Linhas físicas | 17.421 |
| **Taxa de nominais** | **526 / 13.825 = 3,8 %** |
| `votosSim`/`votosNao` preenchidos | ✅ nas 526 nominais · ⛔ **zerados nas simbólicas** |

⚠️ **As votações simbólicas não trazem nem contagem agregada** — 16.868 registros com
`votosSim+votosNao = 0`. Não dá para estimar o quão dividida foi a decisão.

### C3 · `votacoesOrientacoes-{ano}` — ⭐ rótulo governo × oposição

```
idVotacao;uriVotacao;siglaOrgao;descricao;siglaBancada;uriBancada;orientacao
```

| Aspecto | Valor medido (2025) |
|---|---|
| Registros reais | **4.947** (5.020 linhas físicas) |
| Bancadas distintas | 264 |
| **Pseudo-bancadas** | ✅ `Governo`, `Maioria`, `Minoria`, `Oposição` |

⚠️ `orientacao` pode vir **string vazia** = bancada liberou o voto. ≠ ausência de dado.
⚠️ `siglaBancada` mistura partido, bloco (`"Bl PlFdrPTUniPp..."`, truncado) e
pseudo-bancada. **Não usar como chave estrangeira.**

### C4 · Demais CSVs

| Dataset | Uso | Chave |
|---|---|---|
| `proposicoes-{ano}` | Ementa da matéria | `id` |
| `proposicoesTemas-{ano}` | Classificação temática | `uriProposicao` |
| `proposicoesAutores-{ano}` | Aresta de coautoria | `idProposicao`, `idDeputadoAutor` |
| `proposicoesTramitacoes-{ano}` | Relatoria, rito conclusivo | `uriProposicao` |
| `deputados` | Cadastro | `uri` ⚠️ **sem coluna `id`** |
| `orgaos` | Comissões | `uri` |

---

## 3. C5 · Câmara — API REST

**Base:** `https://dadosabertos.camara.leg.br/api/v2` · sem autenticação

### 3.1 🔴 O único dado que **exige** a API: o CPF

| Fonte | CPF disponível? |
|---|---|
| `deputados.csv` | ⛔ **0 de 7.889 linhas** — coluna existe, está vazia |
| `GET /deputados/{id}` | ✅ Sim |

**Contrato:**

```
GET /api/v2/deputados/{id}
Accept: application/json
→ 200  { "dados": { "id":204528, "cpf":"12519851813",
                    "nomeCivil":"ADRIANA MIGUEL VENTURA",
                    "ultimoStatus":{ "siglaPartido":"NOVO", "situacao":"Exercício",
                                     "condicaoEleitoral":"Titular" },
                    "redeSocial":[…] } }
```

**Custo:** ~644 chamadas por legislatura. **Uso:** uma vez, no *bootstrap*; depois só para
novos parlamentares.

⚠️ **CPF com zero à esquerda existe** (`05585378805`). Tratar como `string`.

### 3.2 ⚠️ `GET /deputados` — devolve duplicatas (achado #20)

| Medido (`idLegislatura=57`) | |
|---|---|
| Registros | **878** |
| Deputados distintos | **647** |
| Máx. repetições do mesmo `id` | 4 |

Causa: **produto cartesiano** dos valores distintos de nome × partido. As combinações
**não são estados históricos reais**.

> 🔑 **Contrato:** deduplicar por `id`. Nunca usar como histórico de partido.

⚠️ `links[rel=last]` com `itens=1` aponta 878 — total de **linhas**, não de pessoas.

### 3.3 Outros endpoints — comportamento validado

| Endpoint | Contrato |
|---|---|
| `/votacoes/{id}/votos` | ⛔ **rejeita `itens`/`pagina`** (HTTP 400). Devolve tudo de uma vez. Votação simbólica → `{"dados":[]}` |
| `/votacoes/{id}` | `proposicoesAfetadas` = matéria real ✅ · `uriProposicaoCitada` = parecer ⛔ |
| `/votacoes/{id}/orientacoes` | Orientação por bancada, com pseudo-bancadas |
| `/proposicoes/{id}/temas` | ✅ 24 de 25 proposições têm ≥1 tema |
| `/orgaos/{id}/membros` | `titulo` (Titular/Suplente/Presidente/Vice), `dataInicio`, `dataFim` |
| `/deputados/{id}/orgaos` | ~12 vínculos/deputado |
| `/deputados/{id}/frentes` | ⛔ **102 a 317 por deputado** — inútil como aresta |
| `/proposicoes/{id}/relatores` | ⛔ **HTTP 405** — não existe |

⚠️ **`campo `deputado_`** (com underscore final) no payload de `/votos`. Erro de
desserialização silencioso se ignorado.

---

## 4. C6 · Senado — `/votacao`

```
GET https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
Accept: application/json
Cache-Control do servidor: max-age=600
```

⚠️ **Estrutura aninhada**, não plana:

```json
[{ "codigoSessaoVotacao":6918, "identificacao":"PLP 22/2025",
   "ementa":"Dispõe sobre prazo para liquidação de restos a pagar…",
   "votacaoSecreta":"N",                     ← ⭐ campo decisivo
   "votos":[ { "codigoParlamentar":5672, "nomeParlamentar":"Alan Rick",
               "siglaPartidoParlamentar":"UNIÃO", "siglaUFParlamentar":"AC",
               "siglaVotoParlamentar":"Sim" } ] }]
```

**Cardinalidade medida (2025):** 128 objetos · 128 `votos[]` · **10.368** votos individuais.

### 4.1 🔴 Filtro obrigatório: `votacaoSecreta`

| | Votações | `Sim`/`Não` | `"Votou"` |
|---|---|---|---|
| `"S"` secreta | **72 (56%)** | 0 | 3.774 |
| `"N"` aberta | 56 (44%) | 3.572 | 0 |

> 🔑 **Contrato:** descartar `votacaoSecreta == "S"` **antes** da matriz. `"Votou"` é
> presença, nunca posição.

### 4.2 Domínio de `siglaVotoParlamentar` — 12 valores

| Entra na matriz | Não entra |
|---|---|
| `Sim` (3.023) · `Não` (549) · `Abstenção` (15, peso menor) | `Votou` (3.774) · `P-NRV` (1.544) · `AP` (761) · `MIS` (251) · `LS` (251) · `LP` (89) · `Presidente (art. 51 RISF)` (59) · `NCom` (37) · `NA` (15) |

⚠️ **Só 34% dos registros são posição de voto** — contra 99,3% na Câmara. **Mapeamentos
diferentes por casa; não reaproveite.**

### 4.3 Cobertura e endpoints auxiliares

| Ano | Votações | Secretas | **Abertas** |
|---|---|---|---|
| 2023 | 141 | 91 | 50 |
| 2024 | 95 | 37 | 58 |
| 2025 | 128 | 72 | 56 |
| 2026* | 57 | 39 | 18 |
| **Leg. 57** | 421 | 239 | **182** |

| Endpoint | Situação |
|---|---|
| `/senador/lista/atual` | ✅ Envelope XML de 4 níveis |
| `/senador/{id}` | ✅ ⛔ **sem CPF**, sem rede social |
| `/processo/relatoria?codigoParlamentar=` | ✅ Array plano, com datas |
| `/senador/{id}/relatorias` | ⚠️ **Depreciado** → usar `/processo/relatoria` |
| `/plenario/lista/votacao/{data}` | ⛔ **Depreciado** |
| Orientação de bancada | ⛔ **NÃO EXISTE** (`/orientacao`, `/votacao/orientacao`, `/processo/orientacao` → 404) |

---

## 5. C7 · TSE — `consulta_cand`

```
GET https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip
```

🔴 **Headers obrigatórios** — sem o conjunto completo, o WAF devolve 403:

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
            (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36
Accept: */*
Accept-Language: pt-BR,pt;q=0.9
Accept-Encoding: gzip, deflate, br        ← obrigatório
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Upgrade-Insecure-Requests: 1
```

| Aspecto | Valor medido (2022) |
|---|---|
| ZIP | 4,2 MB · 30 arquivos · 31,7 MB descompactado |
| Usar | `consulta_cand_2022_BRASIL.csv` (15,7 MB) |
| Encoding | **ISO-8859-1** · CRLF · `;` |
| Campos | **50** |
| Registros | **29.323** |
| Eleitos | Dep. federal **513** · Senador **27** |

**Campos-chave (posição):** 11 `SG_UF` · 14 `CD_CARGO` · 16 `SQ_CANDIDATO` ·
18 `NM_CANDIDATO` · **21 `NR_CPF_CANDIDATO`** · 37 `DT_NASCIMENTO` · 50 `DS_SIT_TOT_TURNO`

⚠️ **32% dos CPFs começam com zero** (9.477 de 29.322). Ler como número quebra o join
**em silêncio**. Sentinelas: `#NULO#`, `#NE#`, `-4`.

**Arquivos necessários:** `consulta_cand_2022` (Câmara + 27 senadores) **e**
`consulta_cand_2018` (os outros **54 senadores** — renovação escalonada).

---

## 6. C8 · Normalização de voto

| Origem (Câmara) | Interno | | Origem (Senado) | Interno |
|---|---|---|---|---|
| `Sim` | `+1` | | `Sim` | `+1` |
| `Não` | `-1` | | `Não` | `-1` |
| `Abstenção` | `0` | | `Abstenção` | `0` |
| `Obstrução`, `Artigo 17`, *vazio* | `null` | | os outros 9 valores | `null` |

**Justificativa medida:** na Câmara, `Sim`+`Não` = **99,3%**; os descartados somam 0,7%.

---

## 7. C9 · Entity resolution — ✅ testado

```
Câmara.cpf  ──────────────►  TSE.NR_CPF_CANDIDATO     determinístico
Senado      ──fuzzy───────►  TSE (nome+nascimento+UF)  81 pessoas, revisão manual
```

**Resultado do teste (60 deputados da legislatura 57):**

| Filtro no TSE | Casaram |
|---|---|
| `DS_SIT_TOT_TURNO LIKE 'ELEITO%'` | 46 / 59 — 78% |
| **`CD_CARGO = 6` (sem filtro de situação)** | ✅ **59 / 59 — 100%** |

Os 13 ausentes do primeiro filtro estavam no arquivo como `SUPLENTE` (11) e
`NÃO ELEITO` (2) — assumiram por sucessão.

> 🔑 **Contrato:** filtrar por **`CD_CARGO`**, nunca por `DS_SIT_TOT_TURNO`. A pergunta é
> *"concorreu a este cargo?"*, não *"venceu?"*.

### 7.1 🔴 O suplente é tratado de forma DIFERENTE em cada casa

Este é o desdobramento que quase passou batido, e ele quebra o join do Senado **em
silêncio** se ignorado.

| Casa | Como o suplente aparece no TSE |
|---|---|
| **Câmara** | **Mesmo cargo** (`CD_CARGO = 6`), com `DS_SIT_TOT_TURNO = SUPLENTE` — 4.195 registros em 2022 |
| **Senado** | 🔴 **CARGO SEPARADO**: `CD_CARGO = 9` (1º Suplente) e `10` (2º Suplente), **cada um com seu próprio `ELEITO`** |

Medido em 2022:

```
CD_CARGO  5 = SENADOR        →  27 ELEITO · 200 NÃO ELEITO · 16 #NULO
CD_CARGO  9 = 1º SUPLENTE    →  27 ELEITO ·  …
CD_CARGO 10 = 2º SUPLENTE    →  27 ELEITO · 200 NÃO ELEITO · 49 #NULO
CD_CARGO  6 = DEPUTADO FED.  → 513 eleitos (3 valores) · 4.195 SUPLENTE
```

→ **Um suplente de senador que assume o mandato NÃO está em `CD_CARGO = 5`.** Ele é, para
o TSE, candidato eleito a *"1º Suplente"*. Se o join filtrar só por cargo 5, essa pessoa
some — sem erro, sem exceção.

**Impacto medido nos 81 senadores em exercício:**

| Filtro no TSE 2022 | Casaram |
|---|---|
| `CD_CARGO = 5` | 24 |
| **`CD_CARGO IN (5, 9, 10)`** | ✅ **27** |

Os 3 recuperados são suplentes que assumiram:
`ANTONIA JUSSARA GOMES ALVES SOUSA LIMA` · `HERMES ARTUR KLANN` ·
`MARIA DE LOURDES PEREIRA E PEREIRA`.

⚠️ E os 27 de 81 confirmam a renovação escalonada: **os outros 54 estão em
`consulta_cand_2018`**, que precisa do mesmo filtro ampliado.

### 7.2 ✅ Contrato final do join — os quatro filtros

```sql
-- CÂMARA  (legislatura 57 ← eleição 2022)
WHERE ANO_ELEICAO = 2022
  AND CD_CARGO    = 6              -- inclui SUPLENTE automaticamente
  AND NR_CPF_CANDIDATO = :cpf      -- string, com zeros à esquerda

-- SENADO  (legislatura 57 ← eleições 2018 E 2022)
WHERE ANO_ELEICAO IN (2018, 2022)
  AND CD_CARGO IN (5, 9, 10)       -- 🔴 titular + 1º e 2º suplentes
  AND <fuzzy: nome + DT_NASCIMENTO + SG_UF>
```

| # | Filtro | Por quê |
|---|---|---|
| 1 | **`ANO_ELEICAO`** | Sem ele, um deputado com candidaturas em 2014/2018/2022 devolve N linhas |
| 2 | **`CD_CARGO`** | Define a população; **nunca** `DS_SIT_TOT_TURNO` |
| 3 | **Ampliar cargo no Senado** | 9 e 10 são suplentes que podem estar em exercício |
| 4 | **CPF como `string`** | 32% começam com zero |

### 7.3 O que fazer com cada resultado do join

```mermaid
flowchart TD
    A["Parlamentar em exercício"] --> B{"Casou no TSE?"}
    B -->|"1 linha"| C["✅ Enriquecer o nó"]
    B -->|"N linhas"| D["⚠️ Faltou filtro de ANO_ELEICAO"]
    B -->|"0 linhas"| E{"Por quê?"}
    E --> F["Cargo não ampliado<br/>(suplente do Senado)"]
    E --> G["CPF lido como número<br/>(perdeu zero à esquerda)"]
    E --> H["Ano eleitoral errado<br/>(senador de 2018)"]
    E --> I["Resíduo real →<br/>FILA DE EXCEÇÃO"]
    style I fill:#8b5a00,color:#fff
```

> 🔑 **Nenhum não-casamento é descartado em silêncio** (RNF-09). Vai para fila de exceção
> com o motivo, e o número final de exceções é **resultado a reportar** no TCC — mede a
> qualidade do *entity resolution* (objetivo específico #2).

⚠️ **`#NULO` como situação existe** (660 em deputado federal, 16 em senador). São
candidaturas indeferidas ou retiradas antes da apuração. **Não filtre por situação** e
elas deixam de importar — mais um argumento para o contrato de §7.2.

**`DS_SIT_TOT_TURNO` — domínio completo:** `SUPLENTE` 14.623 · `NÃO ELEITO` 11.276 ·
`#NULO` 1.662 · `ELEITO POR QP` 1.182 · `ELEITO POR MÉDIA` 390 · `ELEITO` 137 ·
`2º TURNO` 52.
⚠️ **"Eleito" são 3 valores.** `= 'ELEITO'` captura 137 de 1.709.

---

## 8. C10–C11 · Matriz e similaridade

| Estrutura | Dimensão | Memória |
|---|---|---|
| Matriz Câmara (leg. 57) | **644 × 1.103** | ~710 KB |
| Matriz Senado (leg. 57) | ~90 × 182 | ~16 KB |
| Pares Câmara | **207.046** | ~3 MB |

**Contrato de similaridade:**

```
para cada par (A,B) da MESMA casa:
    comuns = { v : voto_A(v) ≠ null ∧ voto_B(v) ≠ null }
    se |comuns| < 20 → descartar par
    concordancia = |{v ∈ comuns : voto_A(v) = voto_B(v)}| / |comuns|
```

**Cobertura do corte de 20, medida:**

| Casa | Pares que passam |
|---|---|
| Câmara | 97,5% (exclui 14 de 552) |
| Senado | **88%** (2.980 de 3.403; sobreposição média 33) |

**Saída:** `similaridade(pessoa_a, pessoa_b, metrica, valor, n_votacoes_comuns, calculado_em)`

⚠️ **Precisão declarada:** IC 95% de **±5,5 pp** na Câmara (n≈329) e **±17 pp** no Senado
(n≈33). Não afirmar gradações finas no Senado.

---

## 9. C12 · Grafo — ✅ especificado e medido

### 9.1 🔴 O limiar global **não funciona** — medido

Amostra de 200 deputados, plenário 2025, **18.393 pares válidos**:

| | |
|---|---|
| **Similaridade média entre dois deputados quaisquer** | **0,663** |

Densidade resultante por limiar:

| Limiar | Arestas (amostra) | Densidade | Extrapolado p/ 644 nós |
|---|---|---|---|
| ≥ 0,60 | 11.885 | **64,6 %** | ~134.000 arestas |
| ≥ 0,70 | 9.138 | 49,7 % | ~103.000 |
| ≥ 0,75 | 7.604 | 41,3 % | ~86.000 |
| ≥ 0,80 | 5.985 | 32,5 % | ~67.000 |
| ≥ 0,85 | 4.066 | 22,1 % | ~46.000 |
| ≥ 0,90 | 2.134 | **11,6 %** | ~24.000 |

🔴 **Mesmo a 0,90 a densidade é 11,6%** — ~24 mil arestas para 644 nós. Ilegível em
qualquer layout *force-directed*, e caro de transmitir ao navegador.

**A causa é institucional:** a média de concordância é **0,663**, não ~0,5. Dois deputados
aleatórios já concordam em dois terços das votações, porque boa parte das matérias é
pouco disputada. Um limiar só vira informativo **muito acima da média** — e aí corta nós
inteiros para fora do grafo.

⚠️ **E o limiar global tem um defeito estrutural, não só de volume:** ele produz
**nós isolados**. Quem tem perfil atípico fica sem nenhuma aresta e some da visualização —
justamente os casos mais interessantes.

### 9.2 ✅ Contrato adotado: **kNN**, não limiar

> **Cada nó mantém suas `k` arestas mais fortes.** A aresta entra no grafo se estiver no
> top-`k` de **qualquer uma das duas pontas** (kNN mutualizado).

| Propriedade | Limiar global | **kNN** |
|---|---|---|
| Nº de arestas | Imprevisível (24k–134k) | ✅ **Limitado a ~`n × k`** |
| Nós isolados | 🔴 Sim | ✅ **Nenhum** |
| Densidade | Varia com a casa | ✅ Controlada diretamente |
| Comparável entre Câmara e Senado | ⛔ Não (médias diferentes) | ✅ **Sim** |

**Parâmetro recomendado: `k = 10`.**

| Casa | Nós | Arestas (≈ n·k) | Densidade |
|---|---|---|---|
| Câmara | 644 | ~6.400 | **~1,5 %** |
| Senado | ~90 | ~900 | ~11 % |

⚠️ **O `k` é o parâmetro a justificar no TCC**, e é honesto reportar a análise de
sensibilidade — rodar Louvain com k = 5, 10, 20 e mostrar se as comunidades mudam. Se não
mudarem, o resultado é robusto; se mudarem, isso também precisa ser dito.

⚠️ **kNN torna a comparação entre casas legítima.** Com limiar global, Câmara e Senado
teriam densidades incomparáveis (médias de similaridade diferentes) e qualquer diferença
de modularidade seria artefato. Com `k` fixo, as duas redes têm a mesma densidade
relativa — pré-requisito para o RF-23.

### 9.3 Contrato de nó e aresta

```
no(pessoa_id, casa, nome_exibicao, partido_atual, uf, urlFoto,
   comunidade_louvain, eixo_x_svd, eixo_y_svd,
   governismo, disciplina_partidaria,          -- ⛔ só Câmara (P3)
   n_votacoes)                                  -- para o tooltip e o corte

aresta(pessoa_a, pessoa_b, tipo, peso, n_votacoes_comuns)
       tipo ∈ { SIMILARIDADE_VOTO, COMISSAO_COMUM, COAUTORIA }
```

**Invariantes:**

| # | Invariante |
|---|---|
| I1 | `pessoa_a.casa == pessoa_b.casa` — 🔴 **nunca** aresta entre casas (achado #7) |
| I2 | `n_votacoes_comuns >= 20` para `SIMILARIDADE_VOTO` |
| I3 | `pessoa_a < pessoa_b` — aresta não-direcionada, gravada uma vez |
| I4 | Todo nó tem ≥ 1 aresta (garantido pelo kNN) |
| I5 | Grafo por **legislatura** — nunca misturar (RN-12) |

**Saída para o front:**

```json
{ "casa":"CAMARA", "legislatura":57, "k":10,
  "nos":[ {"id":204528,"nome":"Adriana Ventura","partido":"NOVO","uf":"SP",
           "comunidade":3,"x":-0.42,"y":0.18,"nVotacoes":329} ],
  "arestas":[ {"a":204528,"b":223128,"peso":0.87,"n":312} ],
  "meta":{"nos":644,"arestas":6403,"densidade":0.015,
          "modularidade":0.41,"comunidades":5} }
```

⚠️ **Payload estimado:** ~644 nós + ~6.400 arestas ≈ **400–600 KB** em JSON. Aceitável,
mas vale `gzip` e considerar omitir `n` por aresta se apertar.

---

## 9.4 C13–C15 · ⛔ Contratos ainda não validados

| # | Contrato | O que falta |
|---|---|---|
| **C13** | API REST pública | Proposta em [arq/10](arq/10-api-e-afinidade.md) §5, não implementada |
| **C14** | Fronteira Python ↔ Postgres | Formato de troca não definido (API6) |
| **C15** | Contrato do front | Depende de D5 (Blazor vs React) |

**Arestas do grafo — decisões tomadas, dimensões não:**

| Aresta | Fonte | Status |
|---|---|---|
| Similaridade de voto | matriz | ✅ definida, limiar em aberto |
| Comissão em comum | `/orgaos/{id}/membros` | ✅ definida |
| Coautoria | `proposicoesAutores` | ✅ definida |
| ~~Frente parlamentar~~ | — | ⛔ descartada (achado #13) |

---

## 10. Uso — ordem de execução

```mermaid
flowchart TD
    A["1 · deputados.csv<br/>(cadastro)"] --> B["2 · GET /deputados/{id}<br/>644× para CPF"]
    B --> C["3 · votacoesVotos + votacoes<br/>+ orientacoes (CSV anual)"]
    C --> D["4 · votação → proposição<br/>prefixo do idVotacao"]
    D --> E["5 · proposicoesTemas"]
    E --> F["6 · Matriz + similaridade + grafo"]
    G["7 · TSE consulta_cand<br/>2022 + 2018"] --> H["8 · JOIN por CPF<br/>CD_CARGO, não situação"]
    B --> H
    I["9 · Senado /votacao<br/>filtrar votacaoSecreta"] --> J["10 · 2ª matriz"]
    F -.comparação.-> J
```

**Cadência** (§5.2 do [discovery](00-discovery.md)): CSV do ano corrente diário após
09:00 GMT · anos anteriores mensal · cadastro semanal · Senado diário · TSE por eleição ·
job analítico **por evento**, não por agenda.

---

## 11. Pendências deste documento

| # | Pendência |
|---|---|
| **CT1** | Validar layout de `bem_candidato` e `votacao_candidato_munzona` (P3) |
| ~~CT2~~ | ✅ **RESOLVIDA** — C12 especificado em §9: kNN k=10, contrato de nó/aresta, 5 invariantes |
| **CT3** | Escrever o OpenAPI da C13 e validar contra o front |
| **CT4** | Definir o formato de troca Python ↔ Postgres (C14) |
| **CT5** | Medir o domínio de `voto` nos anos 2023, 2024 e 2026 — só 2025 foi medido |
| **CT6** | Verificar se `proposicoesTramitacoes` e `proposicoesAutores` também têm multilinha |
