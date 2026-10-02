using System.Net.Http.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Poligraph.Api.Services;
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

        var linha = Assert.Single(pagina.Itens, p => p.Id == reeleito);
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

        Assert.Equal(atual.Id, busca.Parlamentares[0].Id);
        var ex = Assert.Single(busca.Parlamentares, p => p.Nome.EndsWith("Antigo", StringComparison.Ordinal));
        Assert.Equal(Anterior, ex.Legislatura);
        Assert.NotEqual(busca.LegislaturaCorrente, ex.Legislatura);
    }

    /// <summary>
    /// O feed da página inicial numa requisição só, e só de quem o usuário segue.
    /// </summary>
    [SkippableFact]
    public async Task NoticiasDosSeguidos_TrazSoDeQuemSegue_AcimaDoLimiar()
    {
        ExigeDocker();
        await SemearAsync();
        var ids = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).Take(2).ToListAsync();
        await GravarNoticiaAsync("https://exemplo.gov.br/seguido", ids[0], confianca: 0.9f);
        await GravarNoticiaAsync("https://exemplo.gov.br/fraca", ids[0], confianca: 0.5f);
        await GravarNoticiaAsync("https://exemplo.gov.br/outro", ids[1], confianca: 0.9f);

        using var cliente = ClienteLogado();
        (await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" })).EnsureSuccessStatusCode();
        (await cliente.PutAsync($"/api/seguidos/{ids[0]}", null)).EnsureSuccessStatusCode();

        var feed = await cliente.GetFromJsonAsync<List<NoticiaDoFeedLida>>("/api/seguidos/noticias");

        var item = Assert.Single(feed!);
        Assert.Equal(ids[0], item.PessoaId);
        Assert.Equal("https://exemplo.gov.br/seguido", item.Noticia.Url);
    }

    // PRIVADOS — na ordem de uso

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

    private async Task VotarNaAnteriorAsync(long pessoaId)
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
            VotacaoId = "8888888-1", PessoaId = pessoaId, Valor = 1,
            PartidoNoVoto = "PARTIDO-ANTIGO", UfNoVoto = "AC"
        });

        await Db.SaveChangesAsync();
    }

    private async Task GravarNoticiaAsync(string url, long pessoaId, float confianca)
    {
        var noticia = new NoticiaModel
        {
            Url = url, Titulo = url, Veiculo = "Agência Câmara", HashTitulo = url,
            PublicadaEm = DateTimeOffset.UtcNow, ColetadaEm = DateTimeOffset.UtcNow
        };
        noticia.Pessoas.Add(new NoticiaPessoaModel
        {
            PessoaId = pessoaId, Confianca = confianca, Metodo = TipoMetodoDeCitacao.NOME_COMPLETO
        });
        Db.Noticias.Add(noticia);
        await Db.SaveChangesAsync();
    }

    private HttpClient ClienteLogado() =>
        new FabricaApi(ConnectionString)
            .WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            {
                s.RemoveAll<IValidadorGoogle>();
                s.AddScoped<IValidadorGoogle>(_ => new ValidadorFalso());
            }))
            .CreateClient(new() { HandleCookies = true });

    private record ParlamentarLido(long Id, string Nome, string? Casa, int NVotacoes, short Legislatura);

    private record PaginaLida(List<ParlamentarLido> Itens, int Total, short? LegislaturaCorrente);

    private record BuscaLida(List<ParlamentarLido> Parlamentares, short? LegislaturaCorrente);

    private record NoticiaLida(string Url);

    private record NoticiaDoFeedLida(long PessoaId, NoticiaLida Noticia);
}
