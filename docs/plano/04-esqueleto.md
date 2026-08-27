# Esqueleto — AppHost, schema e estrutura do ETL

> **Status:** v1.4 — 2026-08-26
> Os dois artefatos do **passo 1** ([01-arquitetura §8](01-arquitetura.md)). Tudo aqui é
> derivado dos contratos medidos em [`04-contratos.md`](../04-contratos.md).
> **v1.4:** ✅ §2.4 — PL13 resolvida: **EF Core com migrations**. 🔴 Snake case obrigatório
> (o ETL Python lê as mesmas tabelas), `HasCheckConstraint` para preservar as regras
> medidas, e não chamar `Database.Migrate()` na subida por causa do zero-downtime.
> **v1.3:** §2.3 — o código COMPLETO da autenticação: Program.cs, os três endpoints, o
> repositório, o componente React e como provar por curl. São quatro arquivos.
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

> 🔴 **AVISO DE 2026-08-27 — os nomes de tabela abaixo estão NO SINGULAR e o banco usa o
> PLURAL.**
>
> O EF nomeia a tabela a partir do `DbSet` (`Pessoas` → `pessoas`), e este SQL foi
> escrito antes de o EF existir. ⛔ **Não copie daqui para escrever consulta.**
>
> | Aqui está | No banco é |
> |---|---|
> | `pessoa` | `pessoas` |
> | `votacao` · `voto` | `votacoes` · `votos` |
> | `pergunta` · `proposicao` | `perguntas` · `proposicoes` |
> | `similaridade` · `execucao` | `similaridades` · `execucoes` |
> | `aresta_grafo` · `no_metrica` | `arestas_grafo` · `nos_metrica` |
> | `usuario` · `consentimento` | `usuarios` · `consentimentos` |
>
> ⚠️ **Isto já custou caro:** o ETL Python inteiro foi escrito no singular e **nunca
> conseguiu falar com o banco** — 104 testes verdes contra um schema que não existia.
> Ver [`achados/`](../achados/README.md) e a PL36 em [`PENDENCIAS`](../PENDENCIAS.md).
>
> ⭐ **A fonte canônica do schema é `src/Poligraph.Api/Data/PoligraphDb.cs`**, e
> `src/etl/tests/test_contrato_schema.py` trava a divergência automaticamente. Este SQL
> permanece como **registro de desenho** — mostra as decisões e os `CHECK`, não o estado.

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

## 2.2b 🔄 O que mudou desde o desenho (2026-08-27)

⚠️ Acrescentado à medida que o produto foi construído. A fonte canônica continua sendo
`PoligraphDb.cs`; isto é o registro do **porquê**.

### Tabela nova: `despesas` — cota parlamentar (CEAP)

```sql
CREATE TABLE despesas (
    id                            BIGSERIAL PRIMARY KEY,
    pessoa_id                     BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    ano                           SMALLINT NOT NULL,
    mes                           SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    categoria                     TEXT NOT NULL,
    fornecedor                    TEXT,
    cnpj_ou_hash                  VARCHAR(64),   -- 🔴 ver abaixo
    fornecedor_eh_pessoa_fisica   BOOLEAN NOT NULL,
    valor_liquido                 NUMERIC(14,2) NOT NULL CHECK (valor_liquido <> 0),
    data_emissao                  DATE,
    url_documento                 TEXT
);
CREATE INDEX ix_despesa_pessoa_ano ON despesas (pessoa_id, ano);
```

🔴 **`cnpj_ou_hash` guarda duas coisas, e a flag diz qual.** O campo `txtCNPJCPF` do
arquivo da Câmara mistura CNPJ de empresa com **CPF em claro** de fornecedor pessoa
física. A RNF-13 proíbe o segundo, então o ETL aplica o mesmo hash de `cpf_hash` quando
detecta 11 dígitos.

⚠️ **E hashear os dois "por segurança" destruiria a análise:** CNPJ é dado público de
empresa, e sem ele não dá para cruzar o mesmo fornecedor entre parlamentares.

⭐ `valor_liquido <> 0` e não `> 0`: **valor negativo é estorno**, e somá-lo importa.

