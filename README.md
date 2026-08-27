# poligraph

> **Arquitetura ETL e Modelagem em Grafos para Recomendação de Notícias e Mensuração de
> Afinidade Política em Redes Sociais** — TCC.

Descobre quais deputados votam como você, comparando suas respostas com o **registro
nominal de votação** da Câmara. Afinidade medida por **comportamento revelado de voto**,
⛔ não por autodeclaração ideológica.

> ⚠️ **Ferramenta acadêmica. Não é recomendação de voto.**

---

## Estado atual — medido em 2026-08-27

| | |
|---|---|
| **Votos ingeridos** | 470.727 — legislatura 57 completa (2023–2026) |
| **Deputados com voto** | 643 |
| **Votações** | 1.594 |
| **Pares de similaridade** | 2.327.880 |
| **Arestas do grafo** | 36.017 |
| **Despesas de cota** | 208.188 |
| **Perguntas curadas ativas** | 21 |
| **Notícias** | 0 — ⛔ o coletor ainda não rodou |
| **Testes** | 79 .NET · 196 Python · 30 front |

⛔ **O Senado ainda não é ingerido** — ver [PL42](docs/PENDENCIAS.md).

---

## Como rodar

### O que você precisa

| | |
|---|---|
| **.NET 10 SDK** | A API, as migrations e o AppHost |
| **Node 20+** | O front |
| **Podman ou Docker** | Postgres e o ETL rodam em container |
| **Client ID do Google** | Sem ele o login não funciona — [como obter](docs/plano/08-obter-as-chaves.md) |

⛔ **Python no host é dispensável** — o ETL roda pela mesma imagem que o VPS executa.

### 1. O segredo do Google

```bash
dotnet user-secrets set "Google:ClientId" "SEU_ID.apps.googleusercontent.com" \
  --project src/Poligraph.Api
```

> 🔴 **Nunca em `appsettings.json`** — o arquivo é versionado.

### 2. Suba tudo

```bash
dotnet run --project src/Poligraph.AppHost
```

O Aspire sobe **Postgres → migrations → API → front**, nessa ordem, e imprime o link do
painel. O front fica em **http://localhost:5173**.

### 3. Popule o banco

⚠️ **O banco sobe vazio.** Não há mais seed de desenvolvimento: o dado local é a Câmara
de verdade.

No painel do Aspire, inicie **`etl-ingerir`** e depois **`etl-analisar`**.

> ⭐ Eles não rodam sozinhos, de propósito: a ingestão baixa dezenas de MB, e disparar
> isso a cada `dotnet run` deixaria o ambiente inutilizável por minutos.

### Os comandos do ETL

| Comando | O que faz | Duração |
|---|---|---|
| `ingerir --anos 2023 2024 2025 2026` | Deputados, votações e votos | ~2 min |
| `analisar --legislatura 57` | Similaridade, kNN, comunidades, componentes | ~40 s |
| `cota --anos 2025` | Cota parlamentar (CEAP) | ~11 s |
| `validar --legislatura 57` | ⭐ Mede discriminação e comunidade × partido | ~2 s |

`cota` e `validar` ainda não estão no painel — rodam pelo container:

```bash
podman run --rm --network "container:<postgres>" \
  -e "ConnectionStrings__poligraph=Host=localhost;Port=5432;Database=poligraph;Username=postgres;Password=..." \
  poligraph-etl:local cota --anos 2025
```

### Testes

```bash
dotnet test                              # 79 — Testcontainers com Postgres real
cd src/etl && python -m pytest           # 196
cd src/web && npm test                   # 30
```

---

## Desenho macro

```mermaid
flowchart LR
    subgraph FONTES["Fontes públicas"]
        direction TB
        CAM["Câmara<br/>votações · votos · cota · fotos"]
        TSE["TSE<br/>candidaturas · contas"]
        RSS["Feeds RSS<br/>notícias"]
    end

    subgraph ETL["🐍 ETL — Python"]
        direction TB
        ING["ingerir<br/>normaliza e grava"]
        ANA["analisar<br/>similaridade · grafo"]
        VAL["validar<br/>mede o método"]
    end

    PG[("PostgreSQL<br/>18 tabelas")]

    subgraph APP["Aplicação"]
        direction TB
        API["⚙️ API C#<br/>Minimal API"]
        WEB["⚛️ React<br/>Vite"]
    end

    CIDADAO(["Cidadão"])

    CAM --> ING
    TSE -.-> ING
    RSS -.-> ING
    ING --> PG
    PG --> ANA --> PG
    PG --> VAL
    PG --> API --> WEB --> CIDADAO

    style ETL fill:#e6f2f0,stroke:#0f766e
    style PG fill:#f3f5f7,stroke:#5b6673
```

⚠️ **Linha tracejada = ainda não implementado.** O TSE e o coletor de notícias estão
levantados e documentados, ⛔ mas não ingerem.

🔴 **O EF é dono do schema; o Python nunca cria tabela.** Quebrar isso já custou caro —
o ETL inteiro foi escrito com nomes de tabela errados e nunca falou com o banco. Hoje
`src/etl/tests/test_contrato_schema.py` trava a divergência, inclusive de colunas.

