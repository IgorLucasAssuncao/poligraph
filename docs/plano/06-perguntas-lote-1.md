# Lote 1 de perguntas — candidatas medidas

> **Status:** v1.0 — 2026-08-26 · **PL11 em andamento**
> Extraído dos CSVs da Câmara com parser RFC 4180 próprio, validado contra os números
> documentados em [`04-contratos`](../04-contratos.md).
> ⚠️ **Nada aqui está aprovado.** É o primeiro lote para curadoria do autor.

---

## 1. Como este lote foi produzido

```
1.122 votações nominais de plenário  (legislatura 57, 2023–2026)
  └─ 367  substantivas e divididas ≥15%   (tirados requerimentos, urgências, adiamentos)
      └─ 336  com conteúdo de política pública  (tirados cargos, homenagens, feriados)
          └─  58  votando o TEXTO PRINCIPAL  ⭐ ementa = o que foi votado
          └─ 166  votando EMENDA ou DESTAQUE  ⚠️ ementa ≠ o que foi votado
```

### 1.1 ✅ O parser foi validado antes de qualquer análise

| Ano | Registros reais | Linhas do arquivo | Inflação se parseado por linha |
|---|---|---|---|
| 2023 | 10.832 | 12.439 | +14,8% |
| 2024 | 10.371 | 12.594 | +21,4% |
| **2025** | **13.825** | 17.420 | **+26,0%** |
| 2026 | 7.021 | 8.551 | +21,8% |

⭐ **13.825 em 2025 bate exatamente com o número documentado.** O parser está correto.

---

## 2. 🔴 Três achados que mudam o método

### Achado A — as votações mais divididas são administrativas

Das 58 votações de texto principal com maior divisão, o topo é **criação de cargos em
tribunais**: STF, STJ, CNJ, TRTs. Divisão de 44 a 46% — o Congresso se divide fortemente
nisso.

> ⚠️ **Divisão alta não significa pergunta boa.** *"Você é a favor de criar 12 funções
> comissionadas no quadro do STJ?"* não é respondível por leigo, e não mede afinidade
> política — mede nada.

⭐ **Consequência para o método:** o critério de seleção **não pode ser só divisão**.
Precisa de um segundo filtro, que é humano: *"um cidadão tem opinião sobre isso?"* — é
exatamente a **PL12**.

### Achado B — 74% das votações interessantes são sobre emenda, não sobre o texto

| | Quantidade | A ementa descreve o que foi votado? |
|---|---|---|
| Texto principal | 58 | ✅ Sim |
| **Emenda / destaque** | **166** | ⛔ **Não** |

**O CSV traz a ementa da proposição, não o texto da emenda.** Para transformar uma emenda
em pergunta é preciso ler o texto dela — que **não está no arquivo**, só na API
(`/proposicoes/{id}/emendas`) ou no inteiro teor.

⚠️ **Isso é trabalho manual adicional que a PL11 não previa.** Cada emenda exige uma
consulta e uma leitura.

### Achado C — a inversão de polaridade está visível nos dados

Três descrições aparecem repetidamente:

| Descrição | O que "Sim" significa | Polaridade |
|---|---|---|
| *"Aprovado o Projeto…"* | Aprovar a proposta | **+1** |
| 🔴 *"Mantido o texto"* | **Rejeitar** o destaque supressivo | **−1** |
| 🔴 *"Suprimido o texto"* | **Aprovar** a supressão | **+1**, mas sobre o oposto |

⭐ **Isto confirma o achado #12 com dado novo** e mostra que a regra é detectável por
padrão textual — o que permite pré-classificar antes da curadoria humana.

---

## 3. Escopo temporal — por que só a legislatura 57

> **Resposta à pergunta do autor: sim, só a 57 — e por um motivo que não é preguiça.**

| Motivo | |
|---|---|
| 🔴 **Cobertura** | Um deputado eleito em 2022 **não votou** nada da legislatura 56. Perguntas antigas gerariam "sem dados" para boa parte do painel |
| 🔴 **Comparabilidade** | O cidadão responde 20 perguntas; todo parlamentar precisa ter votado nas mesmas. Misturar legislaturas quebra a base comum (RN-02) |
| **Relevância** | Pauta de 2019 mede afinidade com um debate que já passou |
| **Estabilidade** | Dentro da legislatura, a posição é estável (r = 0,862). **Entre** legislaturas, não se mediu |

⚠️ **Isto vale para o questionário.** O grafo de similaridade **pode** usar histórico —
são perguntas diferentes, e o 2001–2026 continua disponível.

---

## 4. 🗳️ O lote — 24 candidatas

**Legenda:** `div` = divisão (0,50 = empate) · ⭐ texto principal · ⚠️ emenda/destaque

### 4.1 Instituições e democracia

| # | Votação | Proposição | div | Pergunta proposta | Pol. |
|---|---|---|---|---|---|
| 1 | `2358548-89` | PL 2162/2023 | 0,337 | **Você é a favor de anistiar os condenados pelos atos de 8 de janeiro de 2023?** | ⭐ +1 |
| 2 | `2525122-81` | REP 2/2025 | 0,428 | Um deputado condenado criminalmente em definitivo deve perder o mandato? | ⭐ +1 |
| 3 | `2387066-91` | PL 4438/2023 | 0,491 | O Código Eleitoral deve ser afrouxado quanto à prestação de contas de campanha? | ⚠️ −1 |

### 4.2 Meio ambiente