📐 Fonte e armadilhas em [`14-fontes-de-gasto`](../14-fontes-de-gasto.md).

### Colunas novas em `pessoas`

```sql
ALTER TABLE pessoas ADD COLUMN url_foto    TEXT;
ALTER TABLE pessoas ADD COLUMN excluido_em TIMESTAMPTZ;
```

| Coluna | Por quê |
|---|---|
| `url_foto` | 🔴 Guardamos a **URL**, ⛔ não a imagem — *linkar* e *rehospedar* são atos diferentes perante licença e LGPD |
| `excluido_em` | Exclusão **lógica** — ver §2.2c |

### Colunas novas em `nos_metrica`

```sql
ALTER TABLE nos_metrica ADD COLUMN componente1 REAL;
ALTER TABLE nos_metrica ADD COLUMN componente2 REAL;
```

🔴 **`componente1`, SEM underscore antes do dígito.** O snake_case do EF quebra por
MAIÚSCULA, e `Componente1` não tem nenhuma antes do `1`. Escrever `componente_1` no SQL
do Python dá `UndefinedColumn` — **aconteceu**, e o teste de contrato não pegava porque
travava nomes de tabela e não de coluna.

📐 O que cada eixo significa: [`plano/07 §3.6`](07-grafo-e-afinidade.md).

### 🔴 Chaves estrangeiras que faltavam

```sql
ALTER TABLE nos_metrica   ADD FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE CASCADE;
ALTER TABLE arestas_grafo ADD FOREIGN KEY (pessoa_a)  REFERENCES pessoas(id) ON DELETE CASCADE;
ALTER TABLE arestas_grafo ADD FOREIGN KEY (pessoa_b)  REFERENCES pessoas(id) ON DELETE CASCADE;
ALTER TABLE similaridades ADD FOREIGN KEY (pessoa_a)  REFERENCES pessoas(id) ON DELETE CASCADE;
ALTER TABLE similaridades ADD FOREIGN KEY (pessoa_b)  REFERENCES pessoas(id) ON DELETE CASCADE;
```

⚠️ **O furo apareceu de verdade.** Ao remover 12 parlamentares fictícios, seus nós
ficaram em `nos_metrica` sem ninguém do outro lado, e **o grafo desenhou 12 pontos sem
nome**. Nada acusou — o banco aceitou calado.

⭐ **E a migration precisou LIMPAR antes de criar a chave**, senão não aplicava: o
Postgres recusa FK sobre dado que já a viola. A migration falhava, o projeto de migrations
morria, e o `WaitForCompletion` do Aspire travava a API atrás dele.

> 🔑 A ironia vale registro: a migration não aplicava por causa da sujeira que ela própria
> existe para impedir.

---

## 2.2c 🔴 Exclusão: lógica por padrão, física para dado pessoal

**Padrão do projeto: exclusão LÓGICA.** `pessoas.excluido_em` + filtro global de consulta
no EF — quem é excluído some de toda consulta sem que cada endpoint lembre do filtro.

⭐ Parlamentar ⛔ **nunca** é apagado de verdade: o voto dele é registro histórico, e o
`DELETE` físico levaria junto — por `CASCADE` — o nó no grafo, as arestas e as
similaridades de **toda execução já feita**, inclusive as que a banca pode reproduzir.

### 🔴 Duas exceções, e são jurídicas

| Onde | Comportamento | Por quê |
|---|---|---|
| `usuarios` (`ExcluirContaAsync`) | **DELETE físico** | LGPD art. 18, VI dá direito à **eliminação**, ⛔ não à ocultação. Marcar `excluido_em` e manter a linha seria dizer ao cidadão que os dados foram apagados enquanto continuam no banco |
| `segue` (`DeixarDeSeguirAsync`) | **DELETE físico** | É **registro de convicção política** (art. 5º, II). Exclusão lógica guardaria justamente o que a pessoa pediu para desfazer |

> 🔴 **Regra para tabela nova:** se guarda dado **pessoal**, o `DELETE` é físico.

