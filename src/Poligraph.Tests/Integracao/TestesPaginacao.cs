using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// As listas da ficha em páginas: votos, favorecidos e convênios.
/// </summary>
/// <remarks>
/// <para>
/// A ficha cortava os votos em 20 e as listas das emendas em 8, sem dizer que havia mais.
/// O que estes testes protegem é que a página diz o total, que a primeira página é a
/// mesma da ficha, e que avançar não repete nem pula ninguém.
/// </para>
/// </remarks>
public class TestesPaginacao(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/parlamentares";
    private const string Codigo = "202541840004";

    [SkippableFact]
    public async Task Votos_PaginamComTotal_EAPrimeiraEAdaFicha()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        using var cliente = CriarCliente();

        var ficha = await cliente.GetFromJsonAsync<FichaLida>($"{Rota}/{pessoaId}");
        var primeira = await cliente.GetFromJsonAsync<PaginaLida<VotoLido>>($"{Rota}/{pessoaId}/votos?tamanho=2");
        var terceira = await cliente.GetFromJsonAsync<PaginaLida<VotoLido>>($"{Rota}/{pessoaId}/votos?tamanho=2&pagina=3");

        Assert.Equal(5, primeira!.Total);
        Assert.Equal(ficha!.VotosRecentes.Take(2).Select(v => v.VotacaoId), primeira.Itens.Select(v => v.VotacaoId));
        Assert.Single(terceira!.Itens);
    }

    [SkippableFact]
    public async Task Votos_DeParlamentarInexistente_Respondem404()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync($"{Rota}/999999/votos");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>
    /// O total dos identificados vai na ficha, e o intermediário não entra na lista.
    /// </summary>
    [SkippableFact]
    public async Task Favorecidos_PaginamSemOIntermediario()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        Db.EmendasFavorecidos.AddRange(
            Empresa("11111111000191", "EMPRESA A", 300m),
            Empresa("22222222000191", "EMPRESA B", 200m),
            Empresa("33333333000191", "EMPRESA C", 100m),
            new EmendaFavorecidoModel
            {
                CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 3, 1),
                Tipo = TipoFavorecido.PESSOA_JURIDICA, Documento = "00000000000191",
                Nome = "BANCO DO BRASIL SA", Valor = 999m, Intermediario = true
            });
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();

        var segunda = await cliente.GetFromJsonAsync<PaginaLida<FavorecidoLido>>(
            $"{Rota}/{pessoaId}/emendas/favorecidos?tamanho=2&pagina=2");

        Assert.Equal(3, segunda!.Total);
        Assert.Equal("EMPRESA C", Assert.Single(segunda.Itens).Nome);
    }

    [SkippableFact]
    public async Task Convenios_PaginamPeloValor()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        foreach (var (numero, valor) in new[] { ("AAA001", 30m), ("AAA002", 20m), ("AAA003", 10m) })
        {
            Db.Convenios.Add(new ConvenioModel
            {
                Numero = numero, Convenente = $"CONVENENTE {numero}",
                DataPublicacao = new DateOnly(2025, 1, 16), Valor = valor
            });
            Db.EmendasConvenios.Add(new EmendaConvenioModel { CodigoEmenda = Codigo, NumeroConvenio = numero });
        }
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();

        var primeira = await cliente.GetFromJsonAsync<PaginaLida<ConvenioLido>>(
            $"{Rota}/{pessoaId}/emendas/convenios?tamanho=2");
        var segunda = await cliente.GetFromJsonAsync<PaginaLida<ConvenioLido>>(
            $"{Rota}/{pessoaId}/emendas/convenios?tamanho=2&pagina=2");

        Assert.Equal(3, primeira!.Total);
        Assert.Equal(["AAA001", "AAA002"], primeira.Itens.Select(c => c.Numero));
        Assert.Equal(["AAA003"], segunda!.Itens.Select(c => c.Numero));
    }

    /// <summary>A lista de emendas soma as linhas de cada uma e leva ao Portal.</summary>
    [SkippableFact]
    public async Task Emendas_UmaAUma_SomamAsLinhasELevamAoPortal()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO",
            CodigoEmenda = Codigo, Ano = 2025, Localidade = "PARANÁ (UF)",
            ValorEmpenhado = 500m, ValorPago = 100m
        });
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();

        var pagina = await cliente.GetFromJsonAsync<PaginaLida<EmendaLida>>($"{Rota}/{pessoaId}/emendas/lista?ano=2025");

        var emenda = Assert.Single(pagina!.Itens);
        Assert.Equal(1_500m, emenda.Empenhado);
        Assert.Equal(2, emenda.Localidades);
        Assert.Equal($"https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda={Codigo}", emenda.UrlFonte);
    }

    /// <summary>Cada lançamento traz o documento fiscal que a casa publicou.</summary>
    [SkippableFact]
    public async Task Lancamentos_TrazemODocumentoFiscal()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        Db.Despesas.AddRange(
            new DespesaModel { PessoaId = pessoaId, Ano = 2025, Mes = 3, Categoria = "COMBUSTÍVEIS", ValorLiquido = 100m,
                UrlDocumento = "https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=1" },
            new DespesaModel { PessoaId = pessoaId, Ano = 2025, Mes = 5, Categoria = "PASSAGEM AÉREA", ValorLiquido = 200m });
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();

        var pagina = await cliente.GetFromJsonAsync<PaginaLida<LancamentoLido>>($"{Rota}/{pessoaId}/gastos/lancamentos?ano=2025");

        Assert.Equal(2, pagina!.Total);
        Assert.Equal([5, 3], pagina.Itens.Select(l => l.Mes));
        Assert.EndsWith("ideDocumentoFiscal=1", pagina.Itens[1].UrlDocumento);
    }

    /// <summary>
    /// A aba de emendas abre no último ano fechado, e não no ano em andamento, de valores parciais.
    /// </summary>
    [SkippableFact]
    public async Task Emendas_SemAno_AbremNoUltimoAnoFechado()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        var corrente = (short)DateTimeOffset.UtcNow.Year;
        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO",
            CodigoEmenda = $"{corrente}41840001", Ano = corrente, Localidade = "BRASÍLIA - DF",
            ValorEmpenhado = 10m, ValorPago = 1m
        });
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();

        var emendas = await cliente.GetFromJsonAsync<AnoLido>($"{Rota}/{pessoaId}/emendas");

        Assert.Equal(2025, emendas!.Ano);
    }

    private record AnoLido(int Ano);

    private record PaginaLida<T>(List<T> Itens, int Pagina, int Tamanho, int Total);

    private record VotoLido(string VotacaoId);

    private record FichaLida(List<VotoLido> VotosRecentes);

    private record FavorecidoLido(string Nome, decimal Recebido);

    private record ConvenioLido(string Numero, decimal Valor);

    private record EmendaLida(string Codigo, decimal Empenhado, int Localidades, string UrlFonte);

    private record LancamentoLido(int Mes, decimal Valor, string? UrlDocumento);

    private async Task<long> SemearAsync()
    {
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        var pessoaId = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();

        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO",
            CodigoEmenda = Codigo, Ano = 2025, Localidade = "LINDOESTE - PR",
            ValorEmpenhado = 1_000m, ValorPago = 500m
        });
        await Db.SaveChangesAsync();

        return pessoaId;
    }

    private static EmendaFavorecidoModel Empresa(string documento, string nome, decimal valor) => new()
    {
        CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 3, 1),
        Tipo = TipoFavorecido.PESSOA_JURIDICA, Documento = documento, Nome = nome, Valor = valor
    };

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
