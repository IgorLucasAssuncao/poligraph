using System.Net.Http.Json;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// "Como calculamos" lê os parâmetros de onde o cálculo os lê.
/// </summary>
/// <remarks>
/// <para>
/// O que se protege é a origem: o grafo mostra os parâmetros gravados pela execução mais
/// recente, e a execução antiga, que não os gravava, aparece sem eles em vez de herdar os
/// de hoje.
/// </para>
/// </remarks>
public class TestesEndpointMetodologia(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task Grafo_UsaOsParametrosDaExecucaoMaisRecente()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Execucoes.AddRange(
            Execucao(k: 10, minimo: null),
            Execucao(k: 12, minimo: 25));
        await Db.SaveChangesAsync();

        var camara = (await LerAsync()).Casas.Single(c => c.Casa == "CAMARA");

        Assert.Equal(12, camara.VizinhosPorNo);
        Assert.Equal(25, camara.MinimoVotacoesComuns);
        Assert.Equal(0.86, camara.RazaoRecencia);
    }

    [SkippableFact]
    public async Task ExecucaoAntiga_SemParametros_NaoHerdaOsDeHoje()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Execucoes.Add(Execucao(k: 10, minimo: null));
        await Db.SaveChangesAsync();

        var camara = (await LerAsync()).Casas.Single(c => c.Casa == "CAMARA");

        Assert.Equal(10, camara.VizinhosPorNo);
        Assert.Null(camara.MinimoVotacoesComuns);
    }

    [SkippableFact]
    public async Task Questionario_VemDasConstantesQueCalculam()
    {
        ExigeDocker();
        await SemearAsync();

        var questionario = (await LerAsync()).Questionario;

        Assert.Equal(15, questionario.PerguntasDaCamara);
        Assert.Equal(8 + 7, questionario.AberturaDaCamara + questionario.DesempateDaCamara);
        Assert.Equal(0.60, questionario.FracaoMinimaDeRespostas);
    }

    private record CasaLida(string Casa, int? VizinhosPorNo, int? MinimoVotacoesComuns, double? RazaoRecencia);

    private record QuestionarioLido(
        int PerguntasDaCamara, int AberturaDaCamara, int DesempateDaCamara, double FracaoMinimaDeRespostas);

    private record MetodologiaLida(QuestionarioLido Questionario, List<CasaLida> Casas);

    private static ExecucaoModel Execucao(short k, short? minimo) => new()
    {
        Casa = TipoCasa.CAMARA, Legislatura = 57, K = k, VersaoCarga = "v1",
        Status = TipoStatusDaExecucao.CONCLUIDA, ConcluidaEm = DateTimeOffset.UtcNow,
        MinimoVotacoesComuns = minimo,
        RazaoRecencia = minimo is null ? null : 0.86,
        PesoDestaque = minimo is null ? null : 0.7,
        PesoAutoridade = minimo is null ? null : 0.3
    };

    private async Task SemearAsync() => await DadosDeTeste.SemearAsync(Db);

    private async Task<MetodologiaLida> LerAsync()
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<MetodologiaLida>("/api/metodologia"))!;
    }
}