⚠️ **O ETL Python ⛔ não enxerga o filtro global** — ele fala SQL direto. É proposital: a
análise trabalha sobre o registro histórico completo, e é a API que decide o que mostrar.

---

## 2.3 🔴 Autenticação — o código completo

> Responde *"não entendi como isso será feito tecnicamente"*. Aqui está tudo que existe:
> **quatro arquivos**, nada além.

### 2.3.1 `Program.cs` — a configuração inteira

```csharp
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

// 🔴 Sem isto, todo redeploy desloga todo mundo (PL30)
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/keys"))
    .SetApplicationName("poligraph");

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name         = "sid";
        o.Cookie.HttpOnly     = true;               // JS não lê
        o.Cookie.SameSite     = SameSiteMode.Lax;
        o.ExpireTimeSpan      = TimeSpan.FromDays(7);
        o.SlidingExpiration   = true;
        o.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest      // ⚠️ senão quebra em http://localhost
            : CookieSecurePolicy.Always;

        // 🔴 É uma API: responder 401/403, não redirecionar para tela de login
        o.Events.OnRedirectToLogin =
            c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied =
            c => { c.Response.StatusCode = 403; return Task.CompletedTask; };

        // ⭐ A 4ª conferência: a sessão foi revogada? (02 §3.2.4)
        o.Events.OnValidatePrincipal = async c =>
        {
            var id = long.Parse(c.Principal!.FindFirstValue("usuario_id")!);
            var sv = int.Parse(c.Principal.FindFirstValue("sessao_versao")!);
            var repo = c.HttpContext.RequestServices.GetRequiredService<UsuarioRepo>();
            if (await repo.SessaoVersaoAsync(id) != sv)
            {
                c.RejectPrincipal();
                await c.HttpContext.SignOutAsync();
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<UsuarioRepo>();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
```

⚠️ **`OnRedirectToLogin` não é detalhe.** Sem ele, uma chamada sem cookie devolve **302
para uma página que não existe** — e o front recebe HTML onde esperava JSON. É o bug de
uma hora perdida.

### 2.3.2 Os três endpoints

```csharp
record LoginRequest(string IdToken);

// ─── 1. LOGIN — o único lugar onde o id_token do Google aparece ───────────
app.MapPost("/api/auth/google", async (
    LoginRequest req, HttpContext ctx, UsuarioRepo repo, IConfiguration cfg) =>
{
    GoogleJsonWebSignature.Payload payload;
    try
    {
        payload = await GoogleJsonWebSignature.ValidateAsync(req.IdToken,
            new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [cfg["Google:ClientId"]!]   // 🔴 a conferência do `aud`
            });
    }
    catch (InvalidJwtException) { return Results.Unauthorized(); }

    var u = await repo.UpsertAsync(payload);          // grava o perfil (02 §3.5.1)

    await ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(
        [ new Claim("usuario_id",    u.Id.ToString()),
          new Claim("sessao_versao", u.SessaoVersao.ToString()) ],
        CookieAuthenticationDefaults.AuthenticationScheme)));
    // ⬆️ é este SignInAsync que emite o Set-Cookie assinado. O id_token morre aqui.

    return Results.Ok(new { u.Nome, u.FotoUrl });
});

// ─── 2. ENDPOINT PROTEGIDO — a validação já ocorreu antes de entrar ───────
app.MapGet("/api/seguidos", async (ClaimsPrincipal user, SegueRepo repo) =>
    Results.Ok(await repo.ListarAsync(long.Parse(user.FindFirstValue("usuario_id")!)))
).RequireAuthorization();

// ─── 3. LOGOUT ────────────────────────────────────────────────────────────
app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
{
    await ctx.SignOutAsync();
    return Results.NoContent();
});
```

> 🔑 **Onde está a "verificação da assinatura" da qual falamos?**
> **Dentro do `.RequireAuthorization()`.** O ASP.NET lê o cookie, recalcula a assinatura,
> confere a expiração e dispara o `OnValidatePrincipal` — tudo antes de a sua função rodar.
> **Você não escreve essa parte.**

### 2.3.3 O repositório

