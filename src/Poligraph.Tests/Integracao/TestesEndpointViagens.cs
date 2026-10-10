using System.Net;
using System.Net.Http.Json;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// As viagens a serviço do Executivo federal: o total é a soma dos quatro tipos de pagamento, o
/// órgão sigiloso aparece como os outros, e destino nacional e no exterior não se misturam.
/// </summary>
public class TestesEndpointViagens(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/governo/viagens";

    [SkippableFact]
    public async Task Total_SomaOsQuatroTipos_EOSigilosoFicaAVista()
    {
        ExigeDocker();
        await SemearAsync();

        var viagens = await LerAsync(Rota);

        Assert.Equal((1_116m, 1_000m, 100m, 3, 1), (viagens.Total, viagens.Diarias, viagens.Passagens, viagens.Viagens, viagens.Urgentes));
        Assert.Equal(16m, viagens.Sigiloso);
        Assert.Equal(["Ministério da Saúde", "Sigiloso"], viagens.PorOrgao.Select(o => o.Orgao));
        Assert.Equal([(2025, 600m), (2026, 516m)], viagens.PorAno.Select(a => (a.AnoDaViagem, a.Total)));
    }

    [SkippableFact]
    public async Task Destinos_SomamOsAnos_ESeparamBrasilDoExterior()
    {
        ExigeDocker();
        await SemearAsync();

        var viagens = await LerAsync(Rota);

        Assert.Equal([("Brasília", 7)], viagens.Destinos.Select(d => (d.Cidade, d.Chegadas)));
        Assert.Equal([("Paris", 2)], viagens.DestinosNoExterior.Select(d => (d.Cidade, d.Chegadas)));
    }

    [SkippableFact]
    public async Task Periodo_DeUmAnoSo()
    {
        ExigeDocker();
        await SemearAsync();

        var viagens = await LerAsync($"{Rota}?ano=2026");

        Assert.Equal((2026, 2026, 516m), (viagens.Periodo.PrimeiroAno, viagens.Periodo.UltimoAno, viagens.Total));
    }

    [SkippableFact]
    public async Task Orgao_FiltraTotaisEDestinos_EMantemAListaDeOrgaos()
    {
        ExigeDocker();
        await SemearAsync();

        var viagens = await LerAsync($"{Rota}?orgao={Uri.EscapeDataString("Ministério da Saúde")}");

        Assert.Equal("Ministério da Saúde", viagens.Orgao);
        Assert.Equal((1_100m, 0m, 200m), (viagens.Total, viagens.Sigiloso, viagens.PagoComOrgaoSigiloso));
        Assert.Equal([("Brasília", 7)], viagens.Destinos.Select(d => (d.Cidade, d.Chegadas)));
        Assert.Empty(viagens.DestinosNoExterior);
        Assert.Equal(["Ministério da Saúde", "Sigiloso"], viagens.PorOrgao.Select(o => o.Orgao));
    }

    [SkippableFact]
    public async Task OrgaoQueNaoExiste_MostraTodos()
    {
        ExigeDocker();
        await SemearAsync();

        var viagens = await LerAsync($"{Rota}?orgao=Inventado");

        Assert.Null(viagens.Orgao);
        Assert.Equal(1_116m, viagens.Total);
    }

    [SkippableFact]
    public async Task SemCarga_Responde404()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        Assert.Equal(HttpStatusCode.NotFound, (await cliente.GetAsync(Rota)).StatusCode);
    }

    private async Task SemearAsync()
    {
        Db.ViagensDoOrgao.AddRange(
            Orgao(2025, "Ministério da Saúde", viagens: 1, urgentes: 0, diarias: 500m, passagens: 100m),
            new ViagensDoOrgaoModel
            {
                Ano = 2026, OrgaoSuperior = "Ministério da Saúde", Viagens = 1, Urgentes = 1, Diarias = 500m, PagoComOrgaoSigiloso = 200m
            },
            new ViagensDoOrgaoModel { Ano = 2026, OrgaoSuperior = "Sigiloso", Viagens = 1, Restituicao = 6m, Seguro = 10m });
        Db.DestinosDeViagem.AddRange(
            new DestinoDeViagemModel { Ano = 2025, Pais = "Brasil", Uf = "Distrito Federal", Cidade = "Brasília", OrgaoSuperior = "Ministério da Saúde", Chegadas = 3 },
            new DestinoDeViagemModel { Ano = 2026, Pais = "Brasil", Uf = "Distrito Federal", Cidade = "Brasília", OrgaoSuperior = "Ministério da Saúde", Chegadas = 4 },
            new DestinoDeViagemModel { Ano = 2026, Pais = "França", Uf = null, Cidade = "Paris", OrgaoSuperior = "Sigiloso", Chegadas = 2 });
        await Db.SaveChangesAsync();
    }

    private static ViagensDoOrgaoModel Orgao(short ano, string orgao, int viagens, int urgentes, decimal diarias, decimal passagens) => new()
    {
        Ano = ano, OrgaoSuperior = orgao, Viagens = viagens, Urgentes = urgentes, Diarias = diarias, Passagens = passagens
    };

    private async Task<ViagensLidas> LerAsync(string rota)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<ViagensLidas>(rota))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private record PeriodoLido(int PrimeiroAno, int UltimoAno);

    private record AnoLido(int AnoDaViagem, decimal Total);

    private record OrgaoLido(string Orgao);

    private record DestinoLido(string Cidade, int Chegadas);

    private record ViagensLidas(
        PeriodoLido Periodo, string? Orgao, decimal Total, decimal Diarias, decimal Passagens, int Viagens, int Urgentes,
        decimal Sigiloso, decimal PagoComOrgaoSigiloso,
        List<AnoLido> PorAno, List<OrgaoLido> PorOrgao, List<DestinoLido> Destinos, List<DestinoLido> DestinosNoExterior);
}
