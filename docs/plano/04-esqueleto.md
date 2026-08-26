# Esqueleto — AppHost, schema e estrutura do ETL

> **Status:** v1.2 — 2026-08-25
> Os dois artefatos do **passo 1** ([01-arquitetura §8](01-arquitetura.md)). Tudo aqui é
> derivado dos contratos medidos em [`04-contratos.md`](../04-contratos.md).
> **v1.2:** §2.2 — 🔄 `usuario` passa a guardar o perfil COMPLETO do Google em claro.
> Caem `sub_hash`, `pepper` e o `email` anulável.
> **v1.1:** §2.2 — tabelas `usuario`, `segue`, `consentimento` e `token_email`, criadas
> pela decisão da RQ9. ⚠️ Corrige a afirmação de que "não existe tabela de usuário".

---

## 1. Princípio: transformar regra medida em *constraint*

Ao longo do discovery, 20 achados viraram regras. A maioria é do tipo *"não faça X, senão
o resultado fica errado sem dar erro"* — e esse é o pior modo de falha possível.

> 🔑 **Onde a regra puder virar `CHECK`, `UNIQUE` ou `FK`, ela vira.** Um bug que o banco
> rejeita custa minutos; um que ele aceita custa um capítulo do TCC.

| Regra medida | Vira |
|---|---|
| Nunca aresta entre casas (I1) | `CHECK` + trigger |
| `n_votacoes_comuns >= 20` (RN-02) | `CHECK` |
| Aresta não-direcionada, uma vez (I3) | `CHECK (pessoa_a < pessoa_b)` |
| Polaridade só `+1`/`-1` (RN-08) | `CHECK` |
| Voto normalizado (RN-03) | `CHECK` em domínio fechado |
| CPF nunca em claro (RNF-13) | Coluna é `cpf_hash`, não `cpf` |

---

## 2. Schema inicial

```sql
-- ═══════════════════════════════════════════════════════════
-- IDENTIDADE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE pessoa (
    id              BIGSERIAL PRIMARY KEY,     -- id sintético (RF-11)
    nome_civil      TEXT NOT NULL,
    nome_exibicao   TEXT NOT NULL,
    data_nascimento DATE,
    sexo            CHAR(1),
    cpf_hash        CHAR(64)                   -- ⚠️ NUNCA o CPF em claro (RNF-13)
);

CREATE TABLE pessoa_fonte_id (
    pessoa_id   BIGINT NOT NULL REFERENCES pessoa(id),
    fonte       TEXT   NOT NULL CHECK (fonte IN ('CAMARA','SENADO','TSE')),
    id_externo  TEXT   NOT NULL,
    metodo      TEXT   NOT NULL CHECK (metodo IN ('CPF','FUZZY','MANUAL')),
    confianca   REAL   CHECK (confianca BETWEEN 0 AND 1),
    PRIMARY KEY (fonte, id_externo)
);
-- ⭐ `metodo` e `confianca` não são enfeite: são o RESULTADO do objetivo
--    específico #2, reportável no TCC (13-correlacao §7).

-- ═══════════════════════════════════════════════════════════
-- VOTAÇÃO
-- ═══════════════════════════════════════════════════════════

CREATE TABLE votacao (
    id            TEXT PRIMARY KEY,            -- ⚠️ varchar: "2456731-84" (achado #3)
    casa          TEXT NOT NULL CHECK (casa IN ('CAMARA','SENADO')),
    legislatura   SMALLINT NOT NULL,
    data          DATE NOT NULL,
    orgao         TEXT,
    descricao     TEXT,
    proposicao_id BIGINT REFERENCES proposicao(id),
    categoria     TEXT NOT NULL CHECK (categoria IN
                    ('PROCEDIMENTAL','DESTAQUE','SUBSTANTIVA','AUTORIDADE')),
    secreta       BOOLEAN NOT NULL DEFAULT FALSE,   -- 🔴 Senado: 56% (achado #17)
    plenario      BOOLEAN NOT NULL,
    votos_sim     INT,
    votos_nao     INT
);

CREATE INDEX ix_votacao_matriz ON votacao (casa, legislatura, plenario, categoria);

CREATE TABLE voto (
    votacao_id      TEXT   NOT NULL REFERENCES votacao(id),
    pessoa_id       BIGINT NOT NULL REFERENCES pessoa(id),
    valor           SMALLINT CHECK (valor IN (-1, 0, 1)),   -- NULL = fora do cálculo
    partido_no_voto TEXT NOT NULL,   -- ⚠️ desnormalizado DE PROPÓSITO (§6.1 discovery)
    uf_no_voto      CHAR(2) NOT NULL,
    PRIMARY KEY (votacao_id, pessoa_id)
);
```

