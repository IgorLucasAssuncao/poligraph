using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Pendência 54 — qual grafo vale para cada tela, quando há mais de uma execução.
///
/// <para>
/// Os outros testes gravam uma execução só, e por isso "a mais recente" passava. O
/// defeito apareceu com duas: a análise do Senado rodou por último, e a ficha de todo
/// deputado mostrou zero parecidos. Estes testes gravam a execução errada DEPOIS da
/// certa, que é a ordem que esconde o filtro ausente.
/// </para>
/// </summary>
public class TestesExecucaoVigente(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const short Corrente = 57;
    private const short Anterior = 56;

    [SkippableFact]
    public async Task Ficha_ComGrafoDoSenadoMaisRecente_TrazParecidosDaCamara()
    {
        ExigeDocker();
        await SemearAsync();
        var ids = await IdsAsync();

        await GravarExecucaoAsync(TipoCasa.CAMARA, Corrente, ids, comSimilaridades: true);
        await GravarExecucaoAsync(TipoCasa.SENADO, Corrente, [], comSimilaridades: false);

        var ficha = await ObterAsync<FichaLida>($"/api/parlamentares/{ids[0]}");

        Assert.NotEmpty(ficha.MaisSimilares);
    }

    [SkippableFact]
    public async Task Grafo_ComAnaliseDaLegislaturaAnteriorPorUltimo_MostraACorrente()
    {
        ExigeDocker();
        await SemearAsync();
        var ids = await IdsAsync();

        var daCorrente = await GravarExecucaoAsync(TipoCasa.CAMARA, Corrente, ids, comSimilaridades: false);
        await GravarExecucaoAsync(TipoCasa.CAMARA, Anterior, ids.Take(3).ToList(), comSimilaridades: false);

        var grafo = await ObterAsync<GrafoLido>("/api/grafo");

        Assert.Equal(daCorrente, grafo.ExecucaoId);
        Assert.Equal(Corrente, grafo.Legislatura);
        Assert.Equal([Corrente, Anterior], grafo.LegislaturasComGrafo);
    }

    [SkippableFact]
    public async Task Grafo_PedidaUmaLegislatura_TrazODaquela()
    {
        ExigeDocker();
        await SemearAsync();
        var ids = await IdsAsync();

        await GravarExecucaoAsync(TipoCasa.CAMARA, Corrente, ids, comSimilaridades: false);
        var daAnterior = await GravarExecucaoAsync(TipoCasa.CAMARA, Anterior, ids.Take(3).ToList(), comSimilaridades: false);

        var grafo = await ObterAsync<GrafoLido>($"/api/grafo?legislatura={Anterior}");

        Assert.Equal(daAnterior, grafo.ExecucaoId);
        Assert.Equal(3, grafo.Nos.Count);
    }

    /// <summary>Legislatura sem dado suficiente fica sem grafo: vazia, e fora da lista.</summary>
    [SkippableFact]
    public async Task Grafo_LegislaturaSemGrafo_VemVaziaEForaDaLista()
    {
        ExigeDocker();
        await SemearAsync();
        await GravarExecucaoAsync(TipoCasa.CAMARA, Corrente, await IdsAsync(), comSimilaridades: false);

        var grafo = await ObterAsync<GrafoLido>("/api/grafo?legislatura=55");

        Assert.Equal(0, grafo.ExecucaoId);
        Assert.Empty(grafo.Nos);
        Assert.DoesNotContain((short)55, grafo.LegislaturasComGrafo);
    }

    [SkippableFact]
    public async Task Ficha_DeQuemSoVotouNaLegislaturaAnterior_AbreNaDele()
    {
        ExigeDocker();
        await SemearAsync();

        var exDeputado = new PessoaModel { NomeExibicao = "Ex Deputado", NomeCivil = "EX DEPUTADO" };
        Db.Pessoas.Add(exDeputado);
        await Db.SaveChangesAsync();
        await VotarNaAnteriorAsync(exDeputado.Id);

        var ficha = await ObterAsync<FichaLida>($"/api/parlamentares/{exDeputado.Id}");

        Assert.Equal(Anterior, ficha.Legislatura);
        Assert.Equal(1, ficha.NVotacoes);
        Assert.Equal("PARTIDO-ANTIGO", ficha.Partido);
        Assert.Equal(2019, Assert.Single(ficha.Mandatos).AnoInicial);
    }

    [SkippableFact]
    public async Task Ficha_DeReeleito_ListaOsMandatosEAbreNoPedido()
    {
        ExigeDocker();
        await SemearAsync();
        var reeleito = (await IdsAsync())[0];
        await VotarNaAnteriorAsync(reeleito);

        var naCorrente = await ObterAsync<FichaLida>($"/api/parlamentares/{reeleito}");
        var naAnterior = await ObterAsync<FichaLida>($"/api/parlamentares/{reeleito}?legislatura={Anterior}");
        var votos = await ObterAsync<PaginaDeVotosLida>($"/api/parlamentares/{reeleito}/votos?legislatura={Anterior}");

        Assert.Equal(Corrente, naCorrente.Legislatura);
        Assert.Equal([Corrente, Anterior], naCorrente.Mandatos.Select(m => m.Legislatura));
        Assert.NotEqual("PARTIDO-ANTIGO", naCorrente.Partido);

        Assert.Equal(Anterior, naAnterior.Legislatura);
        Assert.Equal("PARTIDO-ANTIGO", naAnterior.Partido);
        Assert.Equal(1, naAnterior.NVotacoes);
        Assert.Equal(1, votos.Total);
    }

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private async Task<List<long>> IdsAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).ToListAsync();

    private async Task<long> GravarExecucaoAsync(
        TipoCasa casa, short legislatura, List<long> ids, bool comSimilaridades)
    {
        var execucao = new ExecucaoModel
        {
            Casa = casa, Legislatura = legislatura, K = 10,
            VersaoCarga = "teste", Status = TipoStatusDaExecucao.CONCLUIDA
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            Db.NosMetrica.Add(new NoMetricaModel
            {
                ExecucaoId = execucao.Id, PessoaId = ids[i],
                Comunidade = 0, EixoX = i / 10f, EixoY = 0.5f, NVotacoes = 5
            });

            if (!comSimilaridades)
            {
                continue;
            }

            for (var j = i + 1; j < ids.Count; j++)
            {
                Db.Similaridades.Add(new SimilaridadeModel
                {
                    ExecucaoId = execucao.Id, PessoaA = ids[i], PessoaB = ids[j],
                    Metrica = TipoMetrica.CONCORDANCIA, Valor = 0.7f, NVotacoesComuns = 25
                });
            }
        }

        await Db.SaveChangesAsync();
        return execucao.Id;
    }

    private async Task<T> ObterAsync<T>(string rota)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<T>(rota))!;
    }

    private async Task VotarNaAnteriorAsync(long idPessoa)
    {
        var votacao = await Db.Votacoes.FindAsync("8888888-1");
        if (votacao is null)
        {
            votacao = new VotacaoModel
            {
                Id = "8888888-1", Casa = TipoCasa.CAMARA, Legislatura = Anterior,
                Data = new DateOnly(2021, 5, 4), Descricao = "Votação da legislatura anterior",
                Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
            };
            Db.Votacoes.Add(votacao);
        }

        Db.Votos.Add(new VotoModel
        {
            VotacaoId = votacao.Id, PessoaId = idPessoa, Valor = 1,
            PartidoNoVoto = "PARTIDO-ANTIGO", UfNoVoto = "AC"
        });

        await Db.SaveChangesAsync();
    }

    private record SimilarLido(long IdPessoa);

    private record MandatoLido(short Legislatura, string Casa, int AnoInicial, string Partido);

    private record FichaLida(
        long IdPessoa, string Partido, int NVotacoes, short? Legislatura,
        List<SimilarLido> MaisSimilares, List<MandatoLido> Mandatos);

    private record PaginaDeVotosLida(int Total);

    private record NoLido(long IdPessoa);

    private record GrafoLido(long ExecucaoId, short Legislatura, List<NoLido> Nos, List<short> LegislaturasComGrafo);
}
