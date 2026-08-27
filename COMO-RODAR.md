# Como rodar localmente

> ⚠️ **Este arquivo virou detalhe.** O passo a passo principal agora vive no
> [`README.md`](README.md) da raiz, junto dos desenhos de arquitetura. Aqui ficam só as
> variações e os problemas conhecidos.
>
> 🔴 **Correção de 2026-08-27:** o texto abaixo menciona **seed de dados de teste**. Ele
> foi **aposentado** — o banco local é preenchido pelo ETL com a Câmara de verdade. Ver
> [`plano/04 §2.2b`](docs/plano/04-esqueleto.md).

## O que você precisa instalado

| | |
|---|---|
| **.NET 10 SDK** | API, migrations, testes |
| **Docker Desktop** | Postgres (o Aspire sobe sozinho) — precisa estar **aberto** |
| **Node 22+** | Front |
| Python 3.13+ | 🔵 **Opcional** — só para rodar os testes do ETL. O ETL em si roda em container |

## Subir tudo

```bash
dotnet run --project src/Poligraph.AppHost
```

⭐ **Um comando sobe TUDO:** Postgres, migrations, API **e o front**.

⚠️ ⛔ **Sem seed** — o banco sobe VAZIO. Rode `etl-ingerir` no painel do Aspire.
O dashboard do Aspire abre no navegador com o endereço de cada serviço.

| Serviço | Onde |
|---|---|
| **Front** | http://localhost:5173 |
| API | porta dinâmica — veja no dashboard |
| Dashboard | o link aparece no terminal |

⚠️ **Na primeira vez rode `npm install` antes**, senão o Vite não sobe:

```bash
cd src/web && npm install
```

⭐ **Não é preciso configurar nada.** Nenhuma variável, nenhuma conta, nenhuma chave.

⭐ O proxy `/api` do Vite aponta para a API pelo endereço que o Aspire injeta — então
front e API ficam na **mesma origem**, sem CORS, e o cookie `SameSite=Lax` funciona
igual a produção.

## ⚠️ O que fica desligado sem configuração

| Recurso | Falta | Sintoma |
|---|---|---|
| **Login com Google** | `VITE_GOOGLE_CLIENT_ID` + `Google:ClientId` | O botão não aparece; um aviso explica |
| **Medição de uso** | `VITE_CLARITY_ID` | ⭐ O banner **não aparece** — sem ferramenta, não há o que consentir |
| **Digest por e-mail** | Serviço de envio (PL26) | O digest é montado, mas não sai |

> 🔑 **Nada disso bloqueia o resto.** Questionário, resultado, fichas, busca e grafo
> funcionam sem login — por decisão de projeto, não por acaso.

### Se quiser ligar o login

1. `src/web/.env.example` → copie para `.env.local` e preencha
2. `src/Poligraph.Api/appsettings.Example.json` → copie o bloco `Google` para
   `appsettings.Development.json`
3. Como obter o Client ID: `docs/plano/02-autenticacao-e-metricas.md` §3.2.2

⚠️ **Nos dois lugares tem que ser o MESMO Client ID.** A API confere o `aud` do token
contra o valor dela; se divergirem, todo login é rejeitado com 401.

## Testes

```bash
dotnet test                                    # 73 · precisa de Docker
cd src/etl && python -m pytest -q              # 104 · integração precisa de Docker
cd src/web && npm test                         # 16
```

## ETL com dados reais

```bash
cd src/etl
pip install -r requirements-dev.txt
export ConnectionStrings__poligraph="Host=localhost;Port=...;Database=poligraph;Username=postgres;Password=..."
python -m poligraph_etl ingerir  --anos 2023 2024 2025 2026
python -m poligraph_etl analisar --legislatura 57
```

⚠️ A porta e a senha do Postgres aparecem no dashboard do Aspire.
⚠️ A ingestão baixa ~60 MB de CSV da Câmara.