```csharp
public class UsuarioRepo(NpgsqlConnection conn)
{
    public Task<Usuario> UpsertAsync(GoogleJsonWebSignature.Payload p) =>
        conn.QuerySingleAsync<Usuario>("""
            INSERT INTO usuario (google_sub, email, email_verificado, nome,
                                 primeiro_nome, sobrenome, foto_url, locale)
            VALUES (@Subject, @Email, @EmailVerified, @Name,
                    @GivenName, @FamilyName, @Picture, @Locale)
            ON CONFLICT (google_sub) DO UPDATE SET
                email = EXCLUDED.email, email_verificado = EXCLUDED.email_verificado,
                nome  = EXCLUDED.nome,  primeiro_nome    = EXCLUDED.primeiro_nome,
                sobrenome = EXCLUDED.sobrenome, foto_url = EXCLUDED.foto_url,
                locale = EXCLUDED.locale, visto_em = now()
            RETURNING id, nome, foto_url AS FotoUrl, sessao_versao AS SessaoVersao;
            """, p);

    public Task<int> SessaoVersaoAsync(long id) =>
        conn.QuerySingleAsync<int>(
            "SELECT sessao_versao FROM usuario WHERE id = @id", new { id });
}
```

⭐ **O `payload` do Google entra direto como parâmetro do Dapper** — os nomes das
propriedades (`Subject`, `Email`, `GivenName`…) casam com os `@` da query.

### 2.3.4 O front — um componente

`index.html`:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

`BotaoGoogle.tsx`:

```tsx
export function BotaoGoogle() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (resp: { credential: string }) => {
        await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: resp.credential }),  // ⬅️ passo 4
          credentials: "include",
        });
        location.reload();          // agora o cookie existe
      },
    });
    window.google.accounts.id.renderButton(ref.current!,
      { theme: "outline", size: "large", text: "signin_with" });
  }, []);

  return <div ref={ref} />;
}
```

E qualquer chamada protegida daí em diante:

```tsx
const r = await fetch("/api/seguidos", { credentials: "include" });
if (r.status === 401) mostrarBotaoDeLogin();
```

⛔ **Não existe** `localStorage.setItem("token", …)`, nem header `Authorization`, nem
lógica de renovação. **O navegador cuida do cookie.**

### 2.3.5 ⭐ Sirva front e API na MESMA origem

| Arranjo | Consequência |
|---|---|
| ⭐ `poligraph.com.br` + `poligraph.com.br/api` | ✅ Mesma origem: **sem CORS**, `SameSite=Lax` funciona |
| `poligraph.com.br` + `api.poligraph.com.br` | ⛔ *Cross-site*: exige `SameSite=None`, CORS com `AllowCredentials` e origem explícita |

> 🔑 **O Traefik já roteia por caminho** ([01-arquitetura §2.1.1](01-arquitetura.md)).
> Mandar `/api/*` para o container da API **elimina uma classe inteira de problema de
> cookie** — e é uma linha de configuração.

### 2.3.6 Configuração e segredos

| Chave | Onde | Secreto? |
|---|---|---|
| `Google:ClientId` | ⭐ **Um por ambiente** — `appsettings.Development.json` e env var do Coolify | ⛔ Não — é público |
| `VITE_GOOGLE_CLIENT_ID` | 🔴 **Build arg** do Dockerfile do front, não env var | ⛔ Não |
| Chaves do Data Protection | 🔴 Volume `/keys` no Coolify | ✅ Sim (PL30) |
| `ConnectionStrings:Postgres` | Variável de ambiente no Coolify | ✅ Sim |

⛔ **Não existe `Google:ClientSecret`** — este fluxo não usa (02 §3.4.0).

### 2.3.7 Como provar que funciona, sem front

```bash
# 1. pegue um id_token real em https://developers.google.com/oauthplayground
curl -i -X POST http://localhost:5000/api/auth/google \
     -H "Content-Type: application/json" \
     -d "{\"idToken\":\"eyJhbGci...\"}" -c cookies.txt   # salva o cookie

# 2. use o cookie salvo
curl -i http://localhost:5000/api/seguidos -b cookies.txt   # → 200

# 3. sem o cookie
curl -i http://localhost:5000/api/seguidos                  # → 401
```

