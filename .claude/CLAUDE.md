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
| [`docs/PENDENCIAS.md`](../docs/PENDENCIAS.md) | O que está aberto e o que bloqueia |
| [`docs/plano/01-arquitetura.md`](../docs/plano/01-arquitetura.md) **§8** | A ordem de construção |
| [`docs/plano/04-esqueleto.md`](../docs/plano/04-esqueleto.md) | Schema, EF Core e código de auth |
| [`docs/04-contratos.md`](../docs/04-contratos.md) | **Cardinalidades medidas** — a fonte da verdade |
| 📖 [`docs/glossario.md`](../docs/glossario.md) | **Termos e como se ligam** — e os pares que já viraram bug |

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
| 🎨 **`design-visual`** | **Sempre que mexer em tela, componente ou CSS** — paleta, tipografia, o painel |

**Comando:** `/revisar <caminho>`

> ⚠️ **Foram reescritas a partir das originais em inglês, não traduzidas ao pé da
> letra.** As de C# (`dotnet-claude-skills`, MIT) assumiam Clean Architecture + CQRS +
> Repository, que este projeto decidiu não usar — seguir aquilo geraria código que
> contraria o plano. A `design-visual` vem de `anthropics/skills/frontend-design`
> (Apache 2.0), que pede inventar uma direção do zero a cada página; aqui a direção já
> foi escolhida e está fixada na própria skill.

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
| Estrutura | **Tier 2 sem MediatR** — `Api` + `Data` + `Tests` + `AppHost` |
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
| Token de sessão | O cookie é cifrado e autenticado (Data Protection do ASP.NET: AES-256-CBC + HMAC-SHA256); nada de sessão no banco |
| Senha | A autenticação é sempre delegada ao Google |

Ver [`plano/02 §3.6`](../docs/plano/02-autenticacao-e-metricas.md).

### 3. Dado sensível — LGPD art. 5º, II

A tabela `segue` é **registro de convicção política**. Toda mudança que a toque precisa
respeitar consentimento específico (RNF-12b) e o endpoint de exclusão (art. 18).

⛔ **Nunca renderizar CPF.** A coluna é `cpf_hash`: **HMAC-SHA256 com chave secreta**, ⛔ nunca SHA-256 puro, que se reverte em minutos (PL77). Perder a chave é perder a conciliação; trocá-la exige `rechavear-cpf`.

### 4. Regra medida vira *constraint*, não comentário

> **Onde a regra puder virar `CHECK`, `UNIQUE` ou `FK`, ela vira.**

Um bug que o banco rejeita custa minutos; um que ele aceita custa um capítulo do TCC. No EF
Core isso significa **`HasCheckConstraint`** — ver [`plano/04 §2.4`](../docs/plano/04-esqueleto.md).

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
| ⛔ **A API nunca migra** | Quem migra é o projeto `Poligraph.Data` |

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
inflou a contagem em 8,8% — ver [`04-contratos`](../docs/04-contratos.md).

### C# — resumo

📐 **Detalhe completo na skill `padroes-codigo`.**

| O quê | Padrão |
|---|---|
| Classes, métodos e propriedades públicas | **PascalCase** |
| ⭐ Campos privados e serviços injetados | **`_camelCase`** |
| 🔴 Ordem dos membros | **Públicos no topo · privados abaixo, na ordem de uso** |
| Idioma | **Português** — `ServicoAfinidade`, `CalcularAsync` |
| 🔴 Comentários | **`///` no membro, ⛔ nunca `//` no meio do corpo** |
| 🔴 No código-fonte | ⛔ **Sem emoji e sem carga emocional.** Ver *Comentários em todo o código*, abaixo |
| Datas | **`DateTimeOffset`**, nunca `DateTime` |

⛔ Sem `MediatR`, sem `Repository<T>`, sem camadas Domain/Application/Infra, sem AutoMapper.

### Comentários em todo o código — C#, TypeScript, CSS e Python

> **Decisão do autor (2026-10-02).** Vale para todo arquivo de código, e para todo
> comentário novo. Os 565 comentários de dentro de corpos do front foram movidos para o
> JSDoc das declarações, e os ~2.500 marcadores emoji do código viraram palavras.

| Regra | Como |
|---|---|
| **Só o equivalente ao `summary`** | C#: `///` no membro. TypeScript: **`/** */` na declaração** — função, componente, tipo, constante de módulo, propriedade de tipo. Python: docstring |
| **Nunca comentário dentro do corpo** | Sem `//` nem `/* */` dentro de função, sem `{/* */}` no JSX, sem comentário no fim da linha. O porquê vai para o JSDoc da declaração dona do trecho |
| **Sem emoji** | Nem em comentário, nem em teste, nem em log |
| **Palavras reservadas no lugar dos marcadores** | `RISCO:` (era o vermelho) · `ATENÇÃO:` · `DECISÃO:` · `MEDIDO:` (número medido, com a data) · `FEITO:` |
| Exceções | Diretivas de ferramenta (`eslint-disable…`, `@ts-expect-error`) ficam onde a ferramenta exige. Símbolos que aparecem para o usuário (✓, ✕) são interface, ⛔ comentário |

