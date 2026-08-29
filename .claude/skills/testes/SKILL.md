---
name: testes
description: Padrão de testes do poligraph — xUnit para lógica pura e Testcontainers com Postgres real para integração. Inclui o teste de polaridade (API3), que é obrigatório. Use ao escrever testes ou montar o projeto de testes.
---

# Testes — poligraph

> **Adaptada de `dotnet-testing` (MIT).** A original prega TDD completo com meta de
> cobertura. **Aqui a escolha foi: unitários do que é crítico + integração com Postgres
> real.** Sem meta de cobertura — meta de cobertura vira teste de getter.

**Decisão:** xUnit + Testcontainers · **sem mock de banco** · **sem TDD obrigatório**

---

## 1. 🔴 O teste que não pode faltar — API3, polaridade

> **Em 14% das votações nominais, "Sim" significa rejeitar.** Um sinal invertido **não
> aparece na tela** — aparece como um número plausível e errado, e passa pela banca.

Este é o único teste que o projeto **não pode** entregar sem.

```csharp
public class TestesPolaridade
{
    [Theory]
    // polaridade  voto do parlamentar  resposta do cidadao  concordam?
    [InlineData( 1,  1,  1, true )]   // proposta normal: ambos Sim
    [InlineData( 1, -1,  1, false)]
    [InlineData(-1,  1,  1, false)]   // 🔴 DESTAQUE: "Sim" do parlamentar = rejeitar
    [InlineData(-1, -1,  1, true )]   // 🔴 "Nao" do parlamentar = concorda com quem quer
    [InlineData(-1,  1, -1, true )]
    public void Concordancia_RespeitaPolaridade(
        short polaridade, short voto, short resposta, bool esperado)
    {
        var houve = CalculadoraAfinidade.Concordam(polaridade, voto, resposta);
        Assert.Equal(esperado, houve);
    }

    [Fact]
    public void TodaPerguntaAtiva_TemPolaridadeAtribuida()
    {
        var perguntas = CarregarPerguntasAtivas();
        Assert.All(perguntas, p => Assert.Contains(p.Polaridade, new short[] { -1, 1 }));
    }
}
```

⚠️ **As três linhas com `polaridade = -1` são o teste inteiro.** As de polaridade `+1`
passam mesmo com o código errado.

---

## 2. Estrutura

```
src/Poligraph.Tests/
├── Unidade/
│   ├── TestesPolaridade.cs          🔴 API3
│   ├── TestesNormalizacaoVoto.cs    Sim/Nao/Abstencao/Obstrucao → 1/-1/0
│   ├── TestesCategoria.cs           regex de PROCEDIMENTAL/DESTAQUE/... (A2)
│   └── TestesCpf.cs                 CPF com zero à esquerda
├── Integracao/
│   ├── BaseIntegracao.cs            Testcontainers
│   ├── TestesSchema.cs              os CHECK rejeitam mesmo?
│   ├── TestesIdempotencia.cs        recarga não duplica (RF-09)
│   └── TestesEndpoints.cs           WebApplicationFactory
└── Poligraph.Tests.csproj
```

### 2.1 Pacotes

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
  <PackageReference Include="xunit.v3" Version="1.*" />
  <PackageReference Include="xunit.runner.visualstudio" Version="3.*" />
  <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.*" />
  <PackageReference Include="Testcontainers.PostgreSql" Version="4.*" />
