# 032 — A rota que o contrato dizia não existir

> Medido em **2026-09-06**, ao escrever a **CT3** (teste de contrato OpenAPI × front).

---

## O que apareceu

O primeiro teste de contrato do projeto acusou:

```
o front chama '/api/auth/logout', e ela ⛔ não está no OpenAPI.
Rotas publicadas: … /api/auth/google, /api/auth/sair-de-todos, /api/auth/eu, /api/auth/conta
```

⚠️ **E a rota estava mapeada** — `EndpointsAutenticacao.cs`, uma linha acima da vizinha
que aparecia:

```csharp
grupo.MapPost("/google",         EntrarAsync);        // ⭐ no documento
grupo.MapPost("/logout",         SairAsync);          // ⛔ FORA do documento
grupo.MapPost("/sair-de-todos",  SairDeTodosAsync);   // ⭐ no documento
```

---

## O que era

Dump do `EndpointDataSource` do host de teste, comparando as duas vizinhas:

| Rota | Metadados |
|---|---|
| `/api/auth/sair-de-todos` | **`RuntimeMethodInfo`**, `HttpMethodMetadata`, 4× `ParameterBindingMetadata`, … |
| `/api/auth/logout` | `HttpMethodMetadata`, `TagsAttribute`, … — 🔴 **sem `RuntimeMethodInfo`, sem binding** |

Sem o `MethodInfo` o `ApiExplorer` ⛔ não tem o que descrever, e **pula a rota inteira**.

🔴 **A causa é resolução de sobrecarga do C#.** `SairAsync` é o único handler do projeto
cujo **único parâmetro é `HttpContext`**:

```csharp
private static async Task<IResult> SairAsync(HttpContext contexto)
```

`Task<IResult>` converte para `Task` por **covariância de retorno** em conversão de grupo
de métodos. Logo `SairAsync` é conversível para `RequestDelegate` (`Task Invoke(HttpContext)`),
e o compilador elege a sobrecarga **`MapPost(string, RequestDelegate)`** — mais específica
que a de `Delegate`.

⚠️ `RequestDelegate` é uma rota **terminal**: ⛔ sem binding, ⛔ sem `MethodInfo`, e o
valor devolvido é **descartado**.

---

## 🔴 Duas consequências, e nenhuma dava erro

| | O que acontecia |
|---|---|
| 1 | `Results.NoContent()` ⛔ **nunca era escrito** — a resposta saía **200**, ⛔ não 204 |
| 2 | A rota ⛔ **não existia** no OpenAPI nem no `/scalar` |

🔴 **E havia teste cobrindo o logout — verde desde sempre:**

```csharp
await cliente.PostAsync("/api/auth/logout", null);
var resposta = await cliente.GetAsync("/api/seguidos");
Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);   // ⭐ passava
```

⚠️ O `SignOutAsync` **roda** — ele escreve no `HttpContext` antes do `return`. O cookie
caía, o acesso caía, o teste ficava verde. **Só o retorno ia para o lixo.**

> ⭐ **A lição:** conferir só o efeito colateral ⛔ não prova que o handler terminou como
> escrito. O código de resposta é a única coisa que separa as duas.

---

## O que foi feito

| Onde | Mudança |
|---|---|
| `EndpointsAutenticacao.cs` | `MapPost("/logout", **(Delegate)**SairAsync).Produces(204)` |
| `TestesAutenticacao.cs` | `Logout_DerrubaOAcesso` agora confere o **204**, ⛔ não só o 401 seguinte |
| `.editorconfig` | 🔴 **`ASP0016` virou `error`** |

⚠️ **`.Produces()` sozinho ⛔ não resolvia** — foi tentado e medido. Com a sobrecarga
errada, `MapPost` devolve `IEndpointConventionBuilder`, que ⛔ nem tem o método; e mesmo
que tivesse, sem `MethodInfo` o ApiExplorer continuaria pulando a rota. 🔴 **O `(Delegate)`
é o conserto; o `.Produces()` é o contrato.**

---

## ⭐ O analisador sabia

`ASP0016` já apontava, exatamente:

> *The method used to create a RequestDelegate returns `Task<IResult>`. RequestDelegate
> discards this value.*

⚠️ Era **warning**, no meio de dezenas de `CA1305`. Agora é `error` — o `.editorconfig`
deste projeto já promove 11 outros pela mesma razão: **um aviso que ninguém lê ⛔ não é
uma defesa.**

---

## O que isso diz sobre a CT3

O teste de contrato foi escrito esperando pegar **renomeação de campo** (`Acordos` →
`Acertos`, que compila e quebra a tela). ⭐ **A primeira coisa que ele pegou foi outra
categoria inteira:** uma rota que o front chama há semanas e que a API ⛔ não declarava.

📐 Ver também: [`031`](031-a-pec-estava-escondida-como-destaque.md) — o outro achado em
que o dado errado ⛔ não parecia errado.
