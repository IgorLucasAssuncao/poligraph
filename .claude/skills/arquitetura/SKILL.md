---
name: arquitetura
description: Decisões de arquitetura do poligraph — avaliação de Minimal API, escolha de tier, padrões que se usa e que não se usa, e o critério de prazo que decide. Use ao estruturar projetos, criar endpoints, avaliar se vale introduzir um padrão novo.
---

# Arquitetura — poligraph

> **Adaptada de `dotnet-architecture` (MIT).** A original assume Clean Architecture + CQRS
> como destino natural. **Este projeto decidiu o contrário, e por critério explícito.**

---

## 1. O critério que decide tudo

> **"Quanto tempo isso rouba de escrever o TCC?"**

⭐ **A skill original concorda:** *"the mark of a senior architect is knowing when NOT to
over-engineer."* Este documento é essa frase aplicada.

| Pergunta antes de introduzir qualquer padrão | |
|---|---|
| 1 | Que problema **concreto e presente** ele resolve? |
| 2 | O problema já apareceu, ou é hipótese? |
| 3 | Quanto custa **manter** durante meses de TCC? |

⛔ **"Vai que precisa depois" não é resposta.**

---

## 2. ✅ Decisão: Tier 2 sem MediatR

Pela matriz da skill original — 1 dev, banco único, 4 integrações, 1–10 mil linhas,
manutenção de meses — o projeto é **Tier 2**.

```
src/
├── Poligraph.Api/
│   ├── Endpoints/     Parlamentares · Afinidade · Auth · Noticias
│   ├── Data/          PoligraphDb · Entidades · Migrations
│   ├── Services/      ServicoAfinidade · ServicoEmail
│   └── Program.cs
├── Poligraph.Tests/
└── Poligraph.AppHost/
etl/                   Python — pandas, scipy, networkx
web/                   React + Vite
```

| ⛔ Fora | Motivo |
|---|---|
| Camadas `Domain` / `Application` / `Infrastructure` | 4 projetos para 1 pessoa |
| `MediatR` | Indireção sem ganho com um handler por caso |
| `Repository<T>` | O `DbContext` já é Unit of Work + repositório |
| `AutoMapper` | `Select` é explícito e mais rápido |

---

## 3. ⭐ Avaliação: Minimal API × Controllers

A decisão está tomada — **Minimal API** — mas o TCC precisa da justificativa por escrito.

### 3.1 Comparação

| Critério | **Minimal API** ✅ | Controllers |
|---|---|---|
| Cerimônia | Nenhuma — o endpoint é uma função | Classe + herança + atributos |
| Performance | ⭐ **Melhor** — sem descoberta por reflexão | Ligeiramente inferior |
| *Model binding* | Explícito nos parâmetros | Por convenção |
| Filtros / *middleware* | `AddEndpointFilter` | Filtros de ação |
| OpenAPI | Nativo no .NET 10 | Nativo |
| Testes | Igual — `WebApplicationFactory` | Igual |
| ⛔ Risco real | **`Program.cs` vira um arquivo de 800 linhas** | Organização vem de graça |

### 3.2 🔴 O risco do Minimal API, e como evitá-lo

> **O problema do Minimal API não é técnico — é organizacional.** Sem disciplina, tudo
> desemboca no `Program.cs`.

**Regra do projeto: um arquivo de extensão por assunto.**

```csharp
// Endpoints/EndpointsAfinidade.cs
public static class EndpointsAfinidade
{
    public static IEndpointRouteBuilder MapearAfinidade(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/afinidade").WithTags("Afinidade");

        grupo.MapPost("/", CalcularAsync);
        grupo.MapGet("/perguntas", ObterPerguntasAsync);

        return app;
    }

    private static async Task<IResult> CalcularAsync(
        RequisicaoAfinidade req, ServicoAfinidade servico, CancellationToken ct)
    {
        if (req.Respostas.Count < ServicoAfinidade.MinimoRespostas)
            return Results.UnprocessableEntity("Respostas insuficientes.");   // CT7

        return Results.Ok(await servico.CalcularAsync(req, ct));
    }
}
```

```csharp
// Program.cs — enxuto, e continua assim
app.MapearParlamentares()
   .MapearAfinidade()
   .MapearAutenticacao()
   .MapearNoticias();
```

⚠️ **Se o `Program.cs` passar de ~120 linhas, algo foi parar no lugar errado.**

### 3.3 Onde Controllers venceriam

Vale registrar no TCC que a escolha **não é universal**:

| Se o projeto tivesse… | Controllers seriam melhores |
|---|---|
| Dezenas de endpoints CRUD repetitivos | Convenção economiza código |
| Necessidade de *model binding* complexo | Mais maduro |
| Equipe grande, vinda de MVC | Familiaridade |

⭐ **Nenhuma dessas se aplica aqui:** ~15 endpoints, quase todos de leitura.

---

## 4. Padrões — o que se usa

### 4.1 ✅ `Result` para falha esperada

Falha de negócio **não é exceção**. Exceção é para o inesperado.

```csharp
public readonly record struct Resultado<T>(bool Sucesso, T? Valor, string? Erro)
{
    public static Resultado<T> Ok(T valor) => new(true, valor, null);
    public static Resultado<T> Falha(string erro) => new(false, default, erro);
}
```

| Usar `Resultado<T>` | Usar exceção |
|---|---|
| Respostas insuficientes (CT7) | Banco fora do ar |
| Parlamentar sem votos suficientes | `id_token` inválido |
| Fuzzy match abaixo do limiar | Bug de programação |

### 4.2 ✅ Serviços como classes simples

```csharp
public class ServicoAfinidade(PoligraphDb db)
{
    private readonly PoligraphDb _db = db;
    // públicos no topo, privados abaixo — ver skill padroes-codigo
}
```

Registrados com `AddScoped<ServicoAfinidade>()`. ⛔ **Sem interface** enquanto houver
uma implementação só — interface para mock não é motivo, porque os testes usam
Postgres real (Testcontainers).

### 4.3 ⛔ Onde o ETL entra

> **O Python é dono do cálculo pesado. O C# só lê o resultado.**

| | |
|---|---|
| 🐍 Python | Ingestão, matriz, similaridade, comunidades, eixos — escreve em `similaridade`, `aresta_grafo`, `no_metrica` |
| ⚙️ C# | **Lê** essas tabelas e serve JSON. ⛔ **Não recalcula nada** |

⚠️ **Se um cálculo de similaridade aparecer em C#, é regressão de arquitetura.**

---

## 5. Anti-padrões — os que este projeto pode cometer

| ⛔ | Sintoma |
|---|---|
| **Program.cs monolítico** | §3.2 |
| **Abstração prematura** | `IServicoX` com uma implementação e nenhum teste que a mock |
| **Recalcular no C#** | §4.3 |
| **Camada por camada** | Criar `Domain` "porque é o certo" — não é: é o certo para outro problema |
| **Genérico cedo demais** | `RepositorioBase<T>` antes de existirem três repositórios |

> 🔑 **Regra:** um padrão entra quando o problema dele **já aconteceu duas vezes**.

---

## 6. Quando reavaliar

Esta decisão vale enquanto as premissas valerem. Reavalie se:

| Gatilho | Considerar |
|---|---|
| `Program.cs` > 120 linhas | Faltou um arquivo de endpoints |
| Um serviço passa de ~300 linhas | Quebrar por assunto |
| Aparecer um segundo consumidor da API | Contratos versionados |
| O projeto virar produto depois do TCC | Aí sim, discutir camadas |
