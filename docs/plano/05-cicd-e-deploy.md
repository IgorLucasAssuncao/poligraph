# CI/CD e deploy

> **Status:** v1.0 — 2026-08-23
> Fecha a parte de infra do plano. Três *workflows*, três destinos, zero servidor
> para administrar.

---

## 1. Panorama

```mermaid
flowchart LR
    subgraph GH["GitHub"]
        W1["etl.yml<br/>cron diário"]
        W2["api.yml<br/>push em main"]
        W3["web.yml<br/>push em main"]
    end

    W1 -->|"escreve"| PG[("PostgreSQL<br/>Neon/Supabase")]
    W2 -->|"deploy"| API["API C#"]
    W3 -->|"deploy"| CFP["Cloudflare Pages"]
    API --> PG
    CFP -->|"/api/* proxy"| API

    style W1 fill:#3776ab,color:#fff
    style CFP fill:#f38020,color:#fff
```

| Componente | Gatilho | Destino |
|---|---|---|
| ETL | **cron diário** + manual | Escreve direto no Postgres |
| API | push em `main` | App Service ou Fly.io |
| Front | push em `main` | Cloudflare Pages |

⚠️ **O front nem precisa de workflow** — o Cloudflare Pages faz *build* e *deploy* ao
conectar o repositório. O `web.yml` só existe se você quiser rodar testes antes.

---

## 2. `etl.yml` — o workflow que carrega o projeto

```yaml
name: ETL
on:
  schedule:
    - cron: '0 9 * * *'      # 09:00 UTC — após o rebuild dos CSVs (~07:00, achado #19)
  workflow_dispatch:          # botão de "rodar agora"
    inputs:
      recarga_completa:
        description: 'Reprocessar a legislatura inteira'
        type: boolean
        default: false

concurrency:
  group: etl                  # ⚠️ nunca duas cargas simultâneas
  cancel-in-progress: false

jobs:
  etl:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip

      - run: pip install -r etl/requirements.txt

      - name: Ingestão
        id: ingest
        env:
          PG_CONN: ${{ secrets.PG_CONN }}
        run: |
          python etl/main.py ingest \
            ${{ inputs.recarga_completa && '--full' || '--incremental' }}

      # ⭐ Análise só roda se a ingestão trouxe votação nova (§5.2 do discovery)
      - name: Análise
        if: steps.ingest.outputs.novas_votacoes != '0'
        env:
          PG_CONN: ${{ secrets.PG_CONN }}
        run: python etl/main.py analyze

      - name: Resumo
        run: |
          echo "### Carga de $(date -u +%F)" >> $GITHUB_STEP_SUMMARY
          echo "- Votações novas: ${{ steps.ingest.outputs.novas_votacoes }}" >> $GITHUB_STEP_SUMMARY
          echo "- Análise: ${{ steps.ingest.outputs.novas_votacoes != '0' && 'executada' || 'pulada' }}" >> $GITHUB_STEP_SUMMARY
```

### 2.1 As três decisões embutidas nesse YAML

| Decisão | Por quê |
|---|---|
| **09:00 UTC** | A Câmara reconstrói os CSVs entre 04:00 e 07:01 UTC. Duas horas de margem |
| **`concurrency: etl`** | Duas cargas simultâneas corromperiam o `execucao_id` |
| ⭐ **Análise condicional** | Votação só acontece em dia de sessão. Recalcular 207 mil pares num sábado é desperdício |

### 2.2 🔴 O alerta precisa conhecer o calendário legislativo

**"Zero votações novas" é normal em julho e suspeito em maio.**

```yaml
      - name: Alerta de coleta parada
        if: steps.ingest.outputs.novas_votacoes == '0'
        run: |
          MES=$(date -u +%m); DIA=$(date -u +%d); DOW=$(date -u +%u)
          # recesso: 18–31/07 e 23/12–01/02 · fim de semana · segunda e sexta
          if [ "$DOW" -ge 6 ] || [ "$DOW" = 1 ] || [ "$DOW" = 5 ]; then exit 0; fi
          if [ "$MES" = "01" ] || [ "$MES" = "12" ]; then exit 0; fi
          if [ "$MES" = "07" ] && [ "$DIA" -ge 18 ]; then exit 0; fi
          echo "::warning::Nenhuma votação nova em dia útil de sessão — verificar a coleta"
```

⚠️ **Sem isso, você tem uma de duas falhas:** ou o alarme dispara todo dia de recesso e
você aprende a ignorá-lo, ou não existe alarme e a coleta fica quebrada por semanas sem
ninguém notar. A segunda é pior, e é a que acontece por padrão.

⭐ **Isso também é conteúdo de TCC.** "O monitoramento incorpora o calendário legislativo"
é uma decisão de engenharia derivada do domínio, não configuração genérica.

---

## 3. `api.yml` — depende da PL2