⚠️ **`partido_no_voto` parece redundância e não é.** É o registro histórico — 14 deputados
trocaram de partido em 2025. Normalizar para `pessoa.partido_atual` **destrói** a
informação temporal.

⚠️ **`secreta` existe para o Senado.** Sem esse filtro, 3.774 registros de `"Votou"`
entrariam na matriz como se fossem posição.

```sql
-- ═══════════════════════════════════════════════════════════
-- MATÉRIA
-- ═══════════════════════════════════════════════════════════

CREATE TABLE proposicao (
    id            BIGINT PRIMARY KEY,
    sigla_tipo    TEXT,
    numero        INT,
    ano           SMALLINT,
    ementa        TEXT,
    url_inteiro_teor TEXT,
    CHECK (ano <> 0)          -- ⚠️ ano=0 sinaliza PPP/parecer, não matéria real
);

CREATE TABLE proposicao_tema (
    proposicao_id BIGINT REFERENCES proposicao(id),
    tema          TEXT NOT NULL,
    PRIMARY KEY (proposicao_id, tema)
);

-- ═══════════════════════════════════════════════════════════
-- QUESTIONÁRIO  (curadoria manual — PL11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE pergunta (
    id          TEXT PRIMARY KEY,              -- "q1" — ⚠️ nunca expor o idVotacao
    votacao_id  TEXT NOT NULL REFERENCES votacao(id),
    texto       TEXT NOT NULL,                 -- reescrita leiga (RN-07)
    polaridade  SMALLINT NOT NULL CHECK (polaridade IN (-1, 1)),
    ordem       SMALLINT NOT NULL,
    ativa       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (votacao_id)
);
```

🔴 **`polaridade` é o campo mais perigoso do sistema.** Em 14% das votações nominais
"Sim" significa *manter o texto* — ou seja, **rejeitar** o destaque. Sem ele, o ranking
fica errado e **ninguém percebe olhando a tela**.

→ `NOT NULL` + `CHECK` garantem que nenhuma pergunta entre sem polaridade atribuída. O
teste de regressão (API3) cobre o resto.

```sql
-- ═══════════════════════════════════════════════════════════
-- RESULTADO ANALÍTICO  (escrito pelo Python — C14)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE execucao (
    id            BIGSERIAL PRIMARY KEY,
    casa          TEXT NOT NULL,
    legislatura   SMALLINT NOT NULL,
    k             SMALLINT NOT NULL,           -- kNN (§9.2 contratos)
    versao_carga  TEXT NOT NULL,
    iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluida_em  TIMESTAMPTZ,
    status        TEXT NOT NULL CHECK (status IN ('EM_ANDAMENTO','CONCLUIDA','FALHOU'))
);

CREATE TABLE similaridade (
    execucao_id       BIGINT NOT NULL REFERENCES execucao(id) ON DELETE CASCADE,
    pessoa_a          BIGINT NOT NULL REFERENCES pessoa(id),
    pessoa_b          BIGINT NOT NULL REFERENCES pessoa(id),
    metrica           TEXT   NOT NULL CHECK (metrica IN ('CONCORDANCIA','COSSENO')),
    valor             REAL   NOT NULL CHECK (valor BETWEEN 0 AND 1),
    n_votacoes_comuns INT    NOT NULL CHECK (n_votacoes_comuns >= 20),  -- RN-02
    PRIMARY KEY (execucao_id, pessoa_a, pessoa_b, metrica),
    CHECK (pessoa_a < pessoa_b)                                          -- I3
);

CREATE TABLE aresta_grafo (
    execucao_id BIGINT NOT NULL REFERENCES execucao(id) ON DELETE CASCADE,
    pessoa_a    BIGINT NOT NULL REFERENCES pessoa(id),
    pessoa_b    BIGINT NOT NULL REFERENCES pessoa(id),
    tipo        TEXT   NOT NULL CHECK (tipo IN
                  ('SIMILARIDADE_VOTO','COMISSAO_COMUM','COAUTORIA')),
    peso        REAL   NOT NULL,
    PRIMARY KEY (execucao_id, pessoa_a, pessoa_b, tipo),
    CHECK (pessoa_a < pessoa_b)
);

CREATE TABLE no_metrica (
    execucao_id BIGINT NOT NULL REFERENCES execucao(id) ON DELETE CASCADE,
    pessoa_id   BIGINT NOT NULL REFERENCES pessoa(id),
    comunidade  SMALLINT,
    eixo_x      REAL,
    eixo_y      REAL,
    governismo  REAL,      -- ⚠️ NULL no Senado — não existe orientação de bancada
    disciplina  REAL,      -- ⚠️ idem
    n_votacoes  INT NOT NULL,
    PRIMARY KEY (execucao_id, pessoa_id)
);
```

