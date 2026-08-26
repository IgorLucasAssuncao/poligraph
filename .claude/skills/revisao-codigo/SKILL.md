---
name: revisao-codigo
description: Revisão de código C# do poligraph — checklist de correção, SOLID, performance, segurança e C# 14, com as regras específicas deste projeto (polaridade, LGPD, EF, snake_case). Use ao revisar C#, auditar código ou antes de abrir PR.
---

# Revisão de código — poligraph

> **Adaptada de `dotnet-code-review` (MIT)**, com as regras deste projeto no topo — elas
> valem mais que qualquer item genérico de checklist.

---

## 1. 🔴 Primeiro: as cinco do projeto

Se alguma destas falhar, **para a revisão aqui**.

| # | Verificação | Por quê |
|---|---|---|
| 1 | 🔴 **Polaridade tem teste?** | 14% das votações invertem. Erro **não aparece na tela** |
| 2 | 🔴 **Nenhum token no banco?** | Nem `id_token`, nem `refresh_token`, nem sessão |
| 3 | 🔴 **`UseSnakeCaseNamingConvention()` intacto?** | Removê-lo quebra o ETL Python **sem erro de compilação** |
| 4 | 🔴 **Os `CHECK` sobreviveram à migration?** | Regra medida virou `HasCheckConstraint`, ou virou comentário? |
| 5 | 🔴 **CPF em claro em algum lugar?** | A coluna é `cpf_hash`. ⛔ Nunca renderizar |

### 1.1 E as três do domínio

| | |
|---|---|
| ⛔ **Cálculo de similaridade em C#** | É do Python. C# só lê o resultado |
| ⛔ **Aresta entre casas** | Deputado e senador nunca se ligam (achado #7) |
| ⚠️ **Votação secreta entrando na matriz** | 56% do Senado é secreta — registra `"Votou"`, não posição |

---

## 2. Correção

| | |
|---|---|
| ⛔ `async void` | Exceto *event handler*. Não dá para aguardar nem capturar exceção |
| ⛔ `.Result` / `.Wait()` | *Deadlock*. Use `await` |
| ⛔ `DateTime.Now` | 🔴 Estoura com `timestamptz`. Use `DateTimeOffset.UtcNow` |
| ⚠️ `CancellationToken` ausente | Todo método assíncrono recebe, e **repassa** |
| ⚠️ Divisão sem checar zero | Parlamentar com zero votações comuns |
| ⚠️ `First()` onde cabe `FirstOrDefault()` | Exceção por dado ausente não é erro excepcional |

---

## 3. SOLID — o que importa aqui

⭐ **Não aplique SOLID como checklist.** Num projeto de um dev, a maioria das violações
teóricas não custa nada. **Três custam:**

| Princípio | Sintoma real neste projeto |
|---|---|
| **S** — responsabilidade única | Um serviço que ingere, calcula e serve JSON. Quebrar por assunto |
| **D** — inversão de dependência | ⚠️ **Só quando houver dois implementadores.** Interface para uma classe só é ruído |
| **O** — aberto/fechado | `switch` gigante por tipo de votação → tabela de mapeamento |

⛔ **Não peça interface só para permitir mock** — os testes usam Postgres real.

---

## 4. Performance — os pontos que este projeto tem de verdade

| 🔴 | Sintoma | Correção |
|---|---|---|
| **N+1** | `foreach` com consulta dentro | `Include`, ou uma consulta com `Select` |
| **Sem `AsNoTracking`** | Leitura pura rastreada pelo EF | `AsNoTracking()` em tudo que é só leitura |
| **`ToList()` cedo demais** | Materializa e filtra em memória | Filtrar antes de materializar |
| **Grafo inteiro em memória** | 644 nós, ~207 mil pares | Paginar, ou pré-agregar no Python |
| **String em laço** | Montagem de SQL/CSV | `StringBuilder` |

```csharp
// ⛔ N+1
foreach (var p in parlamentares)
    p.Similares = await _db.Similaridades.Where(s => s.PessoaA == p.Id).ToListAsync(ct);

// ✅ uma consulta
var similares = await _db.Similaridades
    .AsNoTracking()
    .Where(s => ids.Contains(s.PessoaA))
    .ToListAsync(ct);
```

⚠️ **Não otimize sem medir.** A exceção é o N+1, que é sempre erro.

---

## 5. Segurança

| | |
|---|---|
| 🔴 **`Audience` na validação do `id_token`** | Sem isso, token de **outro app** é aceito |
| 🔴 **Segredo em `appsettings.json`** | Vai para o Git. Segredo é variável de ambiente do Coolify |
| 🔴 **Porta 5432 exposta** | Nunca. Só rede Docker |
| ⚠️ **SQL concatenado** | No C#: parâmetro. No Python: `%s`, nunca f-string |
| ⚠️ **Erro cru na resposta** | *Stack trace* revela estrutura interna |
| ⚠️ **`.env` no repositório** | O repositório é privado — **mas pode deixar de ser** |

### 5.1 LGPD — o que revisar

| | |
|---|---|
| A tabela `segue` é **convicção política** (art. 5º, II) | Toda mudança nela merece atenção extra |
| Consentimento antes de gravar | E o `versao` do texto aceito, para provar o quê |
| `ON DELETE CASCADE` mantido | A exclusão do art. 18 é **um `DELETE`** — nova tabela sem cascade quebra isso |
| ⛔ Nome de parlamentar no assunto do e-mail | Vaza preferência política pelo Gmail |

---

## 6. C# 14 / .NET 10 — o que sugerir

| Em vez de | Use |
|---|---|
| Construtor com atribuição manual | **Construtor primário** |
| `new List<int>()` | `[]` |
| `if (x == null) throw` | `ArgumentNullException.ThrowIfNull(x)` |
| Concatenação de caminho | `Path.Combine` |
| Classe de dado com `Equals` manual | `record` |
| `string.Format` | Interpolação |

⚠️ **Sugerir sintaxe moderna é 🟢, nunca 🔴.** Código que funciona não vira crítico por ser
verboso.

---

## 7. Formato do parecer

```markdown
## Revisão: <componente>

### Resumo
<2–3 linhas: o que o código faz e o veredito>

### 🔴 Crítico — precisa corrigir
- **<arquivo:linha>** — <o problema> · **Consequência:** <o que quebra>

### 🟡 Importante — vale corrigir
### 🟢 Sugestões
### ✅ O que está bom
```

### 7.1 Regras do parecer

| | |
|---|---|
| ⭐ **Todo 🔴 precisa de um cenário concreto** | *"com `polaridade = -1`, retorna o oposto"* — não *"pode dar problema"* |
| ⭐ **Aponte o que está bom** | Revisão só com defeito não é lida duas vezes |
| ⚠️ **Não invente problema para preencher seção** | Seção vazia é resultado válido |
| ⛔ **Não confunda estilo com defeito** | Verbosidade é 🟢 |

---

## 8. O que **não** revisar neste projeto

| ⛔ | Motivo |
|---|---|
| Ausência de Repository | Decisão registrada — o `DbContext` já é um |
| Ausência de MediatR/CQRS | Decisão registrada |
| Ausência de camadas Domain/Application | Tier 2, um dev |
| Cobertura de testes baixa | Não há meta. O que importa é **quais** testes existem |
| Endpoint sem interface | Não há segundo implementador |

> 🔑 **Estas ausências são decisões, não omissões.** Apontá-las como defeito é revisar
> outro projeto.
