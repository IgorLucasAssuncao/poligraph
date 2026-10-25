# CLAUDE.md — poligraph

> TCC: **"Arquitetura ETL e Modelagem em Grafos: Mensuração de Afinidade Política em Redes
> Sociais e Análise de Dados Financeiros de Políticos"**
>
> As notícias saíram do escopo (Pendência 61, 2026-10-02) e o título mudou com elas
> (2026-10-18). Seguir um parlamentar serve para acompanhar o que ele fez: votos, troca de
> partido e gastos, em "Novidades de quem você segue", no início e no sininho do cabeçalho.
>
> Afinidade política medida por **comportamento revelado de voto**, não por autodeclaração.

---

## Leia antes

| Documento | Por quê |
|---|---|
| 🗺️ [`mapa_do_sistema.html`](../mapa_do_sistema.html) | **O documento central**: fontes, comandos por etapa, tabelas e rotas |
| [`docs/PENDENCIAS.md`](../docs/PENDENCIAS.md) | O que está aberto, e a história do que fechou |
| [`docs/04-contratos.md`](../docs/04-contratos.md) | Cardinalidades medidas |
| [`docs/glossario.md`](../docs/glossario.md) | Termos e os pares que já viraram bug |
| [`src/etl/README.md`](../src/etl/README.md) | Manual da ETL: comandos, ordem, variáveis, carga do zero |

> ⚠️ **Medir um ano e generalizar foi a origem de quase todos os erros daqui.** Antes de
> afirmar um número, meça, e diga sobre qual período.

> **O mapa é sincronizado no mesmo commit** (decisão do autor, 2026-10-09). Toda mudança em
> fonte, comando da ETL, etapa da rotina, tabela, relação ou rota chega a
> `mapa_do_sistema.html`. Modelo do banco e rotas: `py infra/mapa/atualizar.py`; fontes,
> comandos, etapas, entradas e saídas: à mão, no próprio HTML.

---

## Skills

Em `.claude/skills/`, invocadas com a ferramenta Skill. Reescritas para este projeto: as
originais assumiam Clean Architecture e CQRS, que o projeto não usa.

| Skill | Quando |
|---|---|
| **`padroes-codigo`** | Sempre que escrever C# |
| **`arquitetura`** | Estruturar projeto, criar endpoint, avaliar padrão novo |
| **`revisao-codigo`** | Revisar C# (comando `/revisar <caminho>`) |
| **`testes`** | xUnit e Testcontainers; contém o teste de polaridade (API3) |
| **`docker-e-aspire`** | Dockerfile, AppHost, migrations |
| **`design-visual`** | Sempre que mexer em tela, componente ou CSS |

---

## Stack

React + Vite (nginx) · **ASP.NET Core Minimal API, .NET 10, C# 14** · **EF Core + migrations** ·
ETL em **Python** (pandas, scipy, networkx) · PostgreSQL · **Aspire 13** no dev ·
**Hostinger KVM 2 + Coolify** com Cloudflare na frente · xUnit + **Testcontainers**.
Estrutura **Tier 2 sem MediatR**: `Api`, `Data`, `Tests`, `AppHost`.

---

## Regras que sobrepõem qualquer skill

1. **Polaridade.** Em 14% das votações nominais "Sim" significa rejeitar. Nenhuma mudança
   no cálculo de afinidade entra sem o teste de regressão de polaridade (API3).
2. **Nenhum token nem senha no banco.** `id_token` é validado e descartado; a sessão é o
   cookie do Data Protection; o login é sempre do Google.
3. **LGPD.** `segue` é registro de convicção política: consentimento específico (RNF-12b) e
   exclusão (art. 18). ⛔ **Nunca renderizar nem gravar CPF**: a coluna é `cpf_hash`,
   HMAC-SHA256 com chave secreta (Pendência 77). Fonte que traz CPF em claro (CEIS, CNEP,
   CPCC) tem contrato que não o lê, ou descarta a linha antes de gravar.
4. **Regra medida vira `CHECK`, `UNIQUE` ou `FK`** (`HasCheckConstraint` no EF). Um bug que
   o banco rejeita custa minutos; um que ele aceita custa um capítulo.