---

## O processo de ETL

```mermaid
flowchart TB
    A["CSVs anuais da Câmara<br/>votacoes · votacoesVotos"] --> B{"canário<br/>de parsing"}
    B -->|"contagem bate"| C["Filtra NOMINAIS<br/>simbólica não registra quem votou"]
    B -->|"não bate"| X["⛔ para"]
    C --> D["Classifica categoria<br/>e infere polaridade"]
    D --> E["Deduz a legislatura<br/>pela DATA da votação"]
    E --> F[("votacoes · votos")]

    F --> G["Matriz pessoa × votação<br/>só plenário, não secreta"]
    G --> H["Concordância e cosseno<br/>ponderados"]
    H --> I{"≥ 20 votações<br/>em comum?"}
    I -->|"não"| Y["⛔ descarta o par"]
    I -->|"sim"| J[("similaridades")]
    J --> K["kNN k=10, união"] --> L[("arestas_grafo")]
    L --> M["Louvain + layout<br/>+ componentes"] --> N[("nos_metrica")]

    style X fill:#fbe8e4,stroke:#a8321f
    style Y fill:#fbe8e4,stroke:#a8321f
```

### Três armadilhas que o desenho trata

| | |
|---|---|
| 🔴 **Polaridade** | Em **14%** das votações nominais, "Sim" significa **rejeitar**. Sinal invertido ⛔ não aparece na tela — aparece como número plausível e errado. [Achado #12](docs/achados/012-polaridade-nao-e-constante.md) |
| ⚠️ **Quebra de linha no CSV** | Parsing ingênuo por linha inflou a contagem em até **26%**. O canário compara com o volume medido |
| ⚠️ **Ausência ≠ discordância** | Tratar falta como voto contrário faria o instrumento medir **presença**, não afinidade |

📐 A matemática completa: [`plano/07 §3.2`](docs/plano/07-grafo-e-afinidade.md).
📐 O que cada número significa: [`metodos.md`](docs/metodos.md).

---

## Fontes consumidas

| Fonte | O que traz | Estado |
|---|---|---|
| **Câmara — CSVs anuais** | Votações e votos nominais | ✅ Ingerindo |
| **Câmara — `deputados.csv`** | Cadastro e id de-para | ✅ Ingerindo |
| **Câmara — `cotas/Ano-{ano}.zip`** | Cota parlamentar (CEAP) | ✅ Ingerindo |
| **Câmara — `bandep/{id}.jpg`** | Foto oficial | ✅ URL guardada |
| **Senado** | Votações e votos | ⛔ [PL42](docs/PENDENCIAS.md) |
| **TSE** | Candidaturas, prestação de contas | 🔵 Levantado |
| **Portal da Transparência** | ⭐ **Emendas parlamentares** | ⏳ Aguardando chave |
| **Feeds RSS** | Notícias por parlamentar | ⛔ Coletor não rodou |

⚠️ **Licitações, PNCP e servidores federais foram REPROVADOS** por não se ligarem a um
parlamentar — [`14-fontes-de-gasto`](docs/14-fontes-de-gasto.md) registra o motivo medido.

---

## Schema do banco

```mermaid
erDiagram
    pessoas ||--o{ pessoa_fonte_ids : "de-para por fonte"
    pessoas ||--o{ votos : "emite"
    pessoas ||--o{ despesas : "gasta"
    pessoas ||--o{ nos_metrica : "posição no grafo"
    pessoas ||--o{ noticia_pessoas : "é mencionado"
    pessoas ||--o{ segue : "🔴 dado sensível"

    proposicoes ||--o{ votacoes : "é votada em"
    votacoes ||--o{ votos : "registra"
    votacoes ||--o| perguntas : "vira"

    execucoes ||--o{ similaridades : "retrato"
    execucoes ||--o{ arestas_grafo : "retrato"
    execucoes ||--o{ nos_metrica : "retrato"

    usuarios ||--o{ segue : "acompanha"
    usuarios ||--o{ consentimentos : "consente"
    usuarios ||--o{ tokens_email : "recebe"

    noticias ||--o{ noticia_pessoas : "menciona"
    noticias ||--o{ noticia_temas : "trata de"
```

### As 18 tabelas, por bloco

| Bloco | Tabelas | Quem escreve |
|---|---|---|
| **Ingestão** | `pessoas` · `pessoa_fonte_ids` · `proposicoes` · `votacoes` · `votos` · `despesas` | 🐍 ETL |
| **Análise** | `execucoes` · `similaridades` · `arestas_grafo` · `nos_metrica` | 🐍 ETL |
| **Produto** | `perguntas` · `noticias` · `noticia_pessoas` · `noticia_temas` | Curadoria e coletor |
| **Conta** | `usuarios` · `segue` · `consentimentos` · `tokens_email` · `avaliacoes` | ⚙️ API |

### 🔴 Regras que o banco garante, não o código

> **Onde a regra puder virar `CHECK`, `UNIQUE` ou `FK`, ela vira.** Um bug que o banco
> rejeita custa minutos; um que ele aceita custa um capítulo do TCC.

| Constraint | O que impede |
|---|---|
| `ck_sim_minimo` — `n_votacoes_comuns >= 20` | Similaridade calculada sobre base insuficiente (RN-02) |
| `ck_sim_ordem` — `pessoa_a < pessoa_b` | O mesmo par gravado duas vezes, invertido |
| `ck_pergunta_polaridade` — `polaridade IN (-1,1)` | Pergunta sem sinal definido |
| `ck_voto_valor` — `valor IN (-1,0,1)` | Domínio de voto aberto (RN-03) |
| `ck_despesa_valor` — `valor_liquido <> 0` | Lançamento sem efeito. ⚠️ Negativo é **estorno** e fica |
| **FK `segue → pessoas`** com **`RESTRICT`** | 🔴 Apagar em silêncio registro de convicção política |
| **FKs do grafo → `pessoas`** com **`CASCADE`** | Nó órfão desenhado sem nome — **já aconteceu** |

### Exclusão: lógica por padrão, física para dado pessoal

| Onde | Como | Por quê |
|---|---|---|
| `pessoas` | **Lógica** (`excluido_em`) | O voto é registro histórico; apagar levaria o grafo junto |
| `usuarios` · `segue` | 🔴 **Física** | LGPD art. 18, VI dá direito à **eliminação**, ⛔ não à ocultação |

📐 Detalhe em [`plano/04 §2.2c`](docs/plano/04-esqueleto.md).

---

## A API

Minimal API, ⛔ sem controllers, sem MediatR, sem Repository.

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/parlamentares` | Lista, com filtro de nome, partido e UF |
| `GET` | `/api/parlamentares/{id}` | Ficha: dados, votos recentes, mais similares |
| `GET` | `/api/parlamentares/{id}/gastos` | 💰 Cota agregada por categoria e fornecedor |
| `GET` | `/api/parlamentares/{id}/noticias` | Notícias que mencionam a pessoa |
| `GET` | `/api/afinidade/perguntas` | As perguntas ativas, em ordem |
| `POST` | `/api/afinidade` | ⭐ Calcula afinidade e **posiciona o cidadão no grafo** |
| `GET` | `/api/grafo` | 🕸️ Nós e arestas da execução mais recente |
| `GET` | `/api/seguidos` · `PUT`/`DELETE` `/{id}` | 🔴 Lista de acompanhamento — dado sensível |
| `POST` | `/api/auth/google` · `/logout` · `/sair-de-todos` | Sessão |
| `GET` | `/api/auth/eu` | Quem está logado |
| `DELETE` | `/api/auth/conta` | 🔴 LGPD art. 18, VI — exclusão física |
| `POST` | `/api/avaliacao` | Feedback ⛔ **sem vínculo com a conta** |

### 🔴 Três decisões que atravessam a API

**⛔ Nenhum token é armazenado.** O `id_token` do Google é validado e descartado; a sessão
é um cookie `HttpOnly` assinado. ⛔ Não existe tabela de sessão — a revogação global sai de
um `sessao_versao` no usuário.

**⛔ Nunca percentual solto.** A resposta traz `acordos` e `comparaveis` separados, e a
tela monta *"concordaram em 4 de 5"*. "80%" esconderia que a base foram 5 perguntas
(RF-29).

**⛔ A polaridade nunca sai da API.** Expô-la deixaria o cidadão inferir o voto do
parlamentar **antes** de responder.

---

## Estrutura

```
src/
  Poligraph.Api/          ⚙️ Minimal API · dono do schema (EF Core)
  Poligraph.Migrations/   Aplica migrations e carrega a curadoria
  Poligraph.AppHost/      Aspire — orquestra o ambiente local
  Poligraph.Tests/        xUnit + Testcontainers
  etl/                    🐍 Python — ingestão e análise
  web/                    ⚛️ React + Vite
docker/                   Dockerfiles (fora de src/, por decisão)
docs/                     📚 Documentação
```

---

## Documentação

| | |
|---|---|
| 📚 [**Índice completo**](docs/README.md) | Os quatro tipos de documento e a regra do dono único |
| 🔬 [**Achados**](docs/achados/README.md) | Os 22 achados medidos — **é o que a parte teórica cita** |
| 📐 [**Métodos**](docs/metodos.md) | O que cada número significa — `r`, ARI, modularidade |
| ⭐ [**Grafo e afinidade**](docs/plano/07-grafo-e-afinidade.md) | O núcleo técnico: fórmulas, pesos, comunidades |
| 🔴 [**Pendências**](docs/PENDENCIAS.md) | O que está aberto e o que bloqueia |
| ⏳ [**Revisar antes da conclusão**](docs/REVISAR-ANTES-DA-CONCLUSAO.md) | Fatos com prazo de validade |

> ⚠️ **Regra metodológica do projeto:** *medir um ano e generalizar foi a origem de quase
> todos os erros cometidos aqui.* Antes de afirmar um número, meça — e diga sobre qual
> período.
