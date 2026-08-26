---
name: padroes-codigo
description: Padrões de nomenclatura, organização de membros e estilo de código C# do projeto poligraph. Use ao escrever ou revisar qualquer código C#, ao criar entidades EF, endpoints Minimal API ou serviços.
---

# Padrões de código — poligraph

> **Tudo neste projeto é escrito em português.** Nomes de classe, método, propriedade,
> variável, tabela, coluna, teste e mensagem de commit. **Exceto** o que a plataforma
> impõe (`Program.cs`, `Task`, `CancellationToken`, verbos HTTP).

**Alvo: .NET 10 · C# 14**

---

## 1. Nomenclatura

### 1.1 A tabela de regras

| O quê | Padrão | Exemplo |
|---|---|---|
| Classes, `record`, `enum` | **PascalCase** | `ServicoAfinidade`, `Usuario` |
| **Métodos públicos** | **PascalCase** | `CalcularAfinidadeAsync()` |
| **Propriedades públicas** | **PascalCase** | `GoogleSub`, `SessaoVersao` |
| **Propriedades de modelo** | **PascalCase** | `PartidoNoVoto` |
| ⭐ **Campos privados e serviços injetados** | **`_camelCase`** | `_db`, `_servicoEmail`, `_logger` |
| Parâmetros e variáveis locais | `camelCase` | `usuarioId`, `resultado` |
| Constantes | **PascalCase** | `LimiteVotacoesComuns` |
| Interfaces | `I` + PascalCase | `IServicoEmail` |
| Métodos assíncronos | sufixo `Async` | `ObterPorIdAsync` |

> ⚠️ **Assumi que "serviços/campos privados levam `_` + primeira letra minúscula" significa
> `_camelCase`** — o padrão .NET. Se a intenção era outra, corrija aqui e o resto do
> projeto segue.

```csharp
public class ServicoAfinidade(PoligraphDb db, ILogger<ServicoAfinidade> logger)
{
    private readonly PoligraphDb _db = db;
    private readonly ILogger<ServicoAfinidade> _logger = logger;

    public const int MinimoVotacoesComuns = 20;

    public async Task<ResultadoAfinidade> CalcularAsync(long pessoaId, CancellationToken ct)
    {
        var similares = await BuscarSimilaresAsync(pessoaId, ct);
        return MontarResultado(similares);
    }

    private async Task<IReadOnlyList<Similaridade>> BuscarSimilaresAsync(
        long pessoaId, CancellationToken ct) => /* ... */;

    private static ResultadoAfinidade MontarResultado(
        IReadOnlyList<Similaridade> similares) => /* ... */;
}
```

### 1.2 🔴 O banco é a exceção — e por um motivo concreto

> **C# em PascalCase. Banco em `snake_case`.** O EF faz a tradução.

| | |
|---|---|
| Por quê | O **ETL Python lê as mesmas tabelas**. No Postgres, identificador sem aspas é rebaixado para minúsculo — `Usuario` só existiria se **toda** query, para sempre, usasse `"Usuario"` entre aspas |
| Como | `.UseSnakeCaseNamingConvention()` — pacote `EFCore.NamingConventions` |
| Efeito | Você escreve `usuario.GoogleSub` no C# e `SELECT google_sub FROM usuario` no Python |

```csharp
builder.Services.AddDbContext<PoligraphDb>(o => o
    .UseNpgsql(cs)
    .UseSnakeCaseNamingConvention());   // 🔴 não remover
```

⚠️ **Remover essa linha quebra o ETL inteiro sem erro de compilação.**

---

## 2. 🔴 Ordem dos membros dentro da classe

> **Públicos no topo. Privados abaixo, na ordem em que são usados.**

```
1. Campos privados        (_db, _logger)
2. Constantes públicas
3. Construtor
4. ── MÉTODOS PÚBLICOS ──
5. ── MÉTODOS PRIVADOS ── ordenados pelo uso: o primeiro chamado vem primeiro
```

⭐ **"Ordenados pelo uso" quer dizer: leia a classe de cima para baixo e a história faz
sentido.** Se `CalcularAsync` chama `BuscarSimilaresAsync` e depois `MontarResultado`,
os privados aparecem nessa ordem.

⚠️ **Um privado usado por dois públicos vai depois do último que o chama.**

---

## 3. Estilo C#

### 3.1 O que usar

| | |
|---|---|
| **Construtor primário** | `public class Servico(PoligraphDb db)` |
| `record` para DTO e resposta | `public record RespostaAfinidade(string Nome, int Concordancias);` |
| **Nullable reference types** | Ligado. `<Nullable>enable</Nullable>` |
| `CancellationToken ct` | Em **todo** método assíncrono, sempre o último parâmetro |
| Coleções somente-leitura no retorno | `IReadOnlyList<T>`, não `List<T>` |
| `required` para propriedades obrigatórias | `public required string Email { get; set; }` |
| Coleções: `[]` | `int[] valores = [];` |

### 3.2 O que **não** usar neste projeto

| ⛔ | Por quê |
|---|---|
| `MediatR` / CQRS | Decisão de arquitetura — Minimal API direto |
| `Repository<T>` sobre EF | O `DbContext` **já é** Unit of Work + repositório |
| Camadas `Domain`/`Application`/`Infrastructure` | Tier 2: um projeto de API |
| `AutoMapper` | Projeção com `Select` é explícita e mais rápida |
| `async void` | Exceto *event handler*. Impossível de aguardar ou capturar |
| `.Result` / `.Wait()` | *Deadlock*. Use `await` |

---

## 4. Regras que valem mais que estilo

### 4.1 🔴 `DateTimeOffset`, nunca `DateTime`

O Npgsql exige `Kind = Utc` para `timestamptz`. Um `DateTime.Now` **estoura em runtime**.

```csharp
public DateTimeOffset CriadoEm { get; set; }   // ✅
public DateTime CriadoEm { get; set; }         // ⛔ risco de "Kind=Local"
```

### 4.2 🔴 Regra medida vira `CHECK`

```csharp
e.ToTable(t => t.HasCheckConstraint("ck_sim_minimo", "n_votacoes_comuns >= 20"));
```

> **Um bug que o banco rejeita custa minutos; um que ele aceita custa um capítulo do TCC.**

### 4.3 🔴 Polaridade

Toda função que aplica polaridade (`-1` / `+1`) precisa de teste. Em **14% das votações**,
"Sim" significa rejeitar — e o erro **não aparece na tela**.

---

## 5. Nomes em português — como resolver os casos duvidosos

| Inglês comum | Aqui |
|---|---|
| `Repository` | *(não existe)* |
| `Service` | `Servico` — `ServicoAfinidade`, `ServicoEmail` |
| `Handler` | `Manipulador`, ou o verbo direto: `EnviarDigestAsync` |
| `Request` / `Response` | `Requisicao` / `Resposta` |
| `Mapper` | *(não existe — use `Select`)* |
| `Options` / `Settings` | `Opcoes` — `OpcoesEmail` |
| `Factory` | `Fabrica` |

⚠️ **Sem acento em identificador.** `Servico`, não `Serviço`; `Similaridade` está ok.
Acentos valem para **texto**: mensagens, comentários, `description` de endpoint.

---

## 6. Commits

Português, imperativo, minúsculo após o prefixo:

```
feat: calcula afinidade entre cidadao e parlamentar
fix: corrige inversao de polaridade em destaques
docs: registra a decisao de nomenclatura
```

⚠️ **Corpo do commit sem acento** — evita problemas de encoding no terminal Windows.
