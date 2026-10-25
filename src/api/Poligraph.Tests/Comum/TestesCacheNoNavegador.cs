using System.Net;

namespace Poligraph.Tests;

/// <summary>
/// O navegador guarda só o que é igual para todo mundo.
/// </summary>
/// <remarks>
/// <para>RISCO: uma rota que lê o usuário com <c>Cache-Control: public</c> deixaria um cache compartilhado entregar a lista de quem uma pessoa segue a outra.</para>
/// </remarks>
public class TestesCacheNoNavegador(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task RotaDeLeituraPublica_PodeSerGuardada()
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync("/api/legislaturas");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.True(resposta.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromMinutes(5), resposta.Headers.CacheControl?.MaxAge);
    }

    /// <summary>O tempo do banco e o do request vão no cabeçalho, para a aba Rede do navegador.</summary>
    [SkippableFact]
    public async Task RespostaDaApi_DizOTempoDoBancoEDoRequest()
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync("/api/entidades");

        var tempo = Assert.Single(resposta.Headers.GetValues("Server-Timing"));
        Assert.Matches(@"^db;dur=[\d.]+;desc=""[1-9]\d* consultas"", total;dur=[\d.]+$", tempo);
    }

    [SkippableFact]
    public async Task RotaDoUsuario_NaoEhGuardada()
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync("/api/seguidos");

        Assert.NotEqual(true, resposta.Headers.CacheControl?.Public);
    }
}
