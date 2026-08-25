# Pendências — visão consolidada

> **Atualizado:** 2026-08-25 · **51 resolvidas · 58 abertas**
> As pendências vivem espalhadas por 10 documentos. Esta é a visão única, agrupada
> **pelo que destrava cada uma** — que é o que importa na hora de decidir o que fazer.

---

## 🔴 Bloqueiam a construção — decida antes de codar

| # | Pergunta | Onde |
|---|---|---|
| ~~PL2~~ | ✅ **Azure App Service F1** — o Fly encerrou o free tier em out/2024 | — |
| ~~PL4~~ | ✅ **Repositório privado** — 300 de 2.000 min/mês do Actions | — |
| **PL6** | Clarity em produção ou só na avaliação? *É a única com peso jurídico* | [plano/02](plano/02-autenticacao-e-metricas.md) |
| **RQ9** | Onde vive a lista de seguidos — A (localStorage), B (conta anônima) ou C? | [03-requisitos](03-requisitos.md) |

> 🔑 **Nenhuma destas se resolve pesquisando.** São escolhas suas, e todas as cinco cabem
> em uma conversa de dez minutos.

---

## 🔴 Trabalho manual que ninguém automatiza

| # | Tarefa | Esforço |
|---|---|---|
| **PL11** | **Curar as 15–25 perguntas** — selecionar, reescrever em linguagem leiga, atribuir polaridade | 🔴 Dias |
| **A2** | Escrever e validar as regex de `categoria` contra amostra rotulada à mão | 🟡 Horas |
| **PL12** | Definir e documentar o critério "respondível por leigo" | 🟡 Horas |

⚠️ **A PL11 é o gargalo escondido do projeto.** É o passo mais subjetivo do método, o mais
atacável na banca, e o único que não escala. Comece cedo.

---

## 🟡 Só se resolvem contra código

| # | Pendência |
|---|---|
| **API3** | Teste de regressão da **polaridade** — o bug mais perigoso do sistema |
| **API7** | Medir quanto tempo o job de 207k pares leva de fato |
| **CT3** | Escrever o OpenAPI da C13 e validar contra o front |
| **PL13** | EF Core migrations ou script SQL versionado |
| **PL16** | Como o ETL sinaliza `novas_votacoes` |
| **PL17** | Testar o *cold start* do Postgres gerenciado |
| **C15** | Contrato do front — depende do React estar de pé |

---

## 🟡 Decisões de método — afetam o texto do TCC

| # | Pendência |
|---|---|
| **RQ3** | N final de perguntas do questionário |
| **CT7** | Mínimo de respostas para o resultado ter significado (o `422`) |
| **RQ2** | Métrica de comparação comunidade × partido — ARI? modularidade? |
| **C7** | Métricas formais de comparação entre casas |
| **API4** | Métrica exibida: concordância simples, cosseno, ou ambas? |
| **A3** | Deduplicação de PEC em dois turnos |
| **A4** | Quantas das 100 proposições sobrevivem ao corte de unanimidade |
| **PL10** | Questionário adaptativo entra como experimento? |
| **PL18** | Usar LLM para rascunhar a reescrita das ementas? (§3.5.2 do plano/03) |
| **RQ7** | Mecanismo de recomendação e como avaliá-lo |
| **RQ6** | Critérios de aceitação dos RF essenciais |
| **ER2** | Biblioteca de *fuzzy match* e calibração do limiar |

---

## 🟢 Incrementos e refinamentos

<details>
<summary><b>Crawler</b> — N1, N3, N4, N5, N6, N7, N8, N9, N11</summary>

Feed da Agência Câmara (N1), casamento nome→parlamentar (N3), `robots.txt` (N4), limiar de
dedup (N5), cobertura da Agência Senado (N6), retenção (N7), redundância (N8), estado
vazio (N9), lista final de feeds (N11).
</details>

<details>
<summary><b>Página do parlamentar</b> — PP2 a PP6</summary>

Assimetria da página de senador (PP2), apresentação de patrimônio (PP3), links de rede
social (PP4), parlamentar com poucos votos (PP5), perfil temático por relatoria (PP6).
</details>

<details>
<summary><b>Fontes e escopo</b> — B6, B7, C5, C7, TS5, ER5, PL3, PL5, PL7, PL8, PL9, PL13, PL14, PL15, PL16, PL17, A5</summary>

Base dos Dados como atalho (B6, TS5), política de `cpf_hash` (B7, ER5), *fuzzy match*
(C5), métricas de comparação entre casas (C7), domínio (PL3), biblioteca do grafo (PL5), política de privacidade (PL7), máscaras do
Clarity (PL8), banner de consentimento (PL9), retenção de `execucao` (PL14), `casa` em
`pessoa` (PL15), reescrever objetivos se escolher o Cenário A (A5 — **já não se aplica**,
a D3 escolheu o C).
</details>

---

## ⏳ Fatos com prazo de validade — lista separada

Não são pendências de trabalho: são coisas que **podem mudar sozinhas** entre agora e a
entrega. Vivem em [REVISAR-ANTES-DA-CONCLUSAO.md](REVISAR-ANTES-DA-CONCLUSAO.md).

Os dois que podem **mudar a conclusão**: se a **CPMI** passar a publicar votação nominal,
a unificação dos dois grafos vira possível; se o **Senado** publicar orientação de bancada,
a comparação entre casas deixa de ser assimétrica.

⚠️ E o mais provável de todos: **quase todos os números foram medidos com 2026 parcial.**

---

## ✅ Resolvidas — 51

`A1` `API1` `API2` `API6` `B1` `B2` `B3` `B4` `B5` `C1` `C2` `C3` `C6` `CT1` `CT2` `CT4`
`CT5` `CT6` `D1` `D3` `D5` `ER1` `ER3` `ER4` `N2` `N10` `P1` `P2` `P3` `P4` `P6` `PP1`
`RE-01` `RQ1` `RQ4` `RQ8` `SE1` `SE2` `SE3` `SE4` `SE5` `SE6` `TS1` `TS2` `TS3` `TS4`
`TS6` `C4` `C8` `C13` `C14`

⚠️ **Convenção de prefixo** (evita a colisão que existia até 2026-08-23):

| Prefixo | Documento |
|---|---|
| `A` `B` `C` | Cenários A, B e C (`arq/01`, `arq/02`, `arq/03`) |
| `API` | `arq/10-api-e-afinidade` |
| `N` | `arq/20-crawler-noticias` |
| `PP` | `arq/30-pagina-do-parlamentar` |
| `PL` | `plano/*` |
| `RQ` | `03-requisitos` |
| `CT` | `04-contratos` |
| `SE` | `11-api-senado` |
| `TS` | `12-fonte-tse` |
| `ER` | `13-correlacao-entre-fontes` |
| `D` | Decisões — `00-discovery` §11 |