⭐ **Esses três comandos provam o mecanismo inteiro** — e viram teste de integração.

---
## 2.4 ✅ EF Core e migrations — PL13 resolvida (2026-08-26)

> **Decisão do autor:** usar **EF Core** com as **migrations do próprio EF**, em vez de
> script SQL versionado à mão.

### 2.4.1 🔴 O primeiro problema: o ETL é Python e lê as mesmas tabelas

Esta não é uma decisão só de .NET. **Duas linguagens compartilham o mesmo banco:**

| Quem | Faz o quê |
|---|---|
| ⭐ **EF Core** | **Dono do schema.** Cria e evolui as tabelas via migration |
| 🐍 **ETL Python** | ⛔ **Nunca cria tabela.** Só `INSERT` / `SELECT` no schema pronto |

> 🔑 **Regra:** se o Python precisar de uma coluna, a coluna nasce numa migration do EF.
> **Duas ferramentas criando schema no mesmo banco é receita de divergência silenciosa.**

#### ⚠️ E daí sai a configuração que não pode faltar

Por padrão o EF gera nomes em **PascalCase** — `PessoaFonteId`, `VotacaoId`. O schema
documentado (e o código Python) usa **snake_case**. Sem isto, o ETL quebra:

```bash
dotnet add package EFCore.NamingConventions
```

```csharp
builder.Services.AddDbContext<PoligraphDb>(o => o
    .UseNpgsql(cfg.GetConnectionString("Postgres"))
    .UseSnakeCaseNamingConvention());     // 🔴 pessoa_fonte_id, não PessoaFonteId
```

### 2.4.2 Pacotes

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package EFCore.NamingConventions
dotnet add package Microsoft.EntityFrameworkCore.Design   # só no projeto de migrations
dotnet tool install --global dotnet-ef
```

### 2.4.3 As entidades — e como as regras medidas viram *constraint*

O princípio da §1 continua valendo: **onde a regra medida puder virar `CHECK`, ela vira.**
No EF isso mora na Fluent API.

```csharp
public class PoligraphDb(DbContextOptions<PoligraphDb> o) : DbContext(o)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Segue> Segues => Set<Segue>();
    public DbSet<Voto> Votos => Set<Voto>();
    public DbSet<Similaridade> Similaridades => Set<Similaridade>();
    public DbSet<Pergunta> Perguntas => Set<Pergunta>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // ── USUÁRIO ────────────────────────────────────────────────
        b.Entity<Usuario>(e =>
        {
            e.HasIndex(x => x.GoogleSub).IsUnique();
            e.Property(x => x.Email).IsRequired();
            e.Property(x => x.SessaoVersao).HasDefaultValue((short)0);
            e.Property(x => x.CriadoEm).HasDefaultValueSql("now()");
        });

        b.Entity<Segue>(e =>
        {
            e.HasKey(x => new { x.UsuarioId, x.PessoaId });
            e.HasOne(x => x.Usuario).WithMany(u => u.Segue)
                .OnDelete(DeleteBehavior.Cascade);       // ⭐ exclusão LGPD em 1 DELETE
            e.HasOne(x => x.Pessoa).WithMany()
                .OnDelete(DeleteBehavior.Restrict);      // ⛔ nunca apagar parlamentar seguido
            e.HasIndex(x => x.PessoaId);
        });

        // ── VOTO — RN-03: domínio fechado ──────────────────────────
        b.Entity<Voto>(e =>
        {
            e.HasKey(x => new { x.VotacaoId, x.PessoaId });
            e.ToTable(t => t.HasCheckConstraint(
                "ck_voto_valor", "valor IN (-1, 0, 1)"));
        });

        // ── SIMILARIDADE — RN-02 e I3 ──────────────────────────────
        b.Entity<Similaridade>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Metrica });
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_sim_minimo",  "n_votacoes_comuns >= 20");
                t.HasCheckConstraint("ck_sim_ordem",   "pessoa_a < pessoa_b");
                t.HasCheckConstraint("ck_sim_valor",   "valor BETWEEN 0 AND 1");
            });
        });

        // ── PERGUNTA — 🔴 o campo mais perigoso do sistema ──────────
        b.Entity<Pergunta>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint(
                "ck_pergunta_polaridade", "polaridade IN (-1, 1)"));
            e.Property(x => x.Polaridade).IsRequired();
            e.HasIndex(x => x.VotacaoId).IsUnique();
        });

        // ── CONSENTIMENTO — um vivo por finalidade ─────────────────
        b.Entity<Consentimento>(e =>
            e.HasIndex(x => new { x.UsuarioId, x.Finalidade })
             .IsUnique()
             .HasFilter("revogado_em IS NULL"));         // índice parcial
    }
}
```

⭐ **`HasCheckConstraint` é o que preserva o princípio do §1 dentro do EF.** Sem ele, as
regras medidas viram comentário — e comentário não rejeita `INSERT` errado.

### 2.4.4 🔴 A armadilha do `timestamptz`

> **O Npgsql exige `DateTime` com `Kind = Utc` para colunas `timestamptz`.** Um
> `DateTime.Now` estoura em runtime com *"Cannot write DateTime with Kind=Local"*.

| ⛔ Errado | ✅ Certo |
|---|---|
| `DateTime.Now` | `DateTime.UtcNow` |
| `DateTime` sem `Kind` vindo de parse | `DateTimeOffset`, ou `DateTime.SpecifyKind(x, DateTimeKind.Utc)` |

⭐ **Solução mais simples: use `DateTimeOffset` nas entidades.** Mapeia direto para
`timestamptz` e não deixa margem para erro.

### 2.4.5 O ciclo das migrations

```bash
# criar
dotnet ef migrations add InicialComUsuario -p src/Poligraph.Api