| # | Votação | Proposição | div | Pergunta proposta | Pol. |
|---|---|---|---|---|---|
| 4 | `257161-483` | PL 2159/2021 | 0,274 | **Obras devem poder ser licenciadas por autodeclaração, sem análise prévia do órgão ambiental?** | ⭐ +1 |
| 5 | `2345368-50` | MPV 1150/2022 | 0,449 | Prazos de regularização ambiental devem ser prorrogados para quem desmatou? | ⚠️ +1 |
| 6 | `2269745-84` | PL 327/2021 | 0,454 | O país deve acelerar a transição energética com incentivo público? | ⚠️ −1 |
| 7 | `545304-134` | PL 3899/2012 | 0,326 | O poder público deve priorizar compras de produtos sustentáveis? | ⭐ +1 |

### 4.3 Economia e tributos

| # | Votação | Proposição | div | Pergunta proposta | Pol. |
|---|---|---|---|---|---|
| 8 | `2456554-57` | PL 3449/2024 | 0,466 | **Compras internacionais de baixo valor devem ser taxadas?** | ⚠️ +1 |
| 9 | `2430143-76` | PLP 68/2024 | 0,496 | A reforma tributária deve manter regimes especiais para setores específicos? | ⚠️ −1 |
| 10 | `2473389-58` | PLP 210/2024 | 0,319 | As regras de limite de gastos públicos devem ser flexibilizadas? | ⭐ +1 |
| 11 | `2374400-53` | PL 3626/2023 | 0,478 | **As apostas esportivas online (bets) devem ter regras mais duras?** | ⚠️ −1 |
| 12 | `2115253-118` | PL 2721/2023 | 0,453 | Órgãos públicos devem ser obrigados a contratar os Correios? | ⭐ +1 |

### 4.4 Segurança e justiça

| # | Votação | Proposição | div | Pergunta proposta | Pol. |
|---|---|---|---|---|---|
| 13 | `264726-157` | PL 4149/2004 | 0,382 | **As regras para posse e registro de armas de fogo devem ser afrouxadas?** | ⚠️ −1 |
| 14 | `2351284-38` | PL 1112/2023 | 0,163 | Condenados por crimes hediondos devem cumprir 80% da pena antes de progredir de regime? | ⭐ +1 |
| 15 | `2194861-77` | PL 1637/2019 | 0,318 | Inimputáveis perigosos devem poder ficar internados por prazo indeterminado? | ⭐ +1 |
| 16 | `2413257-116` | PL 6020/2023 | 0,247 | Aproximar-se da vítima deve ser crime mesmo com o consentimento dela? | ⭐ +1 |
| 17 | `589982-124` | PL 6240/2013 | 0,484 | Desaparecimento forçado praticado por agente do Estado deve ter pena maior? | ⚠️ −1 |

### 4.5 Direitos sociais e trabalho

| # | Votação | Proposição | div | Pergunta proposta | Pol. |
|---|---|---|---|---|---|
| 18 | `575585-92` | PL 5496/2013 | 0,241 | **Deve ser facilitado o contrato de trabalho por prazo determinado?** | ⭐ +1 |
| 19 | `2162802-89` | PL 9133/2017 | 0,265 | Escolas que recusarem matrícula de aluno com deficiência devem perder o credenciamento? | ⭐ +1 |
| 20 | `2367064-82` | PL 2920/2023 | 0,451 | O Estado deve comprar alimentos da agricultura familiar para programas sociais? | ⚠️ −1 |
| 21 | `2482078-57` | PDL 3/2025 | 0,259 | O Congresso deve derrubar resoluções do conselho de direitos da criança? | ⭐ +1 |

### 4.6 Terra e povos indígenas

| # | Votação | Proposição | div | Pergunta proposta | Pol. |
|---|---|---|---|---|---|
| 22 | `2425883-50` | PL 1213/2024 | 0,439 | A Funai deve ser reforçada com carreira própria de servidores? | ⚠️ −1 |
| 23 | `2471177-102` | PL 4497/2024 | 0,271 | Ocupações de terras públicas em faixa de fronteira devem ser regularizadas? | ⭐ +1 |
| 24 | `2270325-92` | PLP 18/2021 | 0,408 | Serviços de resgate e salvamento devem entrar no piso da saúde? | ⚠️ −1 |

---

## 5. ⚠️ O que ainda falta antes de qualquer uma virar pergunta de verdade

| # | Pendência |
|---|---|
| 🔴 1 | **As 11 marcadas ⚠️ dependem de ler o texto da emenda** — a polaridade sugerida é inferência a partir da descrição, **não verificação** |
| 🔴 2 | Conferir se cada proposição teve **votação nominal única** — repetições (2 turnos, redação final) precisam de deduplicação (A3) |
| 🔴 3 | Medir quantos dos 644 deputados votaram em **cada** uma — pergunta com baixa cobertura enfraquece a comparação |
| 🟡 4 | Definir o N final (**RQ3**) — 24 é lote de trabalho, não questionário |
| 🟡 5 | Equilíbrio temático: hoje o lote pende para economia e segurança |

---

## 6. Pendências

| # | Pendência |
|---|---|
| **PL11** | 🔄 Em andamento — este é o lote 1 |
| **PL12** | 🔴 Ganhou urgência: o **achado A** mostra que divisão alta não basta como critério |
| **PL32** | 🔴 **Novo:** como obter o texto das emendas destacadas (API `/proposicoes/{id}/emendas`?) |
| **RQ3** | N final |
| **A3** | Deduplicação de proposição votada mais de uma vez |
