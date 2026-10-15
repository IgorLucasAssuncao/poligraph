using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

public class TestesEndpointGrafo(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/grafo";

    /// <summary> Primeiro dia, antes de o ETL analítico rodar: vazio, não erro.</summary>
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
    /// As três camadas de aresta têm naturezas diferentes: similaridade de voto,
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

    /// <summary> Sempre a execução mais recente — é o que dá reprodutibilidade.</summary>
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
        await MontarGrafoAsync(status: TipoStatusDaExecucao.FALHOU);
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.Equal(boa, grafo!.ExecucaoId);
    }

    /// <summary>
    /// O percentual sem a base não se lê: 80% sobre 24 votações e 80% sobre 540 são
    /// afirmações de força muito diferente, e a tela promete mostrar as duas coisas.
    /// </summary>
    [SkippableFact]
    public async Task Aresta_TrazBaseDeVotacoesEOCosseno()
    {
        ExigeDocker();
        await SemearAsync();
        var execucaoId = await MontarGrafoAsync();
        await AcrescentarSimilaridadesAsync(execucaoId, comuns: 137, cosseno: 0.91f);
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.All(grafo!.Arestas, a => Assert.Equal(137, a.VotacoesComuns));
        Assert.All(grafo.Arestas, a => Assert.Equal(0.91f, a.Cosseno));
    }

    /// <summary>
    /// Par de aresta sem linha de similaridade é bug do ETL, não caso normal — mas
    /// derrubar a tela inteira por causa dele deixaria o usuário sem grafo nenhum. A
    /// junção é externa de propósito: a aresta chega, com a base declarada como zero.
    /// </summary>
    [SkippableFact]
    public async Task Aresta_SemLinhaDeSimilaridade_ChegaComBaseZero()
    {
        ExigeDocker();
        await SemearAsync();
        await MontarGrafoAsync();
        using var cliente = CriarCliente();

        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.NotEmpty(grafo!.Arestas);
        Assert.All(grafo.Arestas, a => Assert.Equal(0, a.VotacoesComuns));
        Assert.All(grafo.Arestas, a => Assert.Null(a.Cosseno));
    }

    /// <summary> A foto vem da casa e alimenta o rosto no nó do grafo.</summary>
    [SkippableFact]
    public async Task No_TrazAFotoDaPessoa()
    {
        ExigeDocker();
        await SemearAsync();
        await MontarGrafoAsync();

        var alguem = await Db.Pessoas.OrderBy(p => p.Id).FirstAsync();
        alguem.UrlFoto = "https://www.camara.leg.br/internet/deputado/bandep/1.jpg";
        await Db.SaveChangesAsync();

        using var cliente = CriarCliente();
        var grafo = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        var no = grafo!.Nos.Single(n => n.IdPessoa == alguem.Id);
        Assert.Equal(alguem.UrlFoto, no.UrlFoto);

        Assert.Contains(grafo.Nos, n => n.UrlFoto is null);
    }

    /// <summary>581 KB de JSON viram ~76 KB: o grafo é a maior resposta do site.</summary>
    [SkippableFact]
    public async Task Grafo_ComAcceptEncoding_VemComprimido()
    {
        ExigeDocker();
        await SemearAsync();
        await MontarGrafoAsync();
        using var cliente = CriarCliente();

        using var pedido = new HttpRequestMessage(HttpMethod.Get, Rota);
        pedido.Headers.AcceptEncoding.ParseAdd("br");
        using var resposta = await cliente.SendAsync(pedido);

        Assert.Contains("br", resposta.Content.Headers.ContentEncoding);
    }

    /// <summary>A segunda leitura vem do cache: a execução gravada depois não aparece na mesma hora.</summary>
    [SkippableFact]
    public async Task Grafo_LidoDuasVezes_VemDoCache()
    {
        ExigeDocker();
        await SemearAsync();
        var primeira = await MontarGrafoAsync();
        using var cliente = CriarCliente();

        var antes = await cliente.GetFromJsonAsync<GrafoJson>(Rota);
        await MontarGrafoAsync();
        var depois = await cliente.GetFromJsonAsync<GrafoJson>(Rota);

        Assert.Equal(primeira, antes!.ExecucaoId);
        Assert.Equal(primeira, depois!.ExecucaoId);
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private async Task<long> MontarGrafoAsync(TipoStatusDaExecucao status = TipoStatusDaExecucao.CONCLUIDA)
    {
        var ids = await Db.Pessoas.AsNoTracking()
            .OrderBy(p => p.Id).Select(p => p.Id).ToListAsync();

        var execucao = new ExecucaoModel
        {
            Casa = TipoCasa.CAMARA, Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = status
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            Db.NosMetrica.Add(new NoMetricaModel
            {
                ExecucaoId = execucao.Id,
                PessoaId = ids[i],
                Comunidade = (short)(i / 4),
                EixoX = i / 10f,
                EixoY = 0.5f,
                NVotacoes = 5
            });

            if (i > 0)
            {
                Db.ArestasGrafo.Add(new ArestaGrafoModel
                {
                    ExecucaoId = execucao.Id,
                    PessoaA = ids[i - 1],
                    PessoaB = ids[i],
                    Tipo = TipoDeAresta.SIMILARIDADE_VOTO,
                    Peso = 0.8f
                });
            }
        }

        await Db.SaveChangesAsync();
        return execucao.Id;
    }

    private async Task AcrescentarSimilaridadesAsync(
        long execucaoId, int comuns, float cosseno)
    {
        var arestas = await Db.ArestasGrafo.AsNoTracking()
            .Where(a => a.ExecucaoId == execucaoId && a.Tipo == TipoDeAresta.SIMILARIDADE_VOTO)
            .Select(a => new { a.PessoaA, a.PessoaB })
            .ToListAsync();

        foreach (var aresta in arestas)
        {
            Db.Similaridades.Add(new SimilaridadeModel
            {
                ExecucaoId = execucaoId,
                PessoaA = aresta.PessoaA,
                PessoaB = aresta.PessoaB,
                Metrica = TipoMetrica.CONCORDANCIA,
                Valor = 0.8f,
                NVotacoesComuns = comuns
            });

            Db.Similaridades.Add(new SimilaridadeModel
            {
                ExecucaoId = execucaoId,
                PessoaA = aresta.PessoaA,
                PessoaB = aresta.PessoaB,
                Metrica = TipoMetrica.COSSENO,
                Valor = cosseno,
                NVotacoesComuns = comuns
            });
        }

        await Db.SaveChangesAsync();
    }

    private async Task AcrescentarArestaDeComissaoAsync(long execucaoId)
    {
        var ids = await Db.Pessoas.AsNoTracking()
            .OrderBy(p => p.Id).Select(p => p.Id).Take(2).ToListAsync();

        Db.ArestasGrafo.Add(new ArestaGrafoModel
        {
            ExecucaoId = execucaoId,
            PessoaA = ids[0],
            PessoaB = ids[1],
            Tipo = TipoDeAresta.COMISSAO_COMUM,
            Peso = 1f
        });

        await Db.SaveChangesAsync();
    }

    private record NoJson(
        long IdPessoa, string Nome, string Partido, string Uf,
        short? Comunidade, float? EixoX, float? EixoY, int NVotacoes,
        string? UrlFoto);

    private record ArestaJson(
        long IdPessoaDe, long IdPessoaPara, float Peso, int VotacoesComuns, float? Cosseno);

    private record GrafoJson(
        long ExecucaoId, string Casa, short Legislatura,
        List<NoJson> Nos, List<ArestaJson> Arestas);
}
