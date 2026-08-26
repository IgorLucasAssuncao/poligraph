# Pendências — visão consolidada

> **Atualizado:** 2026-08-26 · **61 resolvidas · 55 abertas**
> As pendências vivem espalhadas por 11 documentos. Esta é a visão única, agrupada
> **pelo que destrava cada uma** — que é o que importa na hora de decidir o que fazer.
> 🔴 **O questionário ganhou seção própria** — estava subestimado num bloco de *"trabalho
> manual"*, fora dos bloqueios.

---

## ✅ Decidido na rodada de infraestrutura e privacidade (2026-08-25)

| # | Decisão |
|---|---|
| **PL2** | ✅ **Hostinger VPS KVM 2** — 2 vCPU · 8 GB · 100 GB · São Paulo |
| **PL4** | ✅ Repositório privado |
| **PL6** | ✅ **Clarity em produção, gravando tudo**, com consentimento prévio bloqueante |
| **PL8** | ✅ Todas as telas recebem o script — a proteção é o consentimento, não a máscara |
| **PL9** | ✅ Banner de consentimento **necessário e bloqueante** |
| **RQ9** | ✅ **Login Google + perfil completo em claro** — 🔄 minimização revogada em 2026-08-25 |
| **PL28** | ✅ Resolvida por consequência — nome e sobrenome estão no banco |

> 🔑 **As duas decisões desta rodada empurram na mesma direção:** o projeto passou a
> guardar mais coisa (sessão gravada, lista de seguidos no servidor) e a compensar isso
> com **consentimento explícito**, em vez de com ausência de dado. Isso é defensável, mas
> transfere o peso para textos que ainda não existem — as **PL7** e **PL25** abaixo.

---

## 🔴 Bloqueiam a construção — decida antes de codar

| # | Pergunta | Onde |
|---|---|---|
| **PL25** | 🔴 Escrever o **texto do banner de consentimento** cobrindo as 5 exigências | [plano/02 §4.5.2](plano/02-autenticacao-e-metricas.md) |
| **PL26** | 🔴 Serviço de envio de e-mail (Resend, Brevo, SES) + **SPF, DKIM e DMARC** no domínio | [plano/02 §3.3.2](plano/02-autenticacao-e-metricas.md) |
| **PL27** | 🟡 Cadência do digest — diário, semanal, ou por volume | [plano/02 §3.3](plano/02-autenticacao-e-metricas.md) |
| **PL29** | 🟡 Duração do cookie de sessão (sugerido: 7 dias) | [plano/02 §3.2.4](plano/02-autenticacao-e-metricas.md) |
| **PL30** | 🔴 Persistir as chaves do Data Protection — senão todo redeploy desloga todo mundo | [plano/02 §3.6.4](plano/02-autenticacao-e-metricas.md) |
| **PL7** | 🔴 **Política de privacidade** — virou bloqueante: é campo obrigatório da tela do Google | [plano/02 §3.2.1](plano/02-autenticacao-e-metricas.md) |
| **PL24** | 🔴 Confirmar com o orientador se o TCC precisa de **Comitê de Ética** | [plano/02 §4.5](plano/02-autenticacao-e-metricas.md) |
| **PL23** | 🔴 CI como **portão** do deploy, ou os dois em paralelo? | [plano/01 §2.1.2](plano/01-arquitetura.md) |
| **PL3** | 🔴 **Subiu para bloqueante** — o login com Google exige domínio, e o e-mail exige SPF/DKIM/DMARC nele | [plano/01](plano/01-arquitetura.md) |
| 🔴 **PL11** | **Curar as 15–25 perguntas** — ⚠️ **o maior bloqueio de todos**, detalhado abaixo | [plano/03](plano/03-questionario.md) |
| 🔴 **RQ3** | **N final de perguntas** — a PL11 não começa sem esta definida | [03-requisitos](03-requisitos.md) |

⚠️ **PL7 e PL25 são texto jurídico, não código** — e agora estão no caminho crítico do
login e do Clarity. São o tipo de tarefa que não dá para fazer na véspera.

---

## 🔴 O QUESTIONÁRIO — a frente mais bloqueante do projeto

> ⚠️ **Corrigido em 2026-08-26.** Estas pendências existiam, mas ficavam num bloco chamado
> *"trabalho manual"*, fora da seção de bloqueios — o que **subestimava** a única frente
> que trava o passo 8 inteiro. A RQ3 ainda aparecia como 🟡 aqui, embora seja 🔴 no
> documento de origem.

| # | Pendência | Prioridade | Esforço |
|---|---|---|---|
| 🔴 **PL11** | **Curar as 15–25 perguntas** — selecionar, reescrever em linguagem leiga, **atribuir polaridade uma a uma** | 🔴 **Alta** | 🔴 **Dias** |
| 🔴 **RQ3** | Definir o **N final** de perguntas | 🔴 **Alta** | 🟢 Decisão |
| **PL12** | Critério de "respondível por leigo", documentado como método | 🟡 Média | 🟡 Horas |
| **CT7** | Mínimo de respostas para o resultado ter significado (o `422`) | 🟡 Média | 🟢 Decisão |
| **PL10** | Questionário adaptativo entra como experimento comparativo? | 🟡 Média | — |
| **PL18** | Usar LLM para rascunhar a reescrita das ementas? | 🟡 Média | — |
| **A2** | Regex de `categoria`, validadas contra amostra rotulada à mão | 🟡 Média | 🟡 Horas |
| **A3** | Deduplicação de PEC em dois turnos | 🟡 Média | — |
| **A4** | Quantas das 100 proposições sobrevivem ao corte de unanimidade | 🟡 Média | — |
| **API4** | Métrica exibida: concordância simples, cosseno, ou ambas? | 🟡 Média | — |

