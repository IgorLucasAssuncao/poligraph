# Pendências — visão consolidada

> **Atualizado:** 2026-08-26 · **62 resolvidas · 54 abertas**
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
| **PL13** | ✅ **EF Core migrations** — não script SQL à mão (2026-08-26) |

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
| **PL33** | 🔴 **Novo:** os termos do Clarity dizem que ele não deve ser usado em sites dirigidos a menores de 18. No Brasil vota-se aos 16 — decidir junto com a PL24 | [plano/08 §2.2](plano/08-obter-as-chaves.md) |
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
| 🔄 **PL11** | **Curar as 15–25 perguntas** — 🔄 **lote 1 gerado**, 24 candidatas em [plano/06](plano/06-perguntas-lote-1.md), aguardando curadoria | 🔴 **Alta** | 🔴 **Dias** |
| 🔴 **RQ3** | Definir o **N final** de perguntas | 🔴 **Alta** | 🟢 Decisão |
| ~~PL12~~ | ✅ **Teste do jantar** — entra se dá para discutir num jantar sem explicar a proposta | — | — |
| **CT7** | 🔴 Piso de respostas para o `422` — sugerido **60% do N** (plano/07 §4.4) | 🔴 Alta | 🟢 Decisão |
| **PL10** | Questionário adaptativo entra como experimento comparativo? | 🟡 Média | — |
| **PL18** | Usar LLM para rascunhar a reescrita das ementas? | 🟡 Média | — |
| **A2** | Regex de `categoria`, validadas contra amostra rotulada à mão | 🟡 Média | 🟡 Horas |
| **A3** | Deduplicação de PEC em dois turnos | 🟡 Média | — |
| **A4** | Quantas das 100 proposições sobrevivem ao corte de unanimidade | 🟡 Média | — |
| **PL34** | 🔵 **Adiada por decisão do autor:** gravar as respostas individuais do questionário, SEM vínculo com a conta, para analisar quais perguntas dividem e quais ninguém entende (§ abaixo) | 🔵 Futuro | — |
| ~~API4~~ | ✅ **Resolvida** — cosseno no grafo, concordância simples na tela (plano/07 §4.5) | — | — |
| 🔴 **PL35** | **A legislatura não é filtrada em consulta nenhuma** — a decisão "só a 57ª" ([plano/06 §3](plano/06-perguntas-lote-1.md)) vive só no documento. Detalhe abaixo | 🔴 **Alta** | 🟡 Horas |
| ~~PL36~~ | ✅ **Resolvida (2026-08-26)** — nomes corrigidos e **verificado rodando o container contra o banco real**: monta a matriz e grava `execucoes`. Estava faltando também traduzir a connection string do Aspire (§ abaixo) | — | — |
| 🟡 **PL37** | 🔄 **Parcial** — `test_contrato_schema.py` lê o `PoligraphDb.cs` e trava os **nomes** de tabela. ⛔ As **colunas** continuam sem proteção: o DDL de `test_persistencia.py` ainda é escrito à mão | 🟡 Média | 🟡 Horas |
| 🟢 **PL39** | **O grafo local nunca terá arestas com o seed atual** — a RN-02 exige 20 votações comuns e o seed tem 5. ⭐ Não é bug: é o `CHECK` funcionando. Mas o grafo só aparece depois da ingestão real | 🟢 Baixa | 🟢 Decisão |
| 🔴 **PL42** | **O Senado não é ingerido** — nenhuma linha de código o alcança. ⚠️ A RF-07 é 🟢 Desejável, mas a **RNF-28 proíbe o seletor de casa** e o desenho da §3.4.1 exige perguntas das duas casas embaralhadas e duas listas no resultado. Sem Senado, esse desenho não existe | 🔴 **Alta** | 🔴 Dias |
| 🟡 **PL41** | **Os 12 deputados fictícios do seed convivem com os reais** — aparecem em `/api/parlamentares` ao lado dos 551 de verdade. ⭐ Não entram no grafo (5 votações < 20 da RN-02), mas na tela ficam indistinguíveis. ⛔ Não demonstrar para a banca sem resolver | 🟡 Média | 🟢 Decisão |
| 🟡 **PL40** | **`proposicoes` nunca é ingerida** — o CSV de votações traz só o `id` da proposição, sem sigla/número/ano/ementa. Hoje o `proposicao_id` é anulado. 🔴 Bloqueia a **RF-30** (exibir a ementa original ao lado da pergunta) | 🟡 Média | 🟡 Horas |
| 🟡 **PL38** | 🔄 **Parcial** — `arestas_grafo` já é gravada (`gravar_arestas`). ⛔ Falta `nos_metrica`: **comunidade, posição x/y, governismo e disciplina não são calculados por ninguém**, e o `networkx` segue sem ser importado (RF-19, RF-33) | 🟡 Média | 🟡 Horas |

