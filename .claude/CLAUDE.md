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

Todas em português, em `.claude/skills/`. Invoque com a ferramenta Skill.

| Skill | Quando usar |
|---|---|
| ⭐ **`padroes-codigo`** | **Sempre que escrever C#** — nomenclatura, ordem dos membros, estilo |
| **`arquitetura`** | Estruturar projeto, criar endpoint, avaliar se vale um padrão novo |
| **`revisao-codigo`** | Revisar C# — começa pelas 5 verificações do projeto |
| **`testes`** | xUnit e Testcontainers. Contém o teste de polaridade (API3) |
| **`docker-e-aspire`** | Dockerfile, AppHost, migrations, `WaitForCompletion` |

**Comando:** `/revisar <caminho>`

> ⚠️ **Foram reescritas a partir das originais em inglês (MIT), não traduzidas ao pé da
> letra.** As originais assumiam Clean Architecture + CQRS + Repository, que este projeto
> decidiu não usar. Seguir aquilo geraria código que contraria o plano.

---

## Stack decidida

| Camada | Escolha |
|---|---|
| Front | React + Vite, nginx |
| API | **C# · ASP.NET Core Minimal API** · **.NET 10 · C# 14** |
| ORM | **EF Core + migrations** (PL13) |
| ETL e análise | **Python** — pandas, scipy, networkx |
| Banco | PostgreSQL em container |
| Hospedagem | **VPS Hostinger KVM 2 + Coolify**, São Paulo |
| Borda | Cloudflare (DNS, CDN, WAF, TLS) |
| Dev local | **Aspire 13** — AppHost + ServiceDefaults |
| Estrutura | **Tier 2 sem MediatR** — `Api` + `Tests` + `AppHost` |
| Testes | xUnit + **Testcontainers** (Postgres real) |

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
| ⛔ **A API nunca migra** | Quem migra é o projeto `Poligraph.Migrations` |

### Migrations

| Ambiente | O que acontece |
|---|---|
| ⭐ `Environment != Production` | `MigrateAsync()` + **seed de dados de teste** (se ainda não existirem) |
| 🔴 `Production` | Fluxo externo: o CI **gera e valida** o script; o **VPS aplica**, antes do deploy |

⛔ **Nunca `HasData()` para dado de teste** — ele entra na migration e semearia produção.
⚠️ **Mudança destrutiva leva dois deploys** (expandir → migrar → contrair).

### Python (ETL)

```python
df = pd.read_csv(path, sep=';', encoding='utf-8-sig', quotechar='"', dtype=str)
```

⚠️ **Os CSVs da Câmara têm quebras de linha dentro de campos.** Parsing ingênuo por linha
inflou a contagem em 8,8% — ver [`04-contratos`](docs/04-contratos.md).

### C# — resumo

📐 **Detalhe completo na skill `padroes-codigo`.**

| O quê | Padrão |
|---|---|
| Classes, métodos e propriedades públicas | **PascalCase** |
| ⭐ Campos privados e serviços injetados | **`_camelCase`** |
| 🔴 Ordem dos membros | **Públicos no topo · privados abaixo, na ordem de uso** |
| Idioma | **Português** — `ServicoAfinidade`, `CalcularAsync` |
| Datas | **`DateTimeOffset`**, nunca `DateTime` |

⛔ Sem `MediatR`, sem `Repository<T>`, sem camadas Domain/Application/Infra, sem AutoMapper.

---

## Comandos

```bash
dotnet run --project src/Poligraph.AppHost      # sobe tudo (Aspire)
dotnet ef migrations add <Nome> -p src/Poligraph.Api
docker compose run --rm migracoes                # aplica em produção (dentro do VPS)
dotnet ef migrations script --idempotent        # ⭐ conferir ANTES de aplicar
dotnet test                                     # inclui o teste de polaridade
```

---

## Estado atual

**Fase de planejamento — zero linha de código.** ~28 documentos, ~11 mil linhas, 62
pendências resolvidas e 54 abertas.

> 🔴 **O maior bloqueio não é técnico:** a **PL11** — curar 15–25 perguntas do questionário
> — é leitura humana de ementa por ementa, não escala e trava o passo 8. **Comece cedo.**
