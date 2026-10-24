using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Poligraph.Data;
using Poligraph.Tests.Fixtures;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// As rotas de saúde que o health check do container e o Coolify consultam: <c>/alive</c>, <c>/health</c> com o banco,
/// e <c>/health/componentes</c> com o worker e a rotina da ETL, que não derrubam o <c>/health</c>.
/// </summary>
public class TestesSaude(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task Alive_Responde200()
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync("/alive");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.Equal("Healthy", await resposta.Content.ReadAsStringAsync());
    }

    [SkippableFact]
    public async Task Health_ComOBancoDePe_Responde200_MesmoSemWorkerNemRotina()
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.Equal("Healthy", await resposta.Content.ReadAsStringAsync());
    }

    [SkippableFact]
    public async Task Componentes_SemRotina_DizQueNenhumaTerminou_ComOBancoHealthy()
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var checagens = await ChecagensAsync(cliente);

        Assert.Equal("Healthy", checagens[nameof(PoligraphDb)]);
        Assert.Equal("Degraded", checagens["rotina-da-etl"]);
        Assert.NotEqual("Unhealthy", checagens["worker"]);
    }

    [SkippableFact]
    public async Task Componentes_ComRotinaRecente_RotinaHealthy()
    {
        ExigeDocker();
        Db.Eventos.Add(new EventoModel { Tipo = TipoDeEvento.ROTINA_SEMANAL, CriadoEm = DateTimeOffset.UtcNow.AddDays(-2) });
        await Db.SaveChangesAsync();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var checagens = await ChecagensAsync(cliente);

        Assert.Equal("Healthy", checagens["rotina-da-etl"]);
    }

    [SkippableFact]
    public async Task Componentes_ComRotinaDeDezDias_RotinaDegraded()
    {
        ExigeDocker();
        Db.Eventos.Add(new EventoModel { Tipo = TipoDeEvento.ROTINA_SEMANAL, CriadoEm = DateTimeOffset.UtcNow.AddDays(-10) });
        await Db.SaveChangesAsync();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var checagens = await ChecagensAsync(cliente);

        Assert.Equal("Degraded", checagens["rotina-da-etl"]);
    }

    [SkippableFact]
    public async Task Health_ComAllowedHostsDeProducao_AceitaLocalhost_ERecusaOutroHost()
    {
        ExigeDocker();
        using var fabrica = new FabricaApi(ConnectionString)
            .WithWebHostBuilder(b => b.UseSetting("AllowedHosts", "registroaberto.org;www.registroaberto.org"));
        using var cliente = fabrica.CreateClient();

        var doContainer = await cliente.GetAsync("/health");
        using var deFora = new HttpRequestMessage(HttpMethod.Get, "/health");
        deFora.Headers.Host = "outro.example";
        var recusada = await cliente.SendAsync(deFora);

        Assert.Equal(HttpStatusCode.OK, doContainer.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, recusada.StatusCode);
    }

    private static async Task<Dictionary<string, string>> ChecagensAsync(HttpClient cliente)
    {
        var resposta = await cliente.GetAsync("/health/componentes");
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        using var json = JsonDocument.Parse(await resposta.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("checagens").EnumerateArray()
            .ToDictionary(c => c.GetProperty("nome").GetString()!, c => c.GetProperty("status").GetString()!);
    }
}
