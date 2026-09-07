using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Poligraph.Data;
using Poligraph.Api.Services;

namespace Poligraph.Tests.Integracao;

/// <summary>Substitui o Google nos testes — não dá para gerar `id_token` válido aqui.</summary>
public class ValidadorFalso : IValidadorGoogle
{
    public PerfilGoogleDto? Perfil { get; set; } = new(
        "sub-123", "fulano@exemplo.com", true,
        "Fulano de Tal", "Fulano", "de Tal",
        "https://lh3.googleusercontent.com/foto", "pt-BR");

    public Task<PerfilGoogleDto?> ValidarAsync(string idToken, CancellationToken ct = default) =>
        Task.FromResult(idToken == "token-valido" ? Perfil : null);
}

public class TestesAutenticacao(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task Login_ComTokenInvalido_Retorna401()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.PostAsJsonAsync(
            "/api/auth/google", new { idToken = "token-forjado" });

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task Login_ComTokenValido_GravaPerfilCompleto()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.PostAsJsonAsync(
            "/api/auth/google", new { idToken = "token-valido" });
        resposta.EnsureSuccessStatusCode();

        await using var db = CriarContexto();
        var usuario = await db.Usuarios.FirstAsync();

        Assert.Equal("sub-123", usuario.GoogleSub);
        Assert.Equal("fulano@exemplo.com", usuario.Email);
        Assert.Equal("Fulano", usuario.PrimeiroNome);
        Assert.NotNull(usuario.FotoUrl);
    }

    /// <summary>⭐ Entrar de novo atualiza o perfil e NÃO cria conta nova.</summary>
    [SkippableFact]
    public async Task Login_DuasVezes_NaoDuplicaConta()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" });
        await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" });

        await using var db = CriarContexto();
        Assert.Equal(1, await db.Usuarios.CountAsync());
    }

    /// <summary>
    /// 🔴 A chave é o `sub`, ⛔ nunca o e-mail — o Google permite trocar o endereço.
    /// Se o e-mail fosse chave, a troca criaria uma conta órfã e a pessoa perderia
    /// a lista de seguidos sem entender por quê.
    /// </summary>
    [SkippableFact]
    public async Task Login_ComEmailTrocado_AtualizaAContaEmVezDeCriarOutra()
    {
        ExigeDocker();
        var validador = new ValidadorFalso();
        using var cliente = CriarCliente(validador);

        await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" });

        validador.Perfil = validador.Perfil! with { Email = "outro@exemplo.com" };
        await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" });

        await using var db = CriarContexto();
        Assert.Equal(1, await db.Usuarios.CountAsync());
        Assert.Equal("outro@exemplo.com", (await db.Usuarios.FirstAsync()).Email);
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔴 Nenhum token é armazenado
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Login_NaoGuardaOIdTokenEmLugarNenhum()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" });

        await using var db = CriarContexto();
        var usuario = await db.Usuarios.FirstAsync();

        // ⭐ o id_token foi validado e descartado — nenhuma coluna o contém
        Assert.DoesNotContain("token-valido", usuario.GoogleSub);
        Assert.DoesNotContain("token-valido", usuario.Email);
        Assert.Equal(0, await db.TokensEmail.CountAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // Cookie e sessão
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task SemCookie_EndpointProtegidoRetorna401_NaoRedireciona()
    {
        ExigeDocker();
        using var cliente = CriarCliente(seguirRedirecionamento: false);

        var resposta = await cliente.GetAsync("/api/seguidos");

        // 🔴 401, não 302: o front espera JSON, não HTML de tela de login
        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task ComCookie_EndpointProtegidoResponde()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.GetAsync("/api/seguidos");

        resposta.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// ⚠️ O <c>204</c> ⛔ não é preciosismo de contrato.
    ///
    /// <para>
    /// 🔴 Este teste passou por semanas devolvendo <b>200</b>: <c>MapPost</c> tinha
    /// ligado na sobrecarga <c>RequestDelegate</c>, que **descarta** o <c>IResult</c>.
    /// O <c>SignOutAsync</c> rodava — então o acesso caía, e o teste ficava verde —
    /// mas o <c>Results.NoContent()</c> ia para o lixo e a rota ⛔ sumia do OpenAPI.
    /// ⭐ Conferir o código devolvido é o que separa "o efeito colateral aconteceu" de
    /// "o handler terminou como escrito".
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Logout_DerrubaOAcesso()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var saida = await cliente.PostAsync("/api/auth/logout", null);
        var resposta = await cliente.GetAsync("/api/seguidos");

        Assert.Equal(HttpStatusCode.NoContent, saida.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    /// <summary>
    /// ⭐ "Sair de todos os aparelhos" sem tabela de sessão.
    ///
    /// Incrementar `sessao_versao` invalida o cookie que já estava emitido — inclusive
    /// os de outros dispositivos, que este teste simula com um segundo cliente.
    /// </summary>
    [SkippableFact]
    public async Task SairDeTodos_InvalidaCookieDeOutroDispositivo()
    {
        ExigeDocker();
        var validador = new ValidadorFalso();

        using var celular = CriarCliente(validador);
        using var notebook = CriarCliente(validador);
        await EntrarAsync(celular);
        await EntrarAsync(notebook);

        (await notebook.GetAsync("/api/seguidos")).EnsureSuccessStatusCode();

        await celular.PostAsync("/api/auth/sair-de-todos", null);

        var resposta = await notebook.GetAsync("/api/seguidos");
        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    // ═══════════════════════════════════════════════════════════════
    // Seguir — 🔴 escreve dado sensível (LGPD art. 5º, II)
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Seguir_DuasVezes_EIdempotente()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var pessoaId = await PrimeiraPessoaAsync();

        await cliente.PutAsync($"/api/seguidos/{pessoaId}", null);
        await cliente.PutAsync($"/api/seguidos/{pessoaId}", null);

        await using var db = CriarContexto();
        Assert.Equal(1, await db.Segue.CountAsync());
    }

    [SkippableFact]
    public async Task Seguir_ParlamentarInexistente_Retorna404()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsync("/api/seguidos/999999", null);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task DeixarDeSeguir_RemoveDaLista()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var pessoaId = await PrimeiraPessoaAsync();

        await cliente.PutAsync($"/api/seguidos/{pessoaId}", null);
        await cliente.DeleteAsync($"/api/seguidos/{pessoaId}");

        var lista = await cliente.GetFromJsonAsync<List<SeguidoJson>>("/api/seguidos");
        Assert.Empty(lista!);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private HttpClient CriarCliente(
        ValidadorFalso? validador = null, bool seguirRedirecionamento = true)
    {
        var fabrica = new FabricaApi(ConnectionString)
            .WithWebHostBuilder(b => b.ConfigureServices(s =>
            {
                s.RemoveAll<IValidadorGoogle>();
                s.AddScoped<IValidadorGoogle>(_ => validador ?? new ValidadorFalso());
            }));

        return fabrica.CreateClient(new()
        {
            AllowAutoRedirect = seguirRedirecionamento,
            HandleCookies = true
        });
    }

    private static async Task EntrarAsync(HttpClient cliente)
    {
        var resposta = await cliente.PostAsJsonAsync(
            "/api/auth/google", new { idToken = "token-valido" });
        resposta.EnsureSuccessStatusCode();
    }

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private async Task<long> PrimeiraPessoaAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();

    private record SeguidoJson(long PessoaId, string Nome, string Partido, string Uf);
}