### 2.1 🔴 O invariante que o `CHECK` não alcança

`CHECK (pessoa_a < pessoa_b)` garante a não-duplicação, mas **não** impede aresta entre
casas (I1) — porque a casa está em `voto`/`votacao`, não em `pessoa`.

**Duas saídas:**

```sql
-- Opção A: desnormalizar a casa na aresta (mais simples)
ALTER TABLE aresta_grafo ADD COLUMN casa TEXT NOT NULL
  CHECK (casa IN ('CAMARA','SENADO'));
-- e o job Python garante que ambos pertencem à casa declarada

-- Opção B: trigger que valida contra mandato (mais correto, mais caro)
```

→ **Recomendo a Opção A.** A casa na aresta também simplifica a consulta do grafo, que
sempre filtra por casa.

⚠️ **Isso é o achado #7 virando estrutura.** As duas casas não compartilham votações, então
uma aresta entre elas seria silenciosamente sem sentido.

```sql
-- ═══════════════════════════════════════════════════════════
-- NOTÍCIAS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE noticia (
    id            BIGSERIAL PRIMARY KEY,
    url_canonica  TEXT NOT NULL UNIQUE,   -- dedup (RF-39)
    titulo        TEXT NOT NULL,
    veiculo       TEXT,
    publicado_em  TIMESTAMPTZ,
    trecho        TEXT,                    -- ⚠️ NUNCA o texto integral (RF-38)
    coletado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE noticia_pessoa (
    noticia_id BIGINT REFERENCES noticia(id) ON DELETE CASCADE,
    pessoa_id  BIGINT REFERENCES pessoa(id),
    confianca  REAL NOT NULL CHECK (confianca BETWEEN 0 AND 1),
    PRIMARY KEY (noticia_id, pessoa_id)
);

CREATE TABLE noticia_tema (
    noticia_id BIGINT REFERENCES noticia(id) ON DELETE CASCADE,
    tema       TEXT NOT NULL,
    PRIMARY KEY (noticia_id, tema)
);
```

### 2.2 🔄 Tabelas de usuário — acrescentadas pela RQ9 (2026-08-25)

> ⚠️ **Correção:** este documento dizia *"não existe tabela de usuário nem de seguir"*.
> Deixou de valer quando o autor decidiu por login com Google e notificação por e-mail
> ([02 §3](02-autenticacao-e-metricas.md)).