### Opção A — Azure App Service

```yaml
name: API
on:
  push:
    branches: [main]
    paths: ['src/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '10.x' }
      - run: dotnet publish src/Poligraph.Api -c Release -o out
      - uses: azure/webapps-deploy@v3
        with:
          app-name: poligraph-api
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: out
```

| ✅ | ⛔ |
|---|---|
| Aspire tem caminho nativo (`azd up`) | Tier gratuito com limites de CPU |
| Familiar para quem usa .NET | Crédito de estudante **expira** |

### Opção B — Fly.io

```yaml
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

| ✅ | ⛔ |
|---|---|
| Deploy simples, Dockerfile único | Sem integração com Aspire |
| Não expira | Precisa cartão cadastrado |

> **Recomendação:** **Fly.io**, por não expirar. O ganho do `azd up` do Aspire não
> compensa o risco do TCC sair do ar quando o crédito acabar.

⚠️ **Mas se você já tem crédito Azure de estudante com validade longa**, o Azure é mais
integrado. É decisão de contexto — **PL2**.

---

## 4. Cloudflare — o proxy que elimina CORS

```
poligraph.app          → Cloudflare Pages (React)
poligraph.app/api/*    → origem da API (App Service ou Fly)
```

**Configure isso no primeiro dia.** Se front e API ficarem em domínios diferentes você
ganha: *preflight* em toda requisição, dor de cabeça com cookie, e configuração de CORS
para manter.

| Recurso Cloudflare | Configuração |
|---|---|
| Pages | Conectar repositório, *build* `npm run build`, saída `dist` |
| DNS | `A`/`CNAME` para a origem, com proxy ativado (nuvem laranja) |
| Rules | `/api/*` → origem da API |
| **Rate limiting** | `/api/afinidade` — ex.: 30 req/min por IP |
| WAF | Regras gerenciadas, modo padrão |

⚠️ **Rate limit em `/api/afinidade` não é paranoia.** É o endpoint que faz cálculo e é o
único `POST` público. Sem limite, é o alvo óbvio.

---

## 5. Secrets

| Secret | Onde | Usado por |
|---|---|---|
| `PG_CONN` | GitHub → Actions | `etl.yml` |
| `AZURE_PUBLISH_PROFILE` **ou** `FLY_API_TOKEN` | GitHub → Actions | `api.yml` |
| `ConnectionStrings__poligraph` | App Service / Fly secrets | API em produção |
| `CLARITY_ID`, `GA4_ID` | Cloudflare Pages env | Front |
| `PEPPER` | App Service / Fly secrets | Só se houver login (PL7) |

🔴 **Nunca commitar `.env`.** O `.gitignore` de .NET já cobre `.env`, mas confira antes do
primeiro *push* — o repositório pode ser público (PL4).

⚠️ **Se o repositório for público**, qualquer pessoa vê os logs dos Actions. **Não imprima
a string de conexão** em nenhum `echo` de diagnóstico.

---

## 6. Ambientes

| | Local | Produção |
|---|---|---|
| Orquestração | ⭐ **Aspire** (`dotnet run`) | Nenhuma — peças independentes |
| Postgres | Container do Aspire | Neon / Supabase |
| API | `localhost` | App Service / Fly |
| Front | Vite dev server | Cloudflare Pages |
| ETL | Manual pelo dashboard | GitHub Actions cron |

> 🔑 **Não existe "ambiente de homologação".** Para um TCC, dois ambientes já são um a
> mais do que o necessário. Local + produção basta.

---

## 7. Custo total

| Item | Custo/mês |
|---|---|
| Cloudflare (Pages, DNS, WAF) | **US$ 0** |
| GitHub Actions | **US$ 0** (público) |
| Postgres (Neon/Supabase free) | **US$ 0** |
| API (Fly.io) | **US$ 0–5** |
| Domínio | ~US$ 10/ano |
| **Total** | **≈ US$ 0–5/mês** |

⚠️ **O free tier do Neon/Supabase suspende o banco após inatividade.** A primeira
requisição depois disso demora alguns segundos. Para um TCC é aceitável — mas **avise a
banca antes da demonstração**, ou faça uma requisição de aquecimento minutos antes.

---

## 8. Pendências

| # | Pendência | Prioridade |
|---|---|---|
| **PL2** | Azure App Service vs **Fly.io** — recomendado Fly, por não expirar | 🔴 Alta |
| **PL4** | Repositório público? Afeta minutos do Actions e visibilidade dos logs | 🔴 Alta |
| **PL16** | Definir como o ETL sinaliza `novas_votacoes` (output do step) | 🟡 Média |
| **PL17** | Testar o cold start do Postgres gerenciado e decidir se precisa de *keep-alive* | 🟡 Média |
| **PL3** | Registrar domínio | 🟢 Baixa |