</ItemGroup>
```

⚠️ 🔴 **Cuidado com FluentAssertions.** A partir da **versão 8** a licença virou comercial
(Xceed). A `7.x` continua sob Apache 2.0. Para um TCC, o uso acadêmico não é o problema —
o problema é **descobrir isso depois**. Duas saídas honestas:

| | |
|---|---|
| ⭐ **Assert nativo do xUnit** | Zero dependência, zero questão de licença |
| **AwesomeAssertions** | Fork livre da 7.x, API idêntica |

**Este projeto usa `Assert` nativo.** Menos uma dependência para justificar.

---

## 3. Nomes de teste

```
Metodo_Cenario_ResultadoEsperado
```

| ✅ | ⛔ |
|---|---|
| `Concordancia_RespeitaPolaridade` | `Test1` |
| `Ingestao_ReexecutadaNaoDuplica` | `TestIngest` |
| `Afinidade_ComPoucasRespostas_Retorna422` | `AfinidadeTest` |

⭐ **O nome do teste é documentação do requisito.** `Afinidade_ComPoucasRespostas_Retorna422`
diz o que a CT7 decidiu — sem abrir o documento.

---

## 4. Integração com Postgres real

> **Não usar banco em memória.** O `InMemory` do EF não tem `CHECK`, não tem FK, não tem
> tipo — ele passaria em tudo que este projeto precisa validar.

```csharp
public abstract class BaseIntegracao : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .Build();

    protected PoligraphDb Db { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();

        var opcoes = new DbContextOptionsBuilder<PoligraphDb>()
            .UseNpgsql(_postgres.GetConnectionString())
            .UseSnakeCaseNamingConvention()      // 🔴 igual à produção
            .Options;

        Db = new PoligraphDb(opcoes);
        await Db.Database.MigrateAsync();        // ⭐ testa a migration de verdade
    }

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();
}
```

⭐ **`MigrateAsync` no teste faz a migration ser exercitada a cada execução.** Se um `CHECK`
sumir na tradução para EF, o teste abaixo acusa.

### 4.1 Os testes que só existem por causa deste projeto

```csharp
public class TestesSchema : BaseIntegracao
{
    [Fact]
    public async Task Similaridade_ComMenosDe20VotacoesComuns_ERejeitada()
    {
        Db.Similaridades.Add(new Similaridade { NVotacoesComuns = 19, /* ... */ });
        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Aresta_EntreCasasDiferentes_ERejeitada()   // invariante I1
    {
        // deputado × senador nunca podem ter aresta — achado #7
    }

    [Fact]
    public async Task Voto_ComValorForaDoDominio_ERejeitado()    // RN-03
    {
        Db.Votos.Add(new Voto { Valor = 2 });
        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }
}
```

> 🔑 **Estes testes não testam código — testam se as regras medidas sobreviveram à
> tradução para EF.** É o único jeito de garantir que um `HasCheckConstraint` não
> desapareceu numa migration.

---

## 5. O que testar e o que não testar

| ✅ Testar | ⛔ Não testar |
|---|---|
| 🔴 Polaridade (API3) | Getters e setters |
| Normalização de voto (RN-03) | O EF Core |
| Regex de categoria (A2) | Bibliotecas de terceiros |
| CPF com zero à esquerda | Mapeamento de DTO trivial |
| Idempotência da ingestão (RF-09) | Configuração de DI |
| Os `CHECK` do schema | |
| O `422` de respostas insuficientes (CT7) | |

⛔ **Sem meta de cobertura.** Cobertura alta com os testes errados dá confiança falsa —
e o bug de polaridade passaria com 95% de cobertura.

---

## 6. Comandos

```bash
dotnet test                                    # tudo
dotnet test --filter FullyQualifiedName~Unidade    # rápido, sem Docker
dotnet test --filter FullyQualifiedName~Integracao # precisa de Docker rodando
```

⚠️ **A integração exige Docker de pé** — local e no CI. O runner do GitHub Actions já
tem; sua máquina precisa do Docker Desktop aberto.

### 6.1 🔴 Nesta máquina, `dotnet test` nativo NÃO roda

Medido em 2026-08-29. Dois bloqueios **independentes**, e os dois precisam de desvio:

| Bloqueio | Sintoma | Causa |
|---|---|---|
| **Aspire de pé** | `MSB3021 … arquivo é bloqueado por Poligraph.Api` | a API segura o `.dll` que o build precisa reescrever |
| 🔴 **Smart App Control** | `FileLoadException … Uma política de Controle de Aplicativo bloqueou (0x800711C7)` | está em **imposição** (`VerifiedAndReputablePolicyState = 1`) e recusa binário recém-compilado, sem reputação |

⚠️ **Parar o Aspire ⛔ não basta** — o segundo bloqueio aparece logo em seguida. E ⛔
**não desligue o Smart App Control**: no Windows 11 ele só volta a ser ligado
reinstalando o sistema.

⭐ **A saída é rodar num container**, que passa por fora do SAC:

```bash
podman run --rm --network host   -v "$PWD:/repo:ro"   -v "/run/user/1000/podman/podman.sock:/var/run/docker.sock"   -e DOCKER_HOST=unix:///var/run/docker.sock   -e TESTCONTAINERS_RYUK_DISABLED=true   mcr.microsoft.com/dotnet/sdk:10.0   bash -lc 'cp -r /repo /work && cd /work && rm -rf src/*/bin src/*/obj && dotnet test src/Poligraph.Tests'
```

📐 Cada pedaço resolve um problema medido, ⛔ nenhum é decoração:

| Trecho | Por quê |
|---|---|
| 🔴 `--network host` | O Postgres do Testcontainers publica na VM do Podman. Sem isto: **94 de 125 falham** com `Failed to connect to 127.0.0.1:44701` |
| `podman.sock` montado | O Testcontainers precisa falar com o runtime para criar o Postgres |
| `:ro` + `cp -r /repo /work` | ⛔ O `obj/` do Linux ⛔ não pode contaminar o do Windows |
| `rm -rf src/*/bin src/*/obj` | Restos do build do Windows quebram a compilação no Linux |
| `TESTCONTAINERS_RYUK_DISABLED` | O Ryuk ⛔ não sobe bem com socket montado |

⛔ **⛔ Não redirecione `BaseOutputPath` para contornar o Aspire.** Foi tentado: o SAC
bloqueia igual, e apontar `BaseIntermediateOutputPath` junto faz todos os projetos
compartilharem um `obj/`, gerando `CS0579 Duplicar atributo`.

---

## 7. No CI

```yaml
- run: dotnet test --filter FullyQualifiedName~Unidade     # sempre, rápido
- run: dotnet test --filter FullyQualifiedName~Integracao  # sempre, mais lento
```

🔴 **O job que roda a polaridade não pode ser opcional.** É o teste que separa um número
certo de um número plausível.