```sql
CREATE TABLE usuario (
    id               BIGSERIAL PRIMARY KEY,
    google_sub       TEXT NOT NULL UNIQUE,     -- em claro (decisão de 2026-08-25)
    email            TEXT NOT NULL,
    email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    nome             TEXT,
    primeiro_nome    TEXT,
    sobrenome        TEXT,
    foto_url         TEXT,
    locale           TEXT,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    visto_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    sessao_versao    SMALLINT NOT NULL DEFAULT 0,  -- ⭐ +1 = "sair de todos os aparelhos"
    CHECK (position('@' in email) > 1)
);
-- ⛔ SEM senha. SEM refresh_token. SEM id_token. SEM token de sessão.
-- ⭐ O perfil do Google é gravado por inteiro — ver [02 §3.5](02-autenticacao-e-metricas.md).

CREATE TABLE segue (
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    pessoa_id  BIGINT NOT NULL REFERENCES pessoa(id),
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, pessoa_id)
);
CREATE INDEX ON segue (pessoa_id);          -- "quantos seguem X"

CREATE TABLE consentimento (               -- 🔴 LGPD art. 8º §2: o ônus da prova continua seu
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    finalidade  TEXT NOT NULL CHECK (finalidade IN ('EMAIL_NOTICIAS')),
    versao      TEXT NOT NULL,              -- ⭐ hash ou versão do TEXTO aceito
    aceito_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    revogado_em TIMESTAMPTZ
);
CREATE UNIQUE INDEX ON consentimento (usuario_id, finalidade)
    WHERE revogado_em IS NULL;             -- um consentimento vivo por finalidade

CREATE TABLE token_email (
    token      TEXT PRIMARY KEY,            -- 32 bytes aleatórios, base64url
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    proposito  TEXT NOT NULL CHECK (proposito IN ('DESCADASTRO')),
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    usado_em   TIMESTAMPTZ                  -- ⚠️ sem expiração, de propósito
);
```

#### 2.2.1 🔄 O critério mudou: guardar tudo

> ⛔ **O teste "preciso disso quando a pessoa não está presente?" foi revogado** pela
> decisão de 2026-08-25. O critério agora é simples: **o que o Google manda, o banco
> guarda.** Ver [02 §3.5](02-autenticacao-e-metricas.md).

| Campo | Guardado? |
|---|---|
| `sub`, `email`, `email_verified` | ✅ Em claro |
| `name`, `given_name`, `family_name` | ✅ |
| `picture`, `locale` | ✅ |
| ⛔ `refresh_token`, `id_token`, sessão | ⛔ **Único grupo excluído** — o cookie faz o papel |

⭐ **PL28 resolvida por consequência:** com nome e sobrenome no banco, o digest pode saudar
pelo nome sem depender de decisão prévia.

#### 2.2.2 🔴 A exclusão da LGPD é um `DELETE` só

```sql
DELETE FROM usuario WHERE sub_hash = :hash;   -- CASCADE leva segue, consentimento e tokens
```

⭐ **Os `ON DELETE CASCADE` existem para isso.** O direito à eliminação (art. 18, VI) vira
uma linha — e não uma checklist de tabelas que alguém vai esquecer de atualizar.

⚠️ **`ON DELETE CASCADE` NÃO aparece em `segue.pessoa_id`, de propósito.** Apagar um
parlamentar da base não pode ser possível enquanto alguém o segue.

#### 2.2.3 ⭐ O campo `versao` do consentimento é o que salva na auditoria

> **Se você reescrever o texto do banner, os consentimentos antigos não cobrem o texto
> novo.** Guardar qual versão a pessoa aceitou é o que permite responder *"consentiu com o
> quê, exatamente?"* — que é a pergunta que a LGPD art. 8º §2 joga no seu colo.

⚠️ **O consentimento do Clarity NÃO entra nesta tabela** — ele acontece antes do login,
para um visitante anônimo. Ele vive no navegador. Só o opt-in de e-mail é registrado aqui,
porque só ele pressupõe conta.

---

## 3. AppHost do Aspire

```csharp
// src/Poligraph.AppHost/AppHost.cs
var builder = DistributedApplication.CreateBuilder(args);

// Postgres em container, senha gerada, volume persistente entre execuções
var pg = builder.AddPostgres("pg")
                .WithDataVolume()          // ⚠️ sem isto, perde o banco a cada F5
                .WithPgAdmin();

var db = pg.AddDatabase("poligraph");

// API C#
var api = builder.AddProject<Projects.Poligraph_Api>("api")
                 .WithReference(db)
                 .WaitFor(db);

// ETL Python — recebe a conexão por variável de ambiente
builder.AddPythonApp("etl", "../../etl", "main.py")
       .WithReference(db)
       .WaitFor(db)
       .WithExplicitStart();               // ⚠️ não roda junto com o F5

// Front React
builder.AddNpmApp("web", "../../web", "dev")
       .WithReference(api)
       .WithHttpEndpoint(env: "PORT")
       .WithExternalHttpEndpoints();

builder.Build().Run();
```

