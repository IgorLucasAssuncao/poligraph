using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// O modo análise (Pendência 73): os arquivos de onde vieram as linhas de um número, no mesmo
/// recorte da tela.
/// </summary>
public class TestesProcedencia(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    /// <summary>
    /// A cota do mandato: conta só os anos de despesa da 57ª, separa as linhas sem carga e
    /// ordena os arquivos pelo número de linhas que deram.
    /// </summary>
    [SkippableFact]
    public async Task Cota_ContaPorArquivo_NoRecorteDoMandato()
    {
        ExigeDocker();
        var (pessoaId, a, b) = await SemearAsync();
        Db.Despesas.AddRange(
            Despesa(pessoaId, 2024, a), Despesa(pessoaId, 2025, a),
            Despesa(pessoaId, 2025, b), Despesa(pessoaId, 2026, null),
            Despesa(pessoaId, 2022, b));
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?pessoa={pessoaId}&legislatura=57");

        Assert.Equal(4, lida.Linhas);
        Assert.Equal(1, lida.LinhasSemCarga);
        Assert.Equal([a, b], lida.Cargas.Select(c => c.Id));
        Assert.Equal([2, 1], lida.Cargas.Select(c => c.Linhas));
        Assert.Contains("2023 a 2026", lida.Regra);

        var primeira = lida.Cargas[0];
        Assert.Equal("Câmara dos Deputados", primeira.Orgao);
        Assert.Equal("etl-0123456789ab", primeira.Versao);
        Assert.Equal(new string('a', 64), primeira.Sha256);
        Assert.StartsWith("Lei 12.527/2011", primeira.BaseLegal);
    }

    /// <summary>Um ano pedido troca o mandato pelo ano.</summary>
    [SkippableFact]
    public async Task Cota_ComAno_SoAquele()
    {
        ExigeDocker();
        var (pessoaId, a, b) = await SemearAsync();
        Db.Despesas.AddRange(Despesa(pessoaId, 2024, a), Despesa(pessoaId, 2025, b));
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?pessoa={pessoaId}&legislatura=57&ano=2025");

        Assert.Equal(b, Assert.Single(lida.Cargas).Id);
    }

    [SkippableTheory]
    [InlineData("/api/procedencia/inventado?pessoa=1&legislatura=57")]
    [InlineData("/api/procedencia/cota?legislatura=57")]
    [InlineData("/api/procedencia/painel?legislatura=57")]
    public async Task ContextoDesconhecidoOuSemParametro_Da404(string rota)
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync(rota);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    private async Task<(long Pessoa, long A, long B)> SemearAsync()
    {
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        var a = Carga('a', "https://www.camara.leg.br/cotas/Ano-2025.csv.zip");
        var b = Carga('b', "https://www.camara.leg.br/cotas/Ano-2024.csv.zip");
        Db.Cargas.AddRange(a, b);
        await Db.SaveChangesAsync();

        return (pessoaId, a.Id, b.Id);
    }

    private static CargaModel Carga(char digito, string url) => new()
    {
        Fonte = TipoFonteDeCarga.CAMARA, Url = url, Sha256 = new string(digito, 64), Bytes = 10,
        Comando = "poligraph_etl cota", Versao = "etl-0123456789ab",
    };

    private static DespesaModel Despesa(long pessoaId, short ano, long? carga) => new()
    {
        PessoaId = pessoaId, Ano = ano, Mes = 3, Categoria = "PASSAGEM AÉREA", ValorLiquido = 10m, CargaId = carga
    };

    private async Task<ProcedenciaLida> LerAsync(string rota)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<ProcedenciaLida>(rota))!;
    }

    private record CargaLida(long Id, string Orgao, string BaseLegal, string Sha256, string? Versao, int Linhas);

    private record ProcedenciaLida(string Regra, int Linhas, int LinhasSemCarga, IReadOnlyList<CargaLida> Cargas);
}
