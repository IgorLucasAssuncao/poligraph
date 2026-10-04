using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;

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

    /// <summary> Entrar de novo atualiza o perfil e NÃO cria conta nova.</summary>
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
    /// A chave é o `sub`, nunca o e-mail — o Google permite trocar o endereço.
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

    [SkippableFact]
    public async Task Login_NaoGuardaOIdTokenEmLugarNenhum()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" });

        await using var db = CriarContexto();
        var usuario = await db.Usuarios.FirstAsync();

        Assert.DoesNotContain("token-valido", usuario.GoogleSub);
        Assert.DoesNotContain("token-valido", usuario.Email);
    }

    [SkippableFact]
    public async Task SemCookie_EndpointProtegidoRetorna401_NaoRedireciona()
    {
        ExigeDocker();
        using var cliente = CriarCliente(seguirRedirecionamento: false);

        var resposta = await cliente.GetAsync("/api/seguidos");

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
    /// O <c>204</c> não é preciosismo de contrato.
    ///
    /// <para>
    /// Este teste passou por semanas devolvendo <b>200</b>: <c>MapPost</c> tinha
    /// ligado na sobrecarga <c>RequestDelegate</c>, que **descarta** o <c>IResult</c>.
    /// O <c>SignOutAsync</c> rodava — então o acesso caía, e o teste ficava verde —
    /// mas o <c>Results.NoContent()</c> ia para o lixo e a rota sumia do OpenAPI.
    /// Conferir o código devolvido é o que separa "o efeito colateral aconteceu" de
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
    /// "Sair de todos os aparelhos" sem tabela de sessão.
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

    [SkippableFact]
    public async Task Seguir_DuasVezes_EIdempotente()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var idPessoa = await PrimeiraPessoaAsync();

        await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null);
        await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null);

        await using var db = CriarContexto();
        Assert.Equal(1, await db.Segue.CountAsync());
    }

    [SkippableFact]
    public async Task Seguir_ParlamentarInexistente_Retorna404()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsync("/api/seguidos/999999?versao=v1&aceite=true", null);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>
    /// Seguir é só para quem está em exercício: votou na legislatura corrente.
    /// </summary>
    [SkippableFact]
    public async Task Seguir_QuemSaiu_Retorna422_ENaoGrava()
    {
        ExigeDocker();
        await SemearAsync();
        var corrente = await Db.Votacoes.MaxAsync(v => v.Legislatura);
        var ex = new PessoaModel { NomeExibicao = "Ex Deputado", NomeCivil = "EX DEPUTADO" };
        Db.Pessoas.Add(ex);
        Db.Votacoes.Add(new VotacaoModel
        {
            Id = "7777777-1", Casa = TipoCasa.CAMARA, Legislatura = (short)(corrente - 1),
            Data = new DateOnly(2021, 5, 4), Descricao = "Votação antiga",
            Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
        });
        await Db.SaveChangesAsync();
        Db.Votos.Add(new VotoModel { VotacaoId = "7777777-1", PessoaId = ex.Id, Valor = 1, PartidoNoVoto = "X", UfNoVoto = "AC" });
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsync($"/api/seguidos/{ex.Id}?versao=v1&aceite=true", null);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
        await using var db = CriarContexto();
        Assert.Equal(0, await db.Segue.CountAsync());
    }

    [SkippableFact]
    public async Task DeixarDeSeguir_RemoveDaLista()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var idPessoa = await PrimeiraPessoaAsync();

        await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null);
        await cliente.DeleteAsync($"/api/seguidos/{idPessoa}");

        var lista = await cliente.GetFromJsonAsync<List<SeguidoJson>>("/api/seguidos");
        Assert.Empty(lista!);
    }

    /// <summary>
    /// Pendência 62: sem consentimento, seguir responde 428 e nada é gravado. A lista de seguidos
    /// é dado sensível, e a política diz que o consentimento é dado ao seguir.
    /// </summary>
    [SkippableFact]
    public async Task Seguir_SemConsentimento_Retorna428_ENaoGrava()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var idPessoa = await PrimeiraPessoaAsync();

        var semVersao = await cliente.PutAsync($"/api/seguidos/{idPessoa}", null);
        var semAceite = await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1", null);

        Assert.Equal(HttpStatusCode.PreconditionRequired, semVersao.StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionRequired, semAceite.StatusCode);
        await using var db = CriarContexto();
        Assert.Equal(0, await db.Segue.CountAsync());
        Assert.Equal(0, await db.Consentimentos.CountAsync());
    }

    /// <summary>
    /// O aceite grava a versão do texto. Com o texto mudado, a tela pergunta de novo, e a versão
    /// anterior fica revogada, com data: é a prova de "consentiu com o quê, e até quando".
    /// </summary>
    [SkippableFact]
    public async Task Seguir_ComAceite_GravaAVersao_ETextoNovoPerguntaDeNovo()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var pessoas = await Db.Votos.Select(v => v.PessoaId).Distinct().OrderBy(p => p).Take(2).ToListAsync();

        (await cliente.PutAsync($"/api/seguidos/{pessoas[0]}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();
        var textoNovo = await cliente.PutAsync($"/api/seguidos/{pessoas[1]}?versao=v2", null);
        (await cliente.PutAsync($"/api/seguidos/{pessoas[1]}?versao=v2&aceite=true", null)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.PreconditionRequired, textoNovo.StatusCode);
        await using var db = CriarContexto();
        var consentimentos = await db.Consentimentos.OrderBy(c => c.Id).ToListAsync();
        Assert.Equal(["v1", "v2"], consentimentos.Select(c => c.Versao));
        Assert.NotNull(consentimentos[0].RevogadoEm);
        Assert.Null(consentimentos[1].RevogadoEm);
        Assert.Equal(2, await db.Segue.CountAsync());
    }

    /// <summary>Revogar apaga a lista e deixa o consentimento com a data em que acabou (LGPD art. 8º, §5º).</summary>
    [SkippableFact]
    public async Task RevogarConsentimento_ApagaALista_EMarcaARevogacao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var idPessoa = await PrimeiraPessoaAsync();
        (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();

        (await cliente.DeleteAsync("/api/seguidos/consentimento")).EnsureSuccessStatusCode();

        await using var db = CriarContexto();
        Assert.Equal(0, await db.Segue.CountAsync());
        Assert.NotNull((await db.Consentimentos.SingleAsync()).RevogadoEm);
        Assert.Equal(HttpStatusCode.PreconditionRequired,
            (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1", null)).StatusCode);
    }

    /// <summary>Auditoria de 2026-10-03 (CSRF): rota que muda estado recusa o pedido sem o cabeçalho do site.</summary>
    [SkippableFact]
    public async Task RotaDeEscrita_SemOCabecalhoDoSite_Da403()
    {
        ExigeDocker();
        using var fabrica = new FabricaApi(ConnectionString);
        using var semCabecalho = fabrica.Server.CreateClient();
        using var doSite = fabrica.CreateClient();

        var recusada = await semCabecalho.PostAsync("/api/auth/logout", null);
        var aceita = await doSite.PostAsync("/api/auth/logout", null);

        Assert.Equal(System.Net.HttpStatusCode.Forbidden, recusada.StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.NoContent, aceita.StatusCode);
    }

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

    private record SeguidoJson(long IdPessoa, string Nome, string Partido, string Uf);
}