| Detalhe | Por quê |
|---|---|
| `.WithDataVolume()` | Sem isso o Postgres é efêmero e você recarrega 167 mil votos a cada F5 |
| `.WithExplicitStart()` | O ETL é job, não serviço — roda pelo dashboard quando você quiser |
| `.WaitFor(db)` | Evita corrida de inicialização |
| `.WithPgAdmin()` | Inspeção do banco sem instalar nada |

⚠️ **O Aspire é só desenvolvimento.** Em produção: Pages, App Service e Neon separados.

---

## 4. Estrutura do ETL Python

```
etl/
├── main.py                 # orquestra; lê CONNECTIONSTRINGS__poligraph do ambiente
├── config.py               # URLs, headers do TSE, constantes
├── extract/
│   ├── camara_csv.py       # CSVs anuais  → bronze
│   ├── camara_api.py       # ⚠️ só o CPF (644 chamadas)
│   ├── senado.py           # /votacao, filtra votacaoSecreta
│   ├── tse.py              # ⚠️ headers de navegador obrigatórios
│   └── noticias.py         # RSS
├── transform/
│   ├── normaliza_voto.py   # domínio → -1/0/1/NULL
│   ├── categoria.py        # regex na descrição (A2)
│   └── identidade.py       # join por CPF (C9)
├── analyze/
│   ├── matriz.py
│   ├── similaridade.py     # pairwise, corte de 20
│   ├── grafo.py            # kNN k=10 + Louvain
│   └── eixos.py            # SVD
└── load/
    └── copy.py             # ⚠️ COPY, nunca INSERT linha a linha
```

### 4.1 Os três parâmetros que evitam as armadilhas medidas

```python
# Câmara — RFC 4180 com quebra de linha embutida
df = pd.read_csv(path, sep=';', encoding='utf-8-sig',   # -sig remove o BOM
                 quotechar='"', dtype=str)               # tudo string na borda

# TSE — Latin-1, vírgula decimal, CPF com zero à esquerda
df = pd.read_csv(path, sep=';', encoding='latin-1',
                 dtype={'NR_CPF_CANDIDATO': str},        # 🔴 32% começam com zero
                 decimal=',',
                 na_values=['#NULO#', '#NE#', '-4', '-1', '-3'])
```

> 🔑 **Estas seis linhas são a razão da D1 ter migrado para Python.** Em C#, cada
> parâmetro vira código.

### 4.2 O TSE precisa dos headers completos

```python
TSE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',      # 🔴 obrigatório
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
}
# ⚠️ Se voltar 403, degradar para carga manual — o WAF pode endurecer a qualquer momento
```

---

## 5. Comandos de bootstrap

```bash
# .NET
dotnet new aspire-apphost -o src/Poligraph.AppHost
dotnet new webapi -minimal -o src/Poligraph.Api
dotnet new classlib -o src/Poligraph.Domain

# React
npm create vite@latest web -- --template react-ts

# Python
python -m venv etl/.venv
pip install pandas scipy networkx psycopg[binary] requests
```

---

## 6. Definição de pronto do passo 1

| # | Verificação |
|---|---|
| 1 | `dotnet run --project src/Poligraph.AppHost` sobe Postgres, API e React |
| 2 | O dashboard do Aspire mostra os quatro recursos saudáveis |
| 3 | O schema está aplicado (migration ou script) |
| 4 | `GET /api/health` responde 200 |
| 5 | O React carrega e chama a API sem erro de CORS |
| 6 | ⭐ **Um `CHECK` rejeita insert inválido** — ex.: `similaridade` com `n=5` |

O item 6 é o que prova que o princípio da §1 está funcionando.

---

## 7. Pendências

| # | Pendência |
|---|---|
| **PL13** | Escolher entre EF Core migrations e script SQL versionado |
| **PL14** | Definir a política de retenção de `execucao` (§9.6 dos contratos) |
| **PL15** | Decidir se `pessoa` guarda `casa` ou se ela fica só em `mandato` |
| **A2** | Escrever e validar as regex de `categoria` |
| ~~PL28~~ | ✅ Resolvida por consequência — nome e sobrenome estão no banco (§2.2.1) |