5. **O dinheiro fecha com a fonte** (decisão do autor, 2026-10-02). O que não fecha tem
   motivo e valor à vista: tabela `reconciliacoes`, cobrada pelo `conferir`. Fonte com erro
   (valor de contrato digitado mil vezes maior) não some: entra corrigida pela regra escrita, e
   a diferença aparece na tela. ⛔ Descarte calado.
6. **Só fonte periódica**, que a ETL recarrega. PDF ou planilha avulsa não entra.

---

## Convenções

### Banco e EF

| Regra | Motivo |
|---|---|
| **snake_case** (`UseSnakeCaseNamingConvention`) | O ETL Python lê as mesmas tabelas |
| **O EF é dono do schema** | O Python nunca cria tabela; os testes da ETL rodam sobre `src/etl/tests/schema_do_ef.sql`, regenerado a cada migration |
| **`DateTimeOffset`**, nunca `DateTime` | `timestamptz` exige `Kind=Utc` |
| **A API nunca migra** | Migra o projeto `Poligraph.Data`: sozinho no dev; em produção, script gerado e validado no CI e aplicado no VPS antes do deploy |
| ⛔ `HasData()` para dado de teste | Entraria na migration e semearia produção |
| Mudança destrutiva | Dois deploys: expandir, migrar, contrair |

### ETL

- Toda fonte nova entra por **contrato**: `contratos/<fonte>.py` (entrada, só as colunas
  lidas), `contratos/banco.py` (saída, igual à tabela) e uma transformação pura. Coluna que
  some derruba a carga com `LayoutMudou`.
- CSV de verdade (`pd.read_csv`, `dtype=str`): os da Câmara têm quebra de linha dentro de campo.
- O Portal da Transparência responde 403 também quando limita o ritmo:
  `portal.baixar_publicado` tenta de novo antes de dizer que um mês falta.

### Tipagem das fontes

- **Valor fechado de fonte vira enum** nos dois lados: `StrEnum` no Python
  (`poligraph_etl/nucleo/tipos.py`), com o mesmo nome e os mesmos valores do enum C# em
  `Poligraph.Data/Data/Enums` quando ele existir. O código da fonte (`CD_CARGO`,
  `DS_SIT_TOT_TURNO`, a casa) é traduzido para o enum **no contrato de entrada**; dali em diante
  só o enum circula. ⛔ String literal de domínio (`"CAMARA"`, `"5"`, `"ELEITO"`) fora do contrato.
- **Valor que a fonte manda e o enum não conhece derruba a carga** (`ValorDesconhecido`, como o
  `LayoutMudou`). ⛔ `else` que engole o valor novo.
- **Regex só para texto livre** (CPF dentro de descrição, URL de rede social). Campo de domínio se
  compara pelo enum ou por igualdade exata. ⛔ `contains` ou regex sobre campo de domínio: "contém
  ELEITO" pega NÃO ELEITO (Pendência 90).
- Exemplos do código, do jeito errado e do certo: `padroes-codigo` §7.1. Os mais comuns:
  `if casa == "CAMARA"` vira `if casa is TipoCasa.CAMARA`; `re.fullmatch(r"\d{7}", ibge)` vira
  `len(ibge) == 7 and ibge.isdigit()`; regex fica em `_CPF_NO_TEXTO`, que procura CPF em texto livre.

### Nome de função e método: o verbo diz o que faz

| Verbo | Faz | Onde |
|---|---|---|
| `baixar` | Traz o arquivo da fonte para `.cache` | `fontes/` |
| `ler` | Abre o arquivo e entrega o registro bruto | módulo da fonte |
| `*_para_linhas` | Transformação pura, do bruto às linhas do banco; não recebe conexão | módulo da fonte |
| `gravar_*` | Escreve no banco; só existe em `persistencia.py` | `persistencia.py` |
| `Obter*Async` | Lê e devolve DTO | serviços da API |
| `Calcular*` / `calcular_*` | Conta derivada, sem I/O | serviços e ETL |

### Reaproveite antes de criar