# ver o SQL antes de aplicar (⭐ sempre)
dotnet ef migrations script --idempotent -o migration.sql

# aplicar localmente
dotnet ef database update
```

### 2.4.6 🔴 Não chame `Database.Migrate()` na subida da API

Parece prático e quebra exatamente no arranjo escolhido:

> **O deploy zero-downtime do Coolify sobe o container novo ANTES de derrubar o antigo**
> ([05-cicd §2.1](05-cicd-e-deploy.md)). Por alguns segundos existem **duas instâncias** —
> e `Migrate()` não é seguro para execução concorrente.

| Abordagem | Veredito |
|---|---|
| `Database.Migrate()` no `Program.cs` | ⛔ Corrida entre containers no deploy |
| ⭐ **Scheduled Task / comando do Coolify**, rodado antes do deploy | ✅ Um executor só |
| Script `--idempotent` aplicado à mão | 🟡 Seguro, mas manual |

⭐ **Como o ETL já roda como Scheduled Task, o padrão já existe no projeto** — é só mais um
comando na mesma infraestrutura.

### 2.4.7 O que muda no documento

| | |
|---|---|
| O SQL da §2 e §2.2 | ⭐ **Continua sendo a especificação** — é o alvo que a migration precisa produzir |
| ⚠️ Conferência obrigatória | Rodar `dotnet ef migrations script` e **comparar com o SQL documentado** |
| Se divergir | O SQL documentado está certo até prova em contrário — ele veio de contrato medido |

> 🔑 **A migration não substitui o schema documentado; ela o implementa.** O `CHECK` de
> `n_votacoes_comuns >= 20` não é preferência de estilo: veio de medição
> ([04-contratos](../04-contratos.md)), e sumir dele na tradução para EF é regressão
> silenciosa.

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
| ~~PL13~~ | ✅ **EF Core migrations** (§2.4) — decisão do autor, 2026-08-26 |
| **PL14** | Definir a política de retenção de `execucao` (§9.6 dos contratos) |
| **PL15** | Decidir se `pessoa` guarda `casa` ou se ela fica só em `mandato` |
| **A2** | Escrever e validar as regex de `categoria` |
| ~~PL28~~ | ✅ Resolvida por consequência — nome e sobrenome estão no banco (§2.2.1) |