### 🔴 PL35 — a legislatura não é filtrada em consulta nenhuma

**Encontrada em 2026-08-26**, a partir da pergunta do autor *"será só dessa legislatura?"*.

[`plano/06 §3`](plano/06-perguntas-lote-1.md) decidiu **só a legislatura 57**, com quatro
motivos medidos — cobertura, comparabilidade (RN-02), relevância e estabilidade
(r = 0,862 dentro da legislatura; **entre** legislaturas, não se mediu).

⛔ **Mas a decisão nunca chegou ao código.** `Votacao.Legislatura` existe e é indexada,
e só `EndpointsGrafo` a usa. Nenhuma consulta de afinidade, ficha ou painel filtra por
ela. Hoje passa porque o banco tem uma legislatura só.

| Consulta | O que acontece quando entrar uma segunda legislatura |
|---|---|
| 🔴 `PerguntaPublica.TotalPossivel` | `db.Votos.Select(PessoaId).Distinct().Count()` conta deputados das duas. O painel mostraria **"480 de 900"** — sem erro, só um número plausível e errado |
| `ParlamentarNaLista.NVotacoes` | Soma as votações de todas as legislaturas |
| `CarregarVotosAsync` | Escapa por acaso: só alcança votações ligadas a perguntas ativas |

⚠️ **É o mesmo formato do bug de polaridade:** não quebra a tela, produz número
plausível. E a regra 4 do projeto diz que regra medida vira *constraint*, não comentário.

⏳ **E tem prazo.** A 57ª termina em **janeiro de 2027**; a 58ª toma posse em fevereiro.
"Só a 57ª" é escolha com data de validade, e o sistema não tem hoje nenhum conceito de
qual legislatura está ativa.

**Encaminhamento sugerido:** derivar a legislatura da `Votacao` ligada à `Pergunta`, em
vez de configurar à parte — dado derivado é mais difícil de errar do que dado repetido.
🔴 O teste tem de semear **duas** legislaturas e provar que a segunda não vaza; sem isso,
o filtro pode sumir num refactor e ninguém percebe.

⚠️ **Vale para o questionário, não para o grafo.** O grafo de similaridade *pode* usar
histórico — são perguntas diferentes, e 2001–2026 continua disponível.

---

### ✅ PL36 (resolvida) e 🔄 PL37 (parcial) — o ETL Python e o banco nunca se falaram

**Encontradas em 2026-08-26**, a partir da pergunta do autor *"o script em python já
funciona?"*.

**Não funciona.** O EF Core, com `UseSnakeCaseNamingConvention()`, nomeia a tabela a
partir do `DbSet` — que é plural. O Python foi escrito no singular:

| Python usa | Existe no banco |
|---|---|
| `votacao` | `votacoes` |
| `voto` | `votos` |
| `pessoa` | `pessoas` |
| `pessoa_fonte_id` | `pessoa_fonte_ids` |
| `similaridade` | `similaridades` |
| `execucao` | `execucoes` |

⛔ **Todas as seis.** Qualquer `python -m poligraph_etl` morre no primeiro `SELECT` com
`relation "votacao" does not exist` — verificado contra o banco em execução.

