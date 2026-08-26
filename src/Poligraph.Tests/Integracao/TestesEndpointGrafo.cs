using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

public class TestesEndpointGrafo : BaseIntegracao
{
    private const string Rota = "/api/grafo";

    /// <summary>⭐ Primeiro dia, antes de o ETL analítico rodar: vazio, não erro.</summary>
    [SkippableFact]
    public async Task SemExecucao_DevolveGrafoVazio()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.NotNull(grafo);
        Assert.Empty(grafo!.Nos);
        Assert.Empty(grafo.Arestas);
    }

    [SkippableFact]
    public async Task ComExecucao_TrazNosEArestas()
    {
        ExigeDocker();
        await SemearAsync();
        await MontarGrafoAsync();
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.NotNull(grafo);
        Assert.Equal(12, grafo!.Nos.Count);
        Assert.NotEmpty(grafo.Arestas);
        Assert.All(grafo.Nos, n => Assert.NotEmpty(n.Nome));
    }

    /// <summary>
    /// ⚠️ As três camadas de aresta têm naturezas diferentes: similaridade de voto,
    /// comissão comum e coautoria. Só a primeira é o grafo do título — misturar
    /// produziria um desenho sem interpretação.
    /// </summary>
    [SkippableFact]
    public async Task SoTrazArestasDeSimilaridadeDeVoto()
    {
        ExigeDocker();
        await SemearAsync();
        var execucaoId = await MontarGrafoAsync();
        await AcrescentarArestaDeComissaoAsync(execucaoId);
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        var totalNoBanco = await Db.ArestasGrafo.CountAsync();
        Assert.True(totalNoBanco > grafo!.Arestas.Count,
            "a camada de comissão não pode entrar no grafo de similaridade");
    }

    /// <summary>⭐ Sempre a execução mais recente — é o que dá reprodutibilidade.</summary>
    [SkippableFact]
    public async Task ComDuasExecucoes_UsaAMaisRecente()
    {
        ExigeDocker();
        await SemearAsync();
        var antiga = await MontarGrafoAsync();
        var nova = await MontarGrafoAsync();
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.Equal(nova, grafo!.ExecucaoId);
        Assert.NotEqual(antiga, grafo.ExecucaoId);
    }

    /// <summary>Execução que falhou não vira grafo.</summary>
    [SkippableFact]
    public async Task ExecucaoQueFalhou_EIgnorada()
    {
        ExigeDocker();
        await SemearAsync();
        var boa = await MontarGrafoAsync();
        await MontarGrafoAsync(status: "FALHOU");
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.Equal(boa, grafo!.ExecucaoId);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private async Task<long> MontarGrafoAsync(string status = "CONCLUIDA")
    {
        var ids = await Db.Pessoas.AsNoTracking()
            .OrderBy(p => p.Id).Select(p => p.Id).ToListAsync();

        var execucao = new Execucao
        {
            Casa = "CAMARA", Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = status
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            Db.NosMetrica.Add(new NoMetrica
            {
                ExecucaoId = execucao.Id,
                PessoaId = ids[i],
                Comunidade = (short)(i / 4),      // três blocos, como no seed
                EixoX = i / 10f,
                EixoY = 0.5f,
                NVotacoes = 5
            });

            if (i > 0)
            {
                Db.ArestasGrafo.Add(new ArestaGrafo
                {
                    ExecucaoId = execucao.Id,
                    PessoaA = ids[i - 1],          // I3: menor primeiro
                    PessoaB = ids[i],
                    Tipo = "SIMILARIDADE_VOTO",
                    Peso = 0.8f
                });
            }
        }

        await Db.SaveChangesAsync();
        return execucao.Id;
    }

    private async Task AcrescentarArestaDeComissaoAsync(long execucaoId)
    {
        var ids = await Db.Pessoas.AsNoTracking()
            .OrderBy(p => p.Id).Select(p => p.Id).Take(2).ToListAsync();

        Db.ArestasGrafo.Add(new ArestaGrafo
        {
            ExecucaoId = execucaoId,
            PessoaA = ids[0],
            PessoaB = ids[1],
            Tipo = "COMISSAO_COMUM",
            Peso = 1f
        });

        await Db.SaveChangesAsync();
    }

    private record NoJson(
        long Id, string Nome, string Partido, string Uf,
        short? Comunidade, float? EixoX, float? EixoY, int NVotacoes);

    private record ArestaJson(long De, long Para, float Peso);

    private record GrafoJson(
        long ExecucaoId, string Casa, short Legislatura,
        List<NoJson> Nos, List<ArestaJson> Arestas);
}
