using System.Net;
using System.Net.Http.Json;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Os contratos do Executivo federal: o total e as quebras somam o mesmo, a parte sigilosa sai da
/// proporção de contratos, e o contratado soma os anos pelo CNPJ.
/// </summary>
public class TestesEndpointCompras(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/governo/compras";

    [SkippableFact]
    public async Task Total_EAsQuebrasSomamOMesmo()
    {
        ExigeDocker();
        await SemearAsync();

        var compras = await LerAsync(Rota);

        Assert.Equal((4, 1_000m, 1, 300m), (compras.Contratos, compras.Valor, compras.Sigilosos, compras.SemModalidade));
        Assert.Equal(compras.Valor, compras.PorModalidade.Sum(m => m.Valor));
        Assert.Equal(compras.Valor, compras.PorOrgao.Sum(o => o.Valor));
        Assert.Equal(100m, compras.ValorSigiloso);
        Assert.Equal((1, 55_000m), (compras.Divergentes, compras.ValorDescartado));
    }

    [SkippableFact]
    public async Task Contratado_SomaOsAnosPeloCnpj()
    {
        ExigeDocker();
        await SemearAsync();

        var contratado = Assert.Single((await LerAsync(Rota)).Contratados);

        Assert.Equal(("12345678000190", 3, 700m), (contratado.Cnpj, contratado.Contratos, contratado.Valor));
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
        Db.ContratacoesDoOrgao.AddRange(
            new ContratacoesDoOrgaoModel { Ano = 2025, Mes = 1, OrgaoSuperior = "Ministério da Defesa", Modalidade = "Pregão", Contratos = 2, Sigilosos = 1, Valor = 200m },
            new ContratacoesDoOrgaoModel { Ano = 2025, Mes = 2, OrgaoSuperior = "Ministério da Defesa", Modalidade = "Sem Informação", Contratos = 1, Valor = 300m, Divergentes = 1, ValorDescartado = 55_000m },
            new ContratacoesDoOrgaoModel { Ano = 2026, Mes = 1, OrgaoSuperior = "Ministério da Saúde", Modalidade = "Pregão", Contratos = 1, Valor = 500m });
        Db.ContratadosDoGoverno.AddRange(
            new ContratadoDoGovernoModel { Ano = 2025, Cnpj = "12345678000190", Nome = "EMPRESA", Contratos = 2, Valor = 200m },
            new ContratadoDoGovernoModel { Ano = 2026, Cnpj = "12345678000190", Nome = "EMPRESA", Contratos = 1, Valor = 500m });
        await Db.SaveChangesAsync();
    }

    private async Task<ComprasLidas> LerAsync(string rota)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<ComprasLidas>(rota))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private record ValorLido(decimal Valor);

    private record ContratadoLido(string Cnpj, int Contratos, decimal Valor);

    private record ComprasLidas(
        int Contratos, decimal Valor, int Sigilosos, decimal ValorSigiloso, decimal SemModalidade, int Divergentes, decimal ValorDescartado,
        List<ValorLido> PorModalidade, List<ValorLido> PorOrgao, List<ContratadoLido> Contratados);
}
