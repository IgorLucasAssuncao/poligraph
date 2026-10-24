using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Achado #35 — o histórico na base sem atrapalhar quem procura o presente.
///
/// <para>
/// A lista e a busca mostram quem está em exercício. Quem já saiu entra na lista quando
/// pedido, e na busca depois dos atuais, sempre com a legislatura junto, para a tela dizer
/// de quando era.
/// </para>
/// </summary>
public class TestesHistorico(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const short Anterior = 56;

    [SkippableFact]
    public async Task Lista_PorPadrao_SoTrazQuemEstaEmExercicio()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();

        var pagina = await ObterAsync<PaginaLida>("/api/parlamentares?tamanho=100");

        Assert.DoesNotContain(pagina.Itens, p => p.Nome == "Ex Deputado");
        Assert.All(pagina.Itens, p => Assert.Equal(pagina.LegislaturaCorrente, p.Legislatura));
    }

    [SkippableFact]
    public async Task Lista_ComAnteriores_TrazQuemSaiuComOUltimoMandato()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();

        var pagina = await ObterAsync<PaginaLida>("/api/parlamentares?tamanho=100&anteriores=true");
        var ex = Assert.Single(pagina.Itens, p => p.Nome == "Ex Deputado");

        Assert.Equal(Anterior, ex.Legislatura);
        Assert.Equal(1, ex.NVotacoes);
    }

    [SkippableFact]
    public async Task Lista_ComAnteriores_NaoDuplicaQuemTemDoisMandatos()
    {
        ExigeDocker();
        await SemearAsync();
        var reeleito = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();
        await VotarNaAnteriorAsync(reeleito);

        var pagina = await ObterAsync<PaginaLida>("/api/parlamentares?tamanho=100&anteriores=true");

        var linha = Assert.Single(pagina.Itens, p => p.IdPessoa == reeleito);
        Assert.Equal(pagina.LegislaturaCorrente, linha.Legislatura);
    }

    [SkippableFact]
    public async Task Lista_FiltraPorCasa()
    {
        ExigeDocker();
        await SemearAsync();

        var senado = await ObterAsync<PaginaLida>("/api/parlamentares?tamanho=100&casa=SENADO");
        var camara = await ObterAsync<PaginaLida>("/api/parlamentares?tamanho=100&casa=CAMARA");

        Assert.Empty(senado.Itens);
        Assert.NotEmpty(camara.Itens);
        Assert.All(camara.Itens, p => Assert.Equal("CAMARA", p.Casa));
    }

    [SkippableFact]
    public async Task Busca_AchaQuemSaiu_DepoisDeQuemEsta()
    {
        ExigeDocker();
        await SemearAsync();
        var atual = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).FirstAsync();
        await SemearExDeputadoAsync(nome: $"{atual.NomeExibicao} Antigo");

        var busca = await ObterAsync<BuscaLida>($"/api/busca?q={Uri.EscapeDataString(atual.NomeExibicao)}");

        Assert.Equal(atual.Id, busca.Parlamentares[0].IdPessoa);
        var ex = Assert.Single(busca.Parlamentares, p => p.Nome.EndsWith("Antigo", StringComparison.Ordinal));
        Assert.Equal(Anterior, ex.Legislatura);
        Assert.NotEqual(busca.LegislaturaCorrente, ex.Legislatura);
    }

    /// <summary>
    /// Escolhida uma legislatura, a lista é a dela — só quem votou nela —, e não a corrente
    /// com os ex-parlamentares somados.
    /// </summary>
    [SkippableFact]
    public async Task Lista_DeUmaLegislatura_TrazSoQuemVotouNela()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();

        var pagina = await ObterAsync<PaginaLida>($"/api/parlamentares?tamanho=100&legislatura={Anterior}");

        var ex = Assert.Single(pagina.Itens);
        Assert.Equal("Ex Deputado", ex.Nome);
        Assert.Equal(Anterior, ex.Legislatura);
    }

    [SkippableFact]
    public async Task LegislaturaForaDaBase_Da404_NaListaENoPanorama()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await cliente.GetAsync("/api/parlamentares?legislatura=12")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await cliente.GetAsync("/api/panorama?legislatura=12")).StatusCode);
    }

    /// <summary>
    /// O seletor do site lista o que a base tem, da mais recente, e só a maior é a corrente.
    /// </summary>
    [SkippableFact]
    public async Task Legislaturas_ListaAsDaBase_ComACorrenteNoTopo()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();

        var legislaturas = await ObterAsync<List<LegislaturaLida>>("/api/legislaturas");

        Assert.Equal(2, legislaturas.Count);
        Assert.True(legislaturas[0].Corrente);
        Assert.False(legislaturas[1].Corrente);
        Assert.Equal(Anterior, legislaturas[1].Numero);
        Assert.Equal(2019, legislaturas[1].AnoInicial);
        Assert.Equal(["CAMARA"], legislaturas[1].Casas);
    }

    /// <summary>MEDIDO: a Câmara tem 1.548 votações na 51ª e 7 com voto nominal; oferecida, a legislatura abria um grafo vazio.</summary>
    [SkippableFact]
    public async Task Legislaturas_CasaQuaseSemVotoNominal_FicaForaDoSeletor()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();
        for (var i = 0; i < 20; i++)
        {
            Db.Votacoes.Add(new VotacaoModel
            {
                Id = $"7777777-{i}", Casa = TipoCasa.SENADO, Legislatura = Anterior,
                Data = new DateOnly(2021, 6, 1), Descricao = "Votação sem voto nominal publicado",
                Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
            });
        }
        await Db.SaveChangesAsync();

        var legislaturas = await ObterAsync<List<LegislaturaLida>>("/api/legislaturas");

        Assert.Equal(["CAMARA"], legislaturas.Single(l => l.Numero == Anterior).Casas);
    }

    /// <summary>Pendência 44: a legislatura nova só vira a padrão com análise concluída e votações suficientes; até lá, fica a anterior.</summary>
    [SkippableFact]
    public async Task Legislaturas_ANovaSemAnalise_NaoViraAPadrao()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();
        var votante = await Db.Votos.AsNoTracking().Select(v => v.PessoaId).FirstAsync();
        for (var i = 0; i < Legislaturas.VotacoesParaVirar; i++)
        {
            Db.Votacoes.Add(new VotacaoModel
            {
                Id = $"6666666-{i}", Casa = TipoCasa.CAMARA, Legislatura = Anterior,
                Data = new DateOnly(2021, 3, 1).AddDays(i), Descricao = "Votação da legislatura anterior",
                Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
            });
            Db.Votos.Add(new VotoModel { VotacaoId = $"6666666-{i}", PessoaId = votante, Valor = 1, PartidoNoVoto = "P", UfNoVoto = "AC" });
        }
        Db.Execucoes.Add(new ExecucaoModel
        {
            Casa = TipoCasa.CAMARA, Legislatura = Anterior, K = 10, VersaoCarga = "teste", Status = TipoStatusDaExecucao.CONCLUIDA
        });
        await Db.SaveChangesAsync();

        var legislaturas = await ObterAsync<List<LegislaturaLida>>("/api/legislaturas");

        Assert.Equal(Anterior, legislaturas.Single(l => l.Corrente).Numero);
        Assert.Equal(2, legislaturas.Count);
    }

    [SkippableFact]
    public async Task Panorama_DeUmaLegislatura_ContaSoAsVotacoesDela()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearExDeputadoAsync();

        var panorama = await ObterAsync<PanoramaLido>($"/api/panorama?legislatura={Anterior}");

        Assert.Equal(Anterior, panorama.Legislatura);
        var camara = Assert.Single(panorama.PorCasa);
        Assert.Equal(1, camara.Votacoes);
        Assert.Equal(1, camara.Parlamentares);
    }

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private async Task SemearExDeputadoAsync(string nome = "Ex Deputado")
    {
        var ex = new PessoaModel { NomeExibicao = nome, NomeCivil = nome.ToUpperInvariant() };
        Db.Pessoas.Add(ex);
        await Db.SaveChangesAsync();
        await VotarNaAnteriorAsync(ex.Id);
    }

    private async Task<T> ObterAsync<T>(string rota)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<T>(rota))!;
    }

    private async Task VotarNaAnteriorAsync(long idPessoa)
    {
        if (await Db.Votacoes.FindAsync("8888888-1") is null)
        {
            Db.Votacoes.Add(new VotacaoModel
            {
                Id = "8888888-1", Casa = TipoCasa.CAMARA, Legislatura = Anterior,
                Data = new DateOnly(2021, 5, 4), Descricao = "Votação da legislatura anterior",
                Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
            });
        }

        Db.Votos.Add(new VotoModel
        {
            VotacaoId = "8888888-1", PessoaId = idPessoa, Valor = 1,
            PartidoNoVoto = "PARTIDO-ANTIGO", UfNoVoto = "AC"
        });

        await Db.SaveChangesAsync();
    }

    private record ParlamentarLido(long IdPessoa, string Nome, string? Casa, int NVotacoes, short Legislatura);

    private record PaginaLida(List<ParlamentarLido> Itens, int Total, short? LegislaturaCorrente);

    private record BuscaLida(List<ParlamentarLido> Parlamentares, short? LegislaturaCorrente);

    private record LegislaturaLida(short Numero, int AnoInicial, bool Corrente, List<string> Casas);

    private record PanoramaLido(short? Legislatura, List<CasaDoPanoramaLida> PorCasa);

    private record CasaDoPanoramaLida(string Casa, int Votacoes, int Parlamentares);
}