Checagem de tipos do front: **`npx tsc -b`** (o mesmo do `npm run build`). ⚠️ `tsc -p .`
⛔ checa nada: o `tsconfig.json` da raiz tem `"files": []`.

---

## Comandos

```bash
dotnet run --project src/Poligraph.AppHost      # sobe tudo (Aspire)
dotnet ef migrations add <Nome> -p src/Poligraph.Data   # 🔴 NÃO a API
docker compose run --rm migracoes                # aplica em produção (dentro do VPS)
dotnet ef migrations script --idempotent        # ⭐ conferir ANTES de aplicar
dotnet test                                     # inclui o teste de polaridade
```

📖 **A ETL tem manual próprio:** [`src/etl/README.md`](../src/etl/README.md) — os comandos, a
ordem, as variáveis de ambiente e a carga do zero. `py -m poligraph_etl <comando> --help`
mostra os argumentos de cada um.

---

## Estado atual — 2026-08-27

**Aplicação de ponta a ponta rodando localmente, com dado REAL.**
`dotnet run --project src/Poligraph.AppHost` sobe Postgres, migrations, API e front; o
ETL fica como botão no painel, esperando você mandar rodar.

| Parte | Onde está |
|---|---|
| API | Afinidade, parlamentares, ficha, **gastos, emendas, financiamento**, legislaturas, seguir, auth Google, avaliação |
| Front | Login, início, explorar, seguindo, perfil, questionário, conta, privacidade |
| ETL | `ingerir` · `analisar` · `cpf` · `cota` · `emendas` · `fundo` · `validar` |
| Testes | **300 .NET** (Testcontainers com Postgres real) · **562 Python** · **235 front** — conferido em 2026-10-02 |

⭐ **O seed foi aposentado** (PL41). O dado local é a Câmara de verdade. 📐 Conferido
contra o banco em **2026-09-08**:

| | |
|---|---:|
| Votos da 57ª — Câmara · Senado | **470.727** · **34.101** |
| Quem votou na 57ª — deputados · senadores | **643** · **104** |
| Despesas de cota | **844.279** — CEAP 767.692 (642 dep.) · CEAPS 76.587 (**98 sen.**) |
| Emendas | **24.825** |
| Receitas de campanha | **44.171** — 642 deputados e **76 senadores** |

⚠️ `pessoas` tem **7.993** linhas: é o cadastro de TODAS as legislaturas, ⛔ não os 747
que votaram na 57ª. Somar as duas casas ou ler o cadastro cru dá número maior e errado.

⭐ **Todas as fontes ingerem** — o Senado desde a PL42. ⛔ **As notícias saíram em
2026-10-02** (PL61): coletor, aba da ficha e seção do início. O que as substitui é a PL63.

⭐ **A conta é opcional** quando `Acesso:LeituraPublica` está ligado — só seguir e a conta
pedem login (PL65). 🔴 Em produção continua desligado: RNF-17, período eleitoral de 2026.

> ✅ **A PL11 saiu do caminho (2026-08-29).** O poço tem **50 linhas** em `perguntas`,
> das quais **49 ativas** — 40 da Câmara e 9 do Senado. O cidadão responde **24**: 8 de
> abertura, as 9 do Senado e 7 escolhidas contra o empate dele.
>
> ⚠️ A 50ª é a `q-preco-abusivo`, **desativada** e ⛔ não apagada: a votação era destaque
> de Emenda de Plenário, ⛔ não a proposição. O carregador desativa em vez de excluir,
> senão a linha voltaria na próxima carga.
>
> ⚠️ **Poço e questionário ⛔ não são a mesma coisa.** O mínimo obrigatório é 60% do que
> é **OFERECIDO** (24), ⛔ não do poço (49) — sobre o poço daria 30 respostas num
> questionário de 24. 📐 A conta toda em [`PENDENCIAS`](../docs/PENDENCIAS.md).
>
> ⚠️ **O Senado ⛔ NÃO estava esgotado** — a conclusão de 29/08 caiu no mesmo dia. As
> PECs estavam classificadas como destaque ([achado #31](../docs/achados/031-a-pec-estava-escondida-como-destaque.md)),
> e o universo dobrou: **52 → 104** substantivas abertas, **2 → 10** candidatas novas com
> divisão ≥25% — incluindo a reforma tributária.

### 🔑 Chaves que o ambiente pede

| Segredo | Para quê | Onde |
|---|---|---|
| `Google:ClientId` | Login | user-secrets de `Poligraph.Api` |
| `Parameters:chave-cpf` | Chave do HMAC do CPF (PL77), chega à ETL como `POLIGRAPH_CHAVE_CPF` | user-secrets de `Poligraph.AppHost` |

⛔ **Nunca em `appsettings.json`** — o arquivo é versionado.

⭐ **A chave do Portal da Transparência deixou de ser necessária** (2026-09-25): emendas e
orçamento saem do **download público**, ⛔ da API de dados. Se `PortalTransparencia:Chave`
ainda estiver nos user-secrets do AppHost, pode ser apagada — ela é **pessoal, atrelada
ao CPF de quem a pediu**. Ver [achado #33](../docs/achados/033-o-destino-da-emenda.md).