> 🔑 **Por que esta é a frente mais crítica, e não uma lista de tarefas de conteúdo:**

| | |
|---|---|
| **Não escala** | É leitura humana de ementa por ementa. Nenhuma ferramenta substitui |
| **Não acelera no fim** | Uma hora por dia resolve; três dias seguidos na véspera, não |
| **Bloqueia o passo 8** | Sem perguntas curadas, o questionário não existe — e ele é a *"Mensuração de Afinidade"* do título |
| 🔴 **É o mais atacável na banca** | O passo mais subjetivo do método. Cada escolha precisa estar justificada **por escrito** |
| **Alimenta o capítulo de metodologia** | Adiar custa duas vezes: o trabalho e o texto |

⚠️ **A polaridade é a parte que não pode errar.** Em 14% das votações "Sim" significa
rejeitar — e um sinal invertido **não aparece na tela**, aparece como um número plausível
e errado. Ver [00-discovery §7](00-discovery.md) e o teste API3.

📐 **Detalhamento em [plano/03-questionario.md](plano/03-questionario.md).**

---

## 🟡 Instalação — decida com o terminal aberto, não agora

| # | Pendência |
|---|---|
| **PL19** | Retenção do Prometheus (ex.: 90 dias) — sem limite ele enche o disco |
| **PL20** | 🔴 Destino do backup do Postgres — **configurar no primeiro dia**. ⚠️ Com e-mails em claro na base, o backup precisa ser **criptografado** no destino |
| **PL21** | Grafana público ou só por VPN/túnel |
| **PL22** | Exposição do painel do Coolify — público com 2FA, allow-list, ou VPN |

---

## 🟡 Só se resolvem contra código

| # | Pendência |
|---|---|
| **API3** | Teste de regressão da **polaridade** — o bug mais perigoso do sistema |
| **API7** | Medir quanto tempo o job de 207k pares leva de fato |
| **CT3** | Escrever o OpenAPI da C13 e validar contra o front |
| **PL13** | EF Core migrations ou script SQL versionado |
| **PL16** | Como o ETL sinaliza `novas_votacoes` |
| **C15** | Contrato do front — depende do React estar de pé |

---

## 🟡 Decisões de método — afetam o texto do TCC

| # | Pendência |
|---|---|
| **RQ2** | Métrica de comparação comunidade × partido — ARI? modularidade? |
| **C7** | Métricas formais de comparação entre casas |
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
<summary><b>Fontes e escopo</b> — B6, B7, C5, TS5, ER5, PL5, PL14, PL15, PL17, A5</summary>

Base dos Dados como atalho (B6, TS5), política de `cpf_hash` (B7, ER5), *fuzzy match*
(C5), biblioteca do grafo (PL5), retenção de `execucao` (PL14), `casa` em `pessoa` (PL15),
*cold start* do Postgres (PL17 — **já não se aplica**, o banco é container próprio),
reescrever objetivos se escolher o Cenário A (A5 — **já não se aplica**, a D3 escolheu o C).
</details>

---

## ⏳ Fatos com prazo de validade — lista separada

Não são pendências de trabalho: são coisas que **podem mudar sozinhas** entre agora e a
entrega. Vivem em [REVISAR-ANTES-DA-CONCLUSAO.md](REVISAR-ANTES-DA-CONCLUSAO.md).

Os dois que podem **mudar a conclusão**: se a **CPMI** passar a publicar votação nominal,
a unificação dos dois grafos vira possível; se o **Senado** publicar orientação de bancada,
a comparação entre casas deixa de ser assimétrica.

⚠️ E o mais provável de todos: **quase todos os números foram medidos com 2026 parcial.**

⏳ **Novo:** a retenção do Clarity (playback **30 dias**) expira antes da escrita se a
avaliação rodar cedo demais.

---

## ✅ Resolvidas — 61

`A1` `API1` `API2` `API6` `B1` `B2` `B3` `B4` `B5` `C1` `C2` `C3` `C4` `C6` `C8` `C13`
`C14` `CT1` `CT2` `CT4` `CT5` `CT6` `D1` `D3` `D5` `ER1` `ER3` `ER4` `N2` `N10` `P1` `P2`
`P3` `P4` `P6` `PL1` `PL2` `PL4` `PL6` `PL8` `PL9` `PL28` `PP1` `RE-01` `RQ1` `RQ4` `RQ8` `RQ9`
`SE1` `SE2` `SE3` `SE4` `SE5` `SE6` `TS1` `TS2` `TS3` `TS4` `TS6`

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