#### 🔴 Por que ninguém percebeu: os testes provavam a coisa errada (PL37)

`tests/test_persistencia.py` faz `CREATE TABLE pessoa (...)`, `CREATE TABLE votacao
(...)` — **com os nomes errados**. Os 104 testes passam porque testam o Python contra um
banco que o Python mesmo inventou.

> ⚠️ **A lição é maior que o bug.** O `CLAUDE.md` diz que **o EF é dono do schema** e o
> Python só lê. Um teste que cria o próprio schema abandona esse contrato e passa a
> medir consistência interna em vez de integração. Verde constante e zero informação.

**Encaminhamento:** renomear é o menor dos trabalhos e ⛔ **não basta** — sem mudar o
teste, a mesma deriva volta na próxima coluna que mudar de nome. O teste precisa subir o
schema **pelas migrations do EF** (Testcontainers, como no lado C#) e só então rodar o
Python contra ele. 🔴 Só assim a renomeação fica provada e protegida.

#### ⚠️ O segundo defeito, que só apareceu ao rodar

Com os nomes já corrigidos, o container ainda morria **antes de abrir conexão**:

```
psycopg.ProgrammingError: invalid connection option "Host"
```

O Aspire injeta `ConnectionStrings__poligraph` no formato do **Npgsql**
(`Host=...;Database=...;Username=...`) e o `psycopg` fala **libpq**
(`host=... dbname=... user=...`). Resolvido em `poligraph_etl/conexao.py`.

> 🔑 **Nenhum teste pegaria isso**, e vale entender por quê: os testes recebiam a
> conexão pronta do Testcontainers, que já vem em libpq. O formato do Aspire nunca
> passava por ali. ⚠️ **Foi preciso executar de verdade** — é o mesmo padrão do bug do
> `DOTNET_ENVIRONMENT`, que também só apareceu rodando.

---

### 🟡 PL38 — o grafo é calculado e jogado fora

`__main__._analisar` faz:

```python
arestas = similaridade.arestas_knn(pares)
log.info("  grafo kNN: %d arestas", len(arestas))
```

⛔ E acaba aí. `similaridade.py` diz no cabeçalho que produz `aresta_grafo` e
`no_metrica`, mas `persistencia.py` não tem função que escreva em nenhuma das duas —
só `gravar_similaridades`.

Consequência: `EndpointsGrafo` lê `arestas_grafo` e `nos_metrica`, encontra vazio e
devolve `Grafo(0, casa, 0, [], [])`. O caminho está certo — ⭐ grafo vazio, não erro —
mas seria vazio **para sempre**, mesmo com o ETL rodando sem falha e sem aviso no log.

⚠️ Falta também **comunidade** e **posição (x, y)**: `NoDoGrafo` tem `Comunidade`,
`EixoX` e `EixoY`, e nada os calcula. O `networkx` está na stack para isso e ainda não
foi usado.

⚠️ **E não há tela.** A RF-33 (visualizar o grafo, *force-directed*, filtro por limiar,
cor por comunidade) é 🔴 Essencial e o front não tem página nenhuma que consuma
`/api/grafo`.

---

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
| **PL16** | Como o ETL sinaliza `novas_votacoes` |
| **PL31** | Definir o conteúdo do seed de desenvolvimento — quantos parlamentares, votações e perguntas |
| ~~PL32~~ | 🟢 Rebaixada — só texto principal foi a decisão; o texto das emendas deixou de ser necessário |
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

## ✅ Resolvidas — 62

`A1` `API1` `API2` `API6` `B1` `B2` `B3` `B4` `B5` `C1` `C2` `C3` `C4` `C6` `C8` `C13`
`C14` `CT1` `CT2` `CT4` `CT5` `CT6` `D1` `D3` `D5` `ER1` `ER3` `ER4` `N2` `N10` `P1` `P2`
`P3` `P4` `P6` `PL1` `PL2` `PL4` `PL6` `PL8` `PL9` `PL13` `PL28` `PP1` `RE-01` `RQ1` `RQ4` `RQ8` `RQ9`
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
