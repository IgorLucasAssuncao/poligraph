# CLAUDE.md — poligraph

> TCC: **"Arquitetura ETL e Modelagem em Grafos para Recomendação de Notícias e Mensuração
> de Afinidade Política em Redes Sociais"**
>
> Afinidade política medida por **comportamento revelado de voto** — não por
> autodeclaração ideológica.

---

## 🔴 Leia antes de qualquer coisa

| Documento | Por quê |
|---|---|
| [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) | O que está aberto e o que bloqueia |
| [`docs/plano/01-arquitetura.md`](docs/plano/01-arquitetura.md) **§8** | A ordem de construção |
| [`docs/plano/04-esqueleto.md`](docs/plano/04-esqueleto.md) | Schema, EF Core e código de auth |
| [`docs/04-contratos.md`](docs/04-contratos.md) | **Cardinalidades medidas** — a fonte da verdade |

> ⚠️ **Regra metodológica do projeto, escrita depois de errar várias vezes:**
> **medir um ano e generalizar foi a origem de quase todos os erros cometidos aqui.**
> Antes de afirmar um número, meça — e diga sobre qual período.

---

## Skills disponíveis

Instaladas em `.claude/skills/`. Invoque com a ferramenta Skill.

| Skill | Quando usar |
|---|---|
| **`dotnet-code-review`** | Revisar C#: SOLID, performance, segurança, C# moderno |
| **`dotnet-architecture`** | Escolher padrão de arquitetura — ⚠️ ler a ressalva abaixo |
| **`dotnet-testing`** | xUnit, Testcontainers, Moq, TDD |

**Comandos** em `.claude/commands/`: `/dotnet-review <path>` · `/new-feature <Nome>`

### ⚠️ Ressalva sobre a `dotnet-architecture` e a `/new-feature`

Elas assumem **Clean Architecture + CQRS com MediatR + Repository**. **Este projeto
decidiu o contrário**, e por um critério explícito:

> **[`plano/01 §1`](docs/plano/01-arquitetura.md): "Quanto tempo isso rouba de escrever o
> TCC?"** — Minimal API, sem camadas, sem MediatR.

⭐ **A própria skill concorda:** *"the mark of a senior architect is knowing when NOT to
over-engineer"*. Use-a para **avaliar trade-offs**, não como template a seguir. O
`/new-feature` gera estrutura CQRS que **não corresponde a este projeto** — trate como
referência, não como scaffold.

---

## Stack decidida

| Camada | Escolha |
|---|---|
| Front | React + Vite, nginx |
| API | **C# · ASP.NET Core Minimal API** |
| ORM | **EF Core + migrations** (PL13) |
| ETL e análise | **Python** — pandas, scipy, networkx |
| Banco | PostgreSQL em container |
| Hospedagem | **VPS Hostinger KVM 2 + Coolify**, São Paulo |
| Borda | Cloudflare (DNS, CDN, WAF, TLS) |
| Dev local | .NET Aspire |

---

## 🔴 Regras deste projeto que sobrepõem qualquer skill

### 1. Polaridade é o campo mais perigoso do sistema

Em **14% das votações nominais**, "Sim" significa **rejeitar** (destaques). Um sinal
invertido **não aparece na tela** — aparece como um número plausível e errado.

> **Nenhuma mudança que toque cálculo de afinidade entra sem o teste de regressão de
> polaridade (API3).**

### 2. Nenhum token é armazenado

| ⛔ Nunca no banco | Por quê |
|---|---|
| `id_token` do Google | Validado e descartado |
| `refresh_token` | Não existe neste fluxo |
| Token de sessão | O cookie é assinado, verificado por assinatura |
| Senha | A autenticação é sempre delegada ao Google |

Ver [`plano/02 §3.6`](docs/plano/02-autenticacao-e-metricas.md).

### 3. Dado sensível — LGPD art. 5º, II

A tabela `segue` é **registro de convicção política**. Toda mudança que a toque precisa
respeitar consentimento específico (RNF-12b) e o endpoint de exclusão (art. 18).

⛔ **Nunca renderizar CPF.** A coluna é `cpf_hash`.

### 4. Regra medida vira *constraint*, não comentário

> **Onde a regra puder virar `CHECK`, `UNIQUE` ou `FK`, ela vira.**

Um bug que o banco rejeita custa minutos; um que ele aceita custa um capítulo do TCC. No EF
Core isso significa **`HasCheckConstraint`** — ver [`plano/04 §2.4`](docs/plano/04-esqueleto.md).

---

## Convenções técnicas

### EF Core

```csharp
.UseNpgsql(cs).UseSnakeCaseNamingConvention()   // 🔴 o ETL Python lê as mesmas tabelas
```

| Regra | Motivo |
|---|---|
| 🔴 **snake_case obrigatório** | PascalCase quebra o ETL Python |
| 🔴 **EF é dono do schema** | O Python nunca cria tabela |
| ⭐ **`DateTimeOffset`**, não `DateTime` | `timestamptz` do Npgsql exige `Kind=Utc` |
| ⛔ **Não chamar `Database.Migrate()` na subida** | Zero-downtime sobe dois containers |

### Python (ETL)

```python
df = pd.read_csv(path, sep=';', encoding='utf-8-sig', quotechar='"', dtype=str)
```

⚠️ **Os CSVs da Câmara têm quebras de linha dentro de campos.** Parsing ingênuo por linha
inflou a contagem em 8,8% — ver [`04-contratos`](docs/04-contratos.md).

### C#

- `Minimal API`, sem controllers
- `record` para DTOs
- `CancellationToken` em todo método assíncrono
- Nullable reference types ligado
- ⛔ Sem `MediatR`, sem `Repository<T>` genérico, sem camadas Application/Domain/Infra

---

## Comandos

```bash
dotnet run --project src/Poligraph.AppHost      # sobe tudo (Aspire)
dotnet ef migrations add <Nome> -p src/Poligraph.Api
dotnet ef migrations script --idempotent        # ⭐ conferir ANTES de aplicar
dotnet test                                     # inclui o teste de polaridade
```

---

## Estado atual

**Fase de planejamento — zero linha de código.** ~28 documentos, ~11 mil linhas, 62
pendências resolvidas e 54 abertas.

> 🔴 **O maior bloqueio não é técnico:** a **PL11** — curar 15–25 perguntas do questionário
> — é leitura humana de ementa por ementa, não escala e trava o passo 8. **Comece cedo.**
