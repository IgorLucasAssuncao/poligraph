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
    .UseSnakeCaseNamingConvention());
```

⚠️ **Remover essa linha quebra o ETL inteiro sem erro de compilação.**

---

## 0. 🔴 Comentários — a regra que vem antes das outras

| | |
|---|---|
| ⭐ **Onde** | `/// <summary>` no membro. `<remarks>` para o porquê |
| ⛔ **Nunca** | `//` no meio de um corpo de método |
| ⛔ **Nunca** | Emoji em arquivo `.cs` |
| ⛔ **Nunca** | Carga emocional — *"não é preciosismo"*, *"o bug de uma hora perdida"*, *"horrendo"* |
| ⛔ **Nunca** | Decisão de arquitetura como `<summary>` — isso é `docs/`, ⛔ não documentação de membro |

> ⚠️ **Os marcadores 🔴 ⚠️ ⛔ ⭐ 📐 valem para esta documentação, e ⛔ NÃO para o código.**
> Em 2026-09-07 foram removidos de **103 arquivos** `.cs`.

### A mesma regra no front e na ETL (2026-10-02)

| | |
|---|---|
| ⭐ **TypeScript** | `/** */` na declaração: função, componente, tipo, constante de módulo, propriedade de tipo. ⛔ `//`, `/* */` ou `{/* */}` dentro do corpo ou do JSX |
| ⭐ **Python** | Docstring. ⛔ comentário no meio da função |
| ⭐ **No lugar dos marcadores** | `RISCO:` · `ATENÇÃO:` · `DECISÃO:` · `MEDIDO:` · `FEITO:` — em qualquer código, teste ou log |
| Exceção | Diretiva de ferramenta (`eslint-disable…`, `@ts-expect-error`) |

Detalhe em [`.claude/CLAUDE.md`](../../CLAUDE.md), *Comentários em todo o código*.


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

## 7. ETL em Python e enums das fontes (2026-10-21)

| O quê | Padrão | Exemplo |
|---|---|---|
| Módulos, funções, variáveis | `snake_case` | `bens_para_linhas`, `hashes_de_pessoas` |
| Função privada do módulo | prefixo `_` | `_carga_do_arquivo` |
| Constantes | `MAIUSCULAS` | `MINIMO_VOTACOES_COMUNS` |
| Enums | `StrEnum` em `poligraph_etl/nucleo/tipos.py`, nome igual ao enum C# | `TipoCasa.CAMARA` |

O verbo abre o nome e diz o que a função faz: `baixar`, `ler`, `*_para_linhas`, `gravar_*`,
`calcular_*` (tabela no `CLAUDE.md`). O contrato de entrada traduz o código da fonte para o enum
e levanta `ValorDesconhecido` para valor novo; transformação e persistência só recebem o enum.

```python
class TipoCargo(StrEnum):
    DEPUTADO_FEDERAL = "DEPUTADO_FEDERAL"
    SENADOR = "SENADOR"

DO_TSE = {"6": TipoCargo.DEPUTADO_FEDERAL, "5": TipoCargo.SENADOR}

def cargo_do_tse(codigo: str) -> TipoCargo:
    try:
        return DO_TSE[codigo]
    except KeyError:
        raise ValorDesconhecido("CD_CARGO", codigo) from None
```

Regex só para texto livre. Campo de domínio: enum ou igualdade exata.

### 7.1 Exemplos do próprio código (levantados em 2026-10-21, Pendência 91)

**Literal de domínio que vira enum**

| Hoje | Vira |
|---|---|
| `__main__.py:2216` `if casa == "CAMARA":` (44 ocorrências de `"CAMARA"`, 30 de `"SENADO"`) | `if casa is TipoCasa.CAMARA:`, o mesmo `TipoCasa` do C# |
| `patrimonio.py:36` `CARGOS_DO_CONGRESSO = {"5", "6"}` | `{TipoCargo.SENADOR, TipoCargo.DEPUTADO_FEDERAL}`, com `CD_CARGO` traduzido no contrato |
| `gestao.py:84` `df["DS_SIT_TOT_TURNO"] == "ELEITO"` | `TipoSituacaoNoTurno.ELEITO`; o contrato traduz também ELEITO POR QP e ELEITO POR MÉDIA, que esta linha não pega |
| `emendas.py:435` `tipo == "Pessoa Jurídica"` | `TipoFavorecido.PESSOA_JURIDICA`, que já existe no C# |

**Regex que vira comparação simples**

| Hoje | Vira |
|---|---|
| `municipios.py:41` `re.fullmatch(r"\d{7}", ibge)` (e `emendas.py:537`) | `len(ibge) == 7 and ibge.isdigit()` |
| `emendas.py:542` `re.fullmatch(r"[A-Z]{2}", texto)` | `texto in UFS`: a UF é domínio fechado |
| `normalizacao.py:400` `re.sub(r"\D", "", bruto)` (e `convenentes.py:72`) | `"".join(c for c in bruto if c.isdigit())` |

**Regex que fica, porque o campo é texto livre**

| Onde | Por quê |
|---|---|
| `normalizacao.py:515` `_CPF_NO_TEXTO` | Acha CPF no meio de uma descrição para apagar (LGPD) |
| `emendas.py:74` `_EX_PARLAMENTAR` | Extrai o titular anotado entre parênteses no nome do autor |
| `redes.py:41-54` | Valida e corta URL digitada à mão no TSE |
| `normalizacao.py` `_CATEGORIAS` | Classifica a votação pela descrição em texto |

**Verbos já usados do jeito certo**

| Verbo | Exemplo |
|---|---|
| `baixar` | `tse.baixar(url, destino)` |
| `*_para_linhas` | `patrimonio.bens_para_linhas(linhas, candidaturas, ano)` |
| `gravar_*` | `persistencia.gravar_patrimonios(conexao, anos, linhas)` |
| `Obter*Async` | `ServicoNovidades.ObterAsync(idUsuario, desde, ct)` |
