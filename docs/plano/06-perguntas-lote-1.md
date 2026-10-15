# Lote 1 de perguntas — candidatas medidas

> **Status:** v2.0 — 2026-08-26 · **Pendência 11 em andamento**
> **v2.0:** decisões do autor aplicadas — só texto principal, formato afirmação, casos
> nominais incluídos, Pendência 12 resolvida. **22 perguntas.**
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
              └─ 22  aprovadas no "teste do jantar"  (§4.3)
```

### 1.1 ✅ O parser foi validado antes de qualquer análise

| Ano | Registros reais | Linhas do arquivo | Inflação se parseado por linha |
|---|---|---|---|
| 2023 | 10.832 | 12.439 | +14,8% |
| 2024 | 10.371 | 12.594 | +21,4% |
| **2025** | **13.825** | 17.420 | **+26,0%** |
| 2026 | 7.021 | 8.551 | +21,8% |

⭐ **13.825 em 2025 bate exatamente com o número documentado.** O parser está correto.
Ele vive em [`infra/analise/csv.awk`](../../infra/analise/csv.awk).

---

## 2. 🔴 Três achados que mudam o método

### Achado A — as votações mais divididas são administrativas

Das 58 votações de texto principal com maior divisão, o topo é **criação de cargos em
tribunais**: STF, STJ, CNJ, TRTs. Divisão de 44 a 46% — o Congresso se divide fortemente
nisso.

> ⚠️ **Divisão alta não significa pergunta boa.** *"Você é a favor de criar 12 funções
> comissionadas no quadro do STJ?"* não é respondível por leigo, e não mede afinidade
> política — mede nada.

⭐ **Consequência:** o critério de seleção **não pode ser só divisão**. Precisa de um
segundo filtro, humano — resolvido na §4.3.

### Achado B — 74% das votações interessantes são sobre emenda, não sobre o texto

| | Quantidade | A ementa descreve o que foi votado? |
|---|---|---|
| Texto principal | 58 | ✅ Sim |
| **Emenda / destaque** | **166** | ⛔ **Não** |

**O CSV traz a ementa da proposição, não o texto da emenda.** Transformar uma emenda em
pergunta exige ler o texto dela — que **não está no arquivo**.

### Achado C — a inversão de polaridade está visível nos dados

| Descrição | O que "Sim" significa | Polaridade |
|---|---|---|
| *"Aprovado o Projeto…"* | Aprovar a proposta | **+1** |
| 🔴 *"Mantido o texto"* | **Rejeitar** o destaque supressivo | **−1** |
| 🔴 *"Suprimido o texto"* | **Aprovar** a supressão | **+1**, sobre o oposto |

⭐ **Confirma o achado #12 com dado novo** e mostra que a regra é **detectável por padrão
textual** — dá para pré-classificar antes da curadoria humana.

---

## 3. Escopo temporal — por que só a legislatura 57

> **Resposta à pergunta do autor: sim, só a 57 — e não por preguiça.**

| Motivo | |
|---|---|
| 🔴 **Cobertura** | Um deputado eleito em 2022 **não votou** nada da legislatura 56. Perguntas antigas gerariam "sem dados" para boa parte do painel |
| 🔴 **Comparabilidade** | Todo parlamentar precisa ter votado nas mesmas perguntas. Misturar legislaturas quebra a base comum (RN-02) |
| **Relevância** | Pauta de 2019 mede afinidade com um debate que já passou |
| **Estabilidade** | Dentro da legislatura, a posição é estável (r = 0,862). **Entre** legislaturas, não se mediu |

⚠️ **Isto vale para o questionário.** O grafo de similaridade **pode** usar histórico —
são perguntas diferentes, e o 2001–2026 continua disponível.

---

## 4. ✅ Decisões do autor (2026-08-26)

| # | Decisão | Efeito |
|---|---|---|
| **1** | ⭐ **Só votações de texto principal** | Polaridade **sempre +1**. Universo cai de 224 para **58** |
| **2** | **Casos nominais entram** | Anistia do 8/1 e representações contra parlamentares ficam |
| **3** | ⭐ **Formato afirmação** | *"X deve ser Y."* → **Concordo · Discordo · Não sei** |
| **4** | ✅ **Pendência 12 resolvida — "teste do jantar"** | Entra se dá para discutir num jantar de família **sem explicar o que é a proposta** |

### 4.1 ⭐ A decisão 1 elimina o bug mais perigoso do sistema

> **Usando só texto principal, "Sim" sempre significa "aprovar isto".** A inversão de
> polaridade — 14% das votações, o erro que não aparece na tela — **deixa de ser possível
> por construção**, não por vigilância.

⚠️ **O teste API3 continua obrigatório.** Ele deixa de guardar contra erro de curadoria e
passa a guardar contra **regressão futura**: no dia em que alguém quiser incluir um
destaque, é o teste que impede a inclusão silenciosa.

### 4.2 ⚠️ O preço da decisão 1, registrado para a banca

Saem do questionário os temas mais reconhecíveis da legislatura:

| Tema perdido | Por quê |
|---|---|
| Apostas online (*bets*) | Votado como emenda |
| Posse de armas | Destaque — *"Mantido o texto"* |
| Taxa das compras internacionais | Emenda de plenário |
| Código Florestal | Emenda a MPV |
| Reforma tributária (regimes especiais) | Emenda |

> 🔑 **É troca consciente: menos cobertura temática, zero risco de sinal invertido.**
> Um questionário com 22 perguntas certas vale mais que um com 30 e um número trocado.

### 4.3 ✅ O "teste do jantar" — o critério da Pendência 12

| ✅ Passa | ⛔ Não passa |
|---|---|
| *"Condenados por crime hediondo devem cumprir 80% da pena?"* | *"Criar 12 funções comissionadas no quadro do STJ?"* |
| *"Escola que nega matrícula a aluno com deficiência deve perder credenciamento?"* | *"Prorrogar restos a pagar não processados da LDO?"* |
| *"Os condenados pelo 8 de janeiro devem ser anistiados?"* | *"Ratificar o Protocolo Complementar do CBERS-6?"* |

⭐ **Operacional e defensável:** *"se preciso explicar a proposta antes de perguntar, a
pergunta não serve."*

---

## 5. 🗳️ O lote — 22 perguntas

> Formato: **afirmação** · resposta **Concordo / Discordo / Não sei**
> **Todas com polaridade `+1`** — "Sim" do parlamentar = concordar com a afirmação.

### 5.1 Democracia e instituições

| # | Afirmação | Votação | div |
|---|---|---|---|
| 1 | **Os condenados pelos atos de 8 de janeiro de 2023 devem ser anistiados.** | `2358548-89` · PL 2162/2023 | 0,337 |
| 2 | ⚠️ Um deputado condenado criminalmente em definitivo deve perder o mandato. | `2525122-81` · REP 2/2025 | 0,428 |
| 3 | Bancos que recusarem conta a políticos e seus parentes devem responder por discriminação. | `2364109-35` · PL 2720/2023 | 0,393 |

### 5.2 Segurança pública

| # | Afirmação | Votação | div |
|---|---|---|---|
| 4 | Condenados por crimes hediondos devem cumprir ao menos 80% da pena antes de mudar de regime. | `2351284-38` · PL 1112/2023 | 0,163 |
| 5 | **As penas para integrantes de facções criminosas devem ser endurecidas.** | `2579832-62` · PL 5582/2025 | 0,229 |
| 6 | Aproximar-se da vítima deve continuar sendo crime, mesmo que ela consinta. | `2413257-116` · PL 6020/2023 | 0,247 |
| 7 | Pessoas inimputáveis consideradas perigosas devem poder ficar internadas por prazo indeterminado. | `2194861-77` · PL 1637/2019 | 0,318 |

### 5.3 Meio ambiente

| # | Afirmação | Votação | div |
|---|---|---|---|
| 8 | **Obras devem poder ser licenciadas por autodeclaração, sem análise prévia do órgão ambiental.** | `257161-483` · PL 2159/2021 | 0,274 |
| 9 | O poder público deve dar preferência a produtos sustentáveis nas suas compras. | `545304-134` · PL 3899/2012 | 0,326 |
| 10 | A rodovia BR-319, que corta a Amazônia, deve ser mantida trafegável como infraestrutura crítica. | `2395883-53` · PL 4994/2023 | 0,249 |

### 5.4 Economia e tributos

| # | Afirmação | Votação | div |
|---|---|---|---|
| 11 | O país deve ter uma regra permanente que limite o crescimento dos gastos públicos. | `2357053-47` · PLP 93/2023 | 0,225 |
| 12 | Essa regra de limite de gastos deve poder ser flexibilizada quando o governo julgar necessário. | `2473389-58` · PLP 210/2024 | 0,319 |
| 13 | **O Congresso deve derrubar o decreto que aumentou o IOF.** | `2515648-44` · PDL 214/2025 | 0,204 |
| 14 | Dívidas de agricultores e pecuaristas devem ser renegociadas com desconto. | `2398530-73` · PL 5122/2023 | 0,212 |

### 5.5 Trabalho e direitos sociais

| # | Afirmação | Votação | div |
|---|---|---|---|
| 15 | Deve ser mais fácil contratar trabalhadores por prazo determinado. | `575585-92` · PL 5496/2013 | 0,241 |
| 16 | **O governo deve pagar um incentivo em dinheiro para o estudante concluir o ensino médio.** | `2409076-34` · PLP 243/2023 | 0,172 |
| 17 | Escolas que recusarem matrícula de aluno com deficiência devem perder o credenciamento. | `2162802-89` · PL 9133/2017 | 0,265 |
| 18 | O país deve incentivar a indústria nacional de remédios e insumos de saúde. | `2252295-120` · PL 2583/2020 | 0,152 |

### 5.6 Estado, serviços e relações exteriores

| # | Afirmação | Votação | div |
|---|---|---|---|
| 19 | Órgãos públicos devem ser obrigados a contratar os Correios. | `2115253-118` · PL 2721/2023 | 0,453 |
| 20 | Ocupações antigas de terras públicas em faixa de fronteira devem ser regularizadas. | `2471177-102` · PL 4497/2024 | 0,271 |
| 21 | A Bolívia deve ser aceita como membro pleno do Mercosul. | `2149303-50` · PDC 745/2017 | 0,233 |
| 22 | A sede do governo federal deve poder mudar temporariamente para sediar evento internacional. | `2483447-25` · PL 358/2025 | 0,174 |

### 5.7 Equilíbrio do lote

| Tema | Perguntas |
|---|---|
| Segurança pública | 4 |
| Economia e tributos | 4 |
| Trabalho e social | 4 |
| Estado e exterior | 4 |
| Democracia | 3 |
| Meio ambiente | 3 |

⭐ **Nenhum tema domina.** Um questionário com 8 perguntas de segurança mediria "posição
sobre segurança", não afinidade política.

---

## 6. ⚠️ O que ainda precisa de verificação

| # | Item | Risco |
|---|---|---|
| 🔴 1 | **Pergunta 2 (REP 2/2025)** — a descrição diz *"Rejeitado o Parecer da CCJ"*, com **227 Sim × 170 Não**. Foi rejeitada por **falta de maioria absoluta** (257), não por derrota. É preciso ler o parecer para saber se "Sim" era **cassar** ou **absolver** | 🔴 **Inverte a pergunta** |
| 🔴 2 | **Cobertura** — medir quantos dos 644 deputados votaram em cada uma. Pergunta com poucos votantes enfraquece a comparação | 🟡 Enfraquece |
| 🟡 3 | **Deduplicação (A3)** — conferir se alguma proposição aparece duas vezes (2 turnos, redação final) | 🟡 Peso dobrado |
| 🟡 4 | **N final (RQ3)** — 22 é o lote. O questionário pode usar menos | — |

⚠️ **A pergunta 2 é a única com risco de inversão** — justamente por ser caso nominal, onde
o rito é mais complexo. **Se não der para verificar, corte-a:** as outras 21 estão seguras
por construção.

---

## 7. Pendências

| # | Pendência |
|---|---|
| **Pendência 11** | 🔄 Lote 1 pronto — aguarda revisão pergunta a pergunta |
| ~~Pendência 12~~ | ✅ **Teste do jantar** (§4.3) |
| **Pendência 32** | 🟢 **Rebaixada** — o texto das emendas deixou de ser necessário com a decisão 1 |
| **RQ3** | N final |
| **A3** | Deduplicação |