| Precisa de | Use |
|---|---|
| Registrar de onde veio a linha | `_carga_do_arquivo` (ou `_carga_de_varios`, `_carga_de_resposta`); toda linha leva `carga_id` |
| Baixar do TSE | `tse.baixar` (receita de headers do WAF); ler o `_BRASIL` quando houver, senão os de UF, nunca os dois |
| Leitura pesada na API | `CacheDeLeitura` (`_leitura.ObterAsync`), aquecida no `AquecedorDeCache` |
| Grafo e métricas | `ExecucaoVigente`, com casa **e** legislatura (Pendência 54); período por `Legislaturas` |
| Quem está em exercício | `EmExercicioNaBase` |
| Texto que o usuário lê, vindo da API | `Textos/MensagensDaApi.cs` |
| Número e moeda no front | `nucleo/formato.ts`; UF por `nucleo/ufs.ts` |
| Arquivo novo na API | Pasta do assunto em `Endpoints/`, `Services/<Assunto>/` e `Dtos/<Assunto>/` |

### Código, em todas as linguagens

| Regra | Como |
|---|---|
| Idioma | Português, sem acento em identificador |
| Nomes dizem a origem do dado | `idPessoa`, `anoDaDespesa`, `anoDaEmenda` |
| Comentário | Só o equivalente ao `summary`: `///` no C#, `/** */` na declaração TS, docstring no Python. ⛔ dentro de corpo ou no fim da linha |
| Marcadores | `RISCO:` · `ATENÇÃO:` · `DECISÃO:` · `MEDIDO:` (com data) · `FEITO:`. ⛔ emoji no código |
| C# | `_camelCase` em campo privado; públicos no topo, privados na ordem de uso; chave em todo `if`/`for`; ⛔ `[SuppressMessage]` |
| Front | Todo componente React termina em `Component`; padrão repetido vira componente (`comum/componentes/Dados.tsx`); texto em `<contexto>/textos/*`, constante em `nucleo/constantes.ts` |
| Leitura da API no front | `useCarga` ou `useLista` (`comum/componentes/useCarga.ts`, sobre o TanStack Query), ⛔ `useEffect` com `fetch`. Dado que troca com filtro vai dentro de `AtualizandoComponent`. Dado da pessoa (quem ela segue) fica fora do cache |
| Texto de tela | Fala com gente: sem antítese em série, sem travessão no meio da frase, sem CAIXA ALTA de ênfase |
| Checagem do front | `npx tsc -b` (`tsc -p .` não checa nada) |
| Pastas do front | `src/<contexto>/{paginas,componentes,textos}` (inicio, parlamentares, politicos, grafo, questionario, emendas, governo, cidades, seguir, conta, institucional), `comum/` para o genérico, `site/` para a casca, `nucleo/` para api, formato e sessão; testes em `tests/`, na mesma estrutura |

---

## Comandos

```bash
dotnet run --project src/api/Poligraph.AppHost                 # sobe tudo (Aspire)
dotnet ef migrations add <Nome> -p src/api/Poligraph.Data      # nunca na API
dotnet ef migrations script -p src/api/Poligraph.Data -o src/etl/tests/schema_do_ef.sql
py infra/mapa/atualizar.py                                 # sincroniza o mapa
dotnet test                                                # inclui a polaridade
dotnet build src/api/Poligraph.Tests -o src/api/Poligraph.Tests/bin/avulso && dotnet test src/api/Poligraph.Tests/bin/avulso/Poligraph.Tests.dll  # com a API ligada: dentro do repo, para a curadoria achar a raiz
cd src/etl && py -m pytest -q                              # ETL, com Postgres real
cd src/web && npx vitest run && npx tsc -b && npm run lint # front
```

Commits: português, imperativo, corpo sem acento, ⛔ linha de coautor, ⛔ push sem pedido.

---

## Segredos

| Segredo | Para quê | Onde |
|---|---|---|
| `Google:ClientId` | Login | user-secrets de `Poligraph.Api` |
| `Parameters:chave-cpf` | HMAC do CPF; chega à ETL como `POLIGRAPH_CHAVE_CPF` | user-secrets de `Poligraph.AppHost` |

⛔ Nunca em `appsettings.json`, que é versionado. O Portal da Transparência não pede chave: tudo
sai do download público.

A conta é opcional (`Acesso:LeituraPublica = true`, decisão do autor, 2026-10-03): só seguir e a
própria conta pedem login.
