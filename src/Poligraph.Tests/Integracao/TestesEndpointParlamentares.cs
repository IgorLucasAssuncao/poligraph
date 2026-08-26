using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>Os endpoints de parlamentar, ponta a ponta, contra Postgres real.</summary>
public class TestesEndpointParlamentares : BaseIntegracao
{
    private const string Rota = "/api/parlamentares";

    [SkippableFact]
    public async Task Lista_TrazParlamentaresComVoto()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var lista = await cliente.GetFromJsonAsync<List<ParlamentarJson>>(Rota);

        Assert.NotNull(lista);
        Assert.Equal(12, lista!.Count);
        Assert.All(lista, p => Assert.True(p.NVotacoes > 0));
    }

    [SkippableFact]
    public async Task Lista_FiltraPorPartido()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var lista = await cliente.GetFromJsonAsync<List<ParlamentarJson>>(
            $"{Rota}?partido=PARTIDO-B");

        Assert.NotNull(lista);
        Assert.NotEmpty(lista!);
        Assert.All(lista, p => Assert.Equal("PARTIDO-B", p.Partido));
    }

    [SkippableFact]
    public async Task Lista_BuscaPorNomeIgnoraCaixa()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var lista = await cliente.GetFromJsonAsync<List<ParlamentarJson>>($"{Rota}?nome=ana");

        Assert.NotNull(lista);
        Assert.Contains(lista!, p => p.Nome.Contains("Ana"));
    }

    [SkippableFact]
    public async Task Ficha_InexistenteRetorna404()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync($"{Rota}/999999");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task Ficha_TrazVotosRecentesEFiliacao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        Assert.NotNull(ficha);
        Assert.NotEmpty(ficha!.Nome);
        Assert.NotEmpty(ficha.VotosRecentes);
        Assert.NotEmpty(ficha.Partido);
    }

    /// <summary>
    /// 🔴 A armadilha da invariante I3.
    ///
    /// A similaridade é gravada uma vez por par, sempre com `pessoa_a &lt; pessoa_b`.
    /// Uma consulta que olhasse só `pessoa_a = id` funcionaria para quem tem id baixo
    /// e devolveria lista VAZIA para quem tem id alto — um bug que passa despercebido
    /// porque "funciona" nos primeiros que você testar.
    /// </summary>
    [SkippableFact]
    public async Task Ficha_TrazSimilares_MesmoParaQuemTemIdAlto()
    {
        ExigeDocker();
        await SemearAsync();
        await GravarSimilaridadesAsync();
        using var cliente = CriarCliente();

        var ids = await db_TodosOsIdsAsync();
        var menor = ids.First();
        var maior = ids.Last();

        var fichaMenor = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{menor}");
        var fichaMaior = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{maior}");

        Assert.NotEmpty(fichaMenor!.MaisSimilares);
        Assert.NotEmpty(fichaMaior!.MaisSimilares);   // ⭐ o que quebraria com meio join
    }

    [SkippableFact]
    public async Task Ficha_SemExecucaoConcluida_NaoQuebra()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        Assert.NotNull(ficha);
        Assert.Empty(ficha!.MaisSimilares);   // lista vazia, não erro
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task SemearAsync() =>
        await Poligraph.Migrations.SemeadorDesenvolvimento.SemearAsync(Db);

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task<long> PrimeiroParlamentarAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();

    private async Task<List<long>> db_TodosOsIdsAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).ToListAsync();

    private async Task GravarSimilaridadesAsync()
    {
        var ids = await db_TodosOsIdsAsync();

        var execucao = new Execucao
        {
            Casa = "CAMARA", Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = "CONCLUIDA"
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            for (var j = i + 1; j < ids.Count; j++)
            {
                Db.Similaridades.Add(new Similaridade
                {
                    ExecucaoId = execucao.Id,
                    PessoaA = ids[i],          // I3: menor primeiro
                    PessoaB = ids[j],
                    Metrica = "CONCORDANCIA",
                    Valor = 0.5f + (i + j) / 100f,
                    NVotacoesComuns = 25
                });
            }
        }

        await Db.SaveChangesAsync();
    }

    private record ParlamentarJson(long Id, string Nome, string Partido, string Uf, int NVotacoes);
    private record SimilarJson(long PessoaId, string Nome, string Partido, float Valor, int Comuns);
    private record FichaJson(
        long Id, string Nome, string NomeCivil, string Partido, string Uf, int NVotacoes,
        List<VotoJson> VotosRecentes, List<SimilarJson> MaisSimilares);
    private record VotoJson(string VotacaoId, DateOnly Data, string? Descricao, short? Valor);
}
