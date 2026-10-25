using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// O mapa das emendas: a cidade pela sede de quem recebeu, por CNPJ.
/// </summary>
/// <remarks>
/// <para>
/// Os dois erros que este mapa comete sem avisar: pôr no mapa o que não tem sede — o
/// intermediário, a pessoa — e deixar de somar o que ficou fora. Cada um tem o seu teste.
/// </para>
/// </remarks>
public class TestesMapaDeEmendas(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Codigo = "202541840004";
    private const string Luiziana = "4113734";
    private const string Curitiba = "4106902";

    [SkippableFact]
    public async Task Brasil_SomaPorUfEDeclaraOQueFicouFora()
    {
        ExigeDocker();
        await SemearAsync();

        var mapa = await LerAsync<BrasilLido>("/api/mapa/emendas?de=2025&ate=2025");

        Assert.Equal(new PeriodoLido(2025, 2025), mapa.Periodo);
        Assert.Equal(1_560m, mapa.Recebido);
        Assert.Equal(1_000m, mapa.NoMapa);
        Assert.Equal(500m, mapa.ViaIntermediario);
        Assert.Equal(60m, mapa.SemSede);

        var parana = Assert.Single(mapa.PorUf);
        Assert.Equal(("PR", "41", 1_000m, 2), (parana.Uf, parana.CodigoUf, parana.Recebido, parana.Municipios));
    }

    /// <summary>O gráfico de fitas fecha com o "pago em emendas" do mapa, e o banco, a pessoa e o sem informação têm caminho próprio.</summary>
    [SkippableFact]
    public async Task Caminhos_FechamComORecebidoDoMapa()
    {
        ExigeDocker();
        await SemearAsync();

        var mapa = await LerAsync<BrasilLido>("/api/mapa/emendas?de=2025&ate=2025");
        var caminhos = await LerAsync<CaminhosLidos>("/api/mapa/emendas/caminhos?de=2025&ate=2025");

        Assert.Equal(mapa.Recebido, caminhos.Total);
        Assert.Equal(caminhos.Total, caminhos.Caminhos.Sum(c => c.Valor));
        var porRecebedor = caminhos.Caminhos.GroupBy(c => c.Recebedor).ToDictionary(g => g.Key, g => g.Sum(c => c.Valor));
        Assert.Equal(500m, porRecebedor["VIA_BANCO"]);
        Assert.Equal(50m, porRecebedor["PESSOA"]);
        Assert.Equal(10m, porRecebedor["SEM_INFORMACAO"]);
        Assert.True(porRecebedor["MUNICIPIO"] > 0);
    }

    /// <summary>Sem período, todos os anos: a emenda de 2026 entra na conta.</summary>
    [SkippableFact]
    public async Task Brasil_SemPeriodo_SomaTodosOsAnos()
    {
        ExigeDocker();
        await SemearAsync();

        var mapa = await LerAsync<BrasilLido>("/api/mapa/emendas");

        Assert.Equal(new PeriodoLido(2025, 2026), mapa.Periodo);
        Assert.Equal(10_000m, mapa.NoMapa);
    }

    /// <summary>A série por ano traz todos os anos carregados, mesmo com um período de um ano só, e soma o recebido.</summary>
    [SkippableFact]
    public async Task Brasil_PorAno_TrazTodosOsAnosESomaORecebido()
    {
        ExigeDocker();
        await SemearAsync();

        var todos = await LerAsync<BrasilLido>("/api/mapa/emendas");
        var deUmAno = await LerAsync<BrasilLido>("/api/mapa/emendas?ano=2025");

        Assert.Equal([2025, 2026], deUmAno.PorAno!.Select(a => a.AnoDaEmenda));
        Assert.Equal(todos.Recebido, todos.PorAno!.Sum(a => a.Recebido));
    }

    /// <summary>Ponta invertida é desinvertida, e ano fora dos carregados é trazido para dentro.</summary>
    [SkippableFact]
    public async Task Brasil_PeriodoInvertidoOuForaDosAnos_EhAjustado()
    {
        ExigeDocker();
        await SemearAsync();

        var invertido = await LerAsync<BrasilLido>("/api/mapa/emendas?de=2026&ate=2025");
        var fora = await LerAsync<BrasilLido>("/api/mapa/emendas?de=1990&ate=2025");

        Assert.Equal(new PeriodoLido(2025, 2026), invertido.Periodo);
        Assert.Equal(new PeriodoLido(2025, 2025), fora.Periodo);
    }

    [SkippableFact]
    public async Task Estado_TrazTodasAsCidadesDaUf_ComZeroOndeNadaChegou()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Municipios.Add(new MunicipioModel { CodigoIbge = "4100103", CodigoTom = "7401", Nome = "ABATIA", Uf = "PR" });
        await Db.SaveChangesAsync();

        var estado = await LerAsync<EstadoLido>("/api/mapa/emendas/PR?de=2025&ate=2025");

        Assert.Equal(("4100103", 0m), (estado.PorMunicipio[^1].CodigoIbge, estado.PorMunicipio[^1].Recebido));
        Assert.Equal(1_000m, estado.Recebido);
    }

    [SkippableFact]
    public async Task Estado_OrdenaCidadesPeloValor()
    {
        ExigeDocker();
        await SemearAsync();

        var estado = await LerAsync<EstadoLido>("/api/mapa/emendas/pr?de=2025&ate=2025");

        Assert.Equal("PR", estado.Uf);
        Assert.Equal(
            [(Luiziana, 700m), (Curitiba, 300m)],
            estado.PorMunicipio.Select(m => (m.CodigoIbge, m.Recebido)));
    }

    [SkippableFact]
    public async Task Municipio_DizQuemMandouEQuantoFoiParaAPrefeitura()
    {
        ExigeDocker();
        var idPessoa = await SemearAsync();

        var cidade = await LerAsync<MunicipioLido>($"/api/municipios/{Luiziana}/emendas?de=2025&ate=2025");

        Assert.Equal("LUIZIANA", cidade.Municipio.Nome);
        Assert.Equal(700m, cidade.Recebido);
        Assert.Equal(500m, cidade.NaPropriaCidade);

        var autor = Assert.Single(cidade.Parlamentares.Itens);
        Assert.Equal((idPessoa, 700m, 1), (autor.IdPessoa, autor.Recebido, autor.Emendas));
        Assert.Equal(2, cidade.Favorecidos.Total);
        Assert.Empty(cidade.Coletivos);
    }

    /// <summary>As fitas da cidade fecham com o "quem mandou e quem recebeu" da página, e a prefeitura tem o grupo dela.</summary>
    [SkippableFact]
    public async Task Municipio_CaminhosFechamComORecebidoDaCidade()
    {
        ExigeDocker();
        await SemearAsync();

        var cidade = await LerAsync<MunicipioLido>($"/api/municipios/{Luiziana}/emendas?de=2025&ate=2025");
        var caminhos = await LerAsync<CaminhosDaCidadeLidos>($"/api/municipios/{Luiziana}/emendas/caminhos?de=2025&ate=2025");

        Assert.Equal(cidade.Recebido, caminhos.Total);
        Assert.Equal(caminhos.Total, caminhos.Caminhos.Sum(c => c.Valor));
        Assert.Equal(cidade.NaPropriaCidade, caminhos.Caminhos.Where(c => c.Recebedor == "MUNICIPIO").Sum(c => c.Valor));
        Assert.All(caminhos.Caminhos, c => Assert.Equal("FULANO DE TAL", c.QuemMandou));
    }

    /// <summary>Código que não é município responde 404, como a página da cidade.</summary>
    [SkippableFact]
    public async Task Municipio_CaminhosDeCodigoQueNaoEhMunicipio_Responde404()
    {
        ExigeDocker();
        await SemearAsync();

        using var cliente = CriarCliente();
        var resposta = await cliente.GetAsync("/api/municipios/9999999/emendas/caminhos");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>
    /// A emenda de bancada não é de uma pessoa: vai para a lista dos coletivos, e não aparece
    /// como se fosse um deputado.
    /// </summary>
    /// <summary>
    /// Os convênios da cidade são os de quem tem sede nela, pelo CNPJ; e "a liberar" soma só os
    /// em execução — nos outros a execução acabou, e a diferença não é dinheiro que vai chegar.
    /// </summary>
    [SkippableFact]
    public async Task Municipio_ConveniosDaCidade_ALiberarSoEmExecucao()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Convenios.AddRange(
            Convenio("EXEC1", "76205954000150", "EM EXECUÇÃO", 1_000m, 300m),
            Convenio("FIM1", "76205954000150", "PRESTAÇÃO DE CONTAS EM ANÁLISE", 500m, 400m),
            Convenio("OUTRA", "11222333000144", "EM EXECUÇÃO", 9_000m, 0m));
        Db.EmendasConvenios.AddRange(
            new EmendaConvenioModel { CodigoEmenda = Codigo, NumeroConvenio = "EXEC1" },
            new EmendaConvenioModel { CodigoEmenda = Codigo, NumeroConvenio = "FIM1" },
            new EmendaConvenioModel { CodigoEmenda = Codigo, NumeroConvenio = "OUTRA" });
        await Db.SaveChangesAsync();

        var convenios = (await LerAsync<MunicipioComConveniosLido>($"/api/municipios/{Luiziana}/emendas?de=2025&ate=2025")).Convenios;

        Assert.Equal((2, 1), (convenios.Quantidade, convenios.EmExecucao));
        Assert.Equal((1_500m, 700m, 700m), (convenios.Combinado, convenios.Liberado, convenios.ALiberar));
        Assert.Equal(["EXEC1", "FIM1"], convenios.Lista.Itens.Select(c => c.Numero));
    }

    [SkippableFact]
    public async Task Municipio_BancadaVaiParaOsColetivos()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Emendas.Add(new EmendaModel
        {
            CodigoAutor = "7124", NomeAutor = "BANCADA DO PARANA", Tipo = "Emenda de Bancada",
            CodigoEmenda = "202571240001", Ano = 2025, Localidade = "PARANÁ (UF)",
            CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000", ValorEmpenhado = 90m, ValorPago = 90m
        });
        Db.EmendasFavorecidos.Add(
            Juridica("202571240001", "76205954000150", "MUNICIPIO DE LUIZIANA", "Município", 90m));
        await Db.SaveChangesAsync();

        var cidade = await LerAsync<MunicipioLido>($"/api/municipios/{Luiziana}/emendas?de=2025&ate=2025");

        Assert.Single(cidade.Parlamentares.Itens);
        var bancada = Assert.Single(cidade.Coletivos);
        Assert.Equal(("BANCADA", "BANCADA DO PARANA", 90m), (bancada.Tipo, bancada.Nome, bancada.Recebido));
        Assert.Equal(700m, cidade.DeParlamentares);
        Assert.Equal(790m, cidade.Recebido);
    }

    [SkippableFact]
    public async Task Municipio_ListasLongasVemEmPaginas()
    {
        ExigeDocker();
        await SemearAsync();
        var codigoIbge = "4106902";

        var segunda = await LerAsync<PaginaLida<FavorecidoLido>>(
            $"/api/municipios/{codigoIbge}/emendas/favorecidos?de=2025&ate=2025&pagina=2");

        Assert.Equal((2, 1), (segunda.Pagina, segunda.Total));
        Assert.Empty(segunda.Itens);
    }

    /// <summary>O CNPJ de quem recebeu sai: é a chave da página da entidade, e dado público de empresa.</summary>
    [SkippableFact]
    public async Task Municipio_FavorecidoTrazOCnpjDaPaginaDaEntidade()
    {
        ExigeDocker();
        await SemearAsync();

        var cidade = await LerAsync<MunicipioComCnpjLido>($"/api/municipios/{Luiziana}/emendas?de=2025&ate=2025");

        Assert.Contains(cidade.Favorecidos.Itens, f => f.Cnpj == "12345678000190");
    }

    [SkippableFact]
    public async Task Municipio_Inexistente_Retorna404()
    {
        ExigeDocker();
        await SemearAsync();

        using var cliente = CriarCliente();
        var resposta = await cliente.GetAsync("/api/municipios/9999999/emendas");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task Busca_IgnoraCaixaEAcento()
    {
        ExigeDocker();
        await SemearAsync();

        var achados = await LerAsync<List<MunicipioDaBusca>>("/api/municipios?busca=curitiba");

        Assert.Equal(Curitiba, Assert.Single(achados).CodigoIbge);
    }

    /// <summary>Código IBGE e TOM têm tamanho fixo; um código errado não entra.</summary>
    [SkippableTheory]
    [InlineData("'411373', '7979'", "ck_municipio_ibge")]
    [InlineData("'4113734', '797'", "ck_municipio_tom")]
    public async Task Municipio_ComCodigoErrado_ERejeitadoPeloBanco(string codigos, string restricao)
    {
        ExigeDocker();

#pragma warning disable EF1002
        var erro = await Assert.ThrowsAsync<PostgresException>(() =>
            Db.Database.ExecuteSqlRawAsync(
                $"INSERT INTO municipios (codigo_ibge, codigo_tom, nome, uf) VALUES ({codigos}, 'X', 'PR')"));
#pragma warning restore EF1002

        Assert.Equal(restricao, erro.ConstraintName);
    }

    private record PeriodoLido(int PrimeiroAno, int UltimoAno);

    private record CaminhosLidos(PeriodoLido Periodo, decimal Total, IReadOnlyList<CaminhoLido> Caminhos);

    private record CaminhoLido(string? Tipo, string? Area, string Recebedor, decimal Valor);

    private record CaminhosDaCidadeLidos(PeriodoLido Periodo, decimal Total, IReadOnlyList<CaminhoNaCidadeLido> Caminhos);

    private record CaminhoNaCidadeLido(string? QuemMandou, bool Coletivo, string? Area, string Recebedor, decimal Valor);

    private record BrasilLido(
        PeriodoLido Periodo, decimal Recebido, decimal NoMapa, decimal ViaIntermediario, decimal SemSede,
        IReadOnlyList<UfLida> PorUf, IReadOnlyList<AnoLido>? PorAno = null);

    private record AnoLido(int AnoDaEmenda, decimal Recebido);

    private record UfLida(string Uf, string CodigoUf, decimal Recebido, int Municipios);

    private record EstadoLido(string Uf, decimal Recebido, IReadOnlyList<CidadeLida> PorMunicipio);

    private record CidadeLida(string CodigoIbge, decimal Recebido);

    private record MunicipioDaBusca(string CodigoIbge, string Nome, string Uf);

    private record AutorLido(long? IdPessoa, decimal Recebido, int Emendas);

    private record ColetivoLido(string Tipo, string Nome, decimal Recebido);

    private record PaginaLida<T>(IReadOnlyList<T> Itens, int Pagina, int Total);

    private record ConvenioLido(string Numero);

    private record ConveniosLidos(int Quantidade, int EmExecucao, decimal Combinado, decimal Liberado, decimal ALiberar, PaginaLida<ConvenioLido> Lista);

    private record MunicipioComConveniosLido(ConveniosLidos Convenios);

    private static ConvenioModel Convenio(string numero, string cnpj, string situacao, decimal valor, decimal liberado) => new()
    {
        Numero = numero, Convenente = "CONVENENTE", Objeto = "OBJETO", DataPublicacao = new DateOnly(2025, 2, 1),
        Valor = valor, ValorLiberado = liberado, Situacao = situacao, CnpjConvenente = cnpj
    };

    private record FavorecidoLido(string Nome, decimal Recebido);

    private record FavorecidoComCnpjLido(string Nome, string? Cnpj);

    private record MunicipioComCnpjLido(PaginaLida<FavorecidoComCnpjLido> Favorecidos);

    private record MunicipioLido(
        MunicipioDaBusca Municipio, decimal Recebido, decimal NaPropriaCidade, decimal DeParlamentares,
        PaginaLida<AutorLido> Parlamentares, IReadOnlyList<ColetivoLido> Coletivos,
        PaginaLida<FavorecidoLido> Favorecidos);

    /// <summary>
    /// Uma emenda de 2025 que pagou a prefeitura e uma empresa de Luiziana, uma entidade de
    /// Curitiba, o intermediário, uma pessoa e um sem identificação; e uma emenda de 2026.
    /// </summary>
    private async Task<long> SemearAsync()
    {
        await DadosDeTeste.SemearAsync(Db);
        var idPessoa = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Municipios.AddRange(
            new MunicipioModel { CodigoIbge = Luiziana, CodigoTom = "7979", Nome = "LUIZIANA", Uf = "PR" },
            new MunicipioModel { CodigoIbge = Curitiba, CodigoTom = "7535", Nome = "CURITIBA", Uf = "PR" });

        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = idPessoa, CodigoAutor = "4184", NomeAutor = "FULANO DE TAL",
            CodigoEmenda = Codigo, Ano = 2025, Localidade = "LUIZIANA - PR",
            CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000",
            ValorEmpenhado = 2_000m, ValorPago = 1_600m
        });

        var cadastro = new DateOnly(2026, 9, 1);
        Db.CnpjsMunicipio.AddRange(
            new CnpjMunicipioModel { Cnpj = "76205954000150", CodigoIbge = Luiziana, CadastroDe = cadastro },
            new CnpjMunicipioModel { Cnpj = "12345678000190", CodigoIbge = Luiziana, CadastroDe = cadastro },
            new CnpjMunicipioModel { Cnpj = "11222333000144", CodigoIbge = Curitiba, CadastroDe = cadastro });

        Db.EmendasFavorecidos.AddRange(
            Juridica(Codigo, "76205954000150", "MUNICIPIO DE LUIZIANA", "Município", 500m),
            Juridica(Codigo, "12345678000190", "CONSTRUTORA EXEMPLO LTDA", "Sociedade Empresária Limitada", 200m),
            Juridica(Codigo, "11222333000144", "ASSOCIACAO EXEMPLO", "Associação Privada", 300m),
            Juridica("202641840001", "11222333000144", "ASSOCIACAO EXEMPLO", "Associação Privada", 9_000m),
            new EmendaFavorecidoModel
            {
                CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 7, 1),
                Tipo = TipoFavorecido.PESSOA_JURIDICA, Documento = "00000000000191",
                Nome = "BANCO DO BRASIL SA", Uf = "DF", Valor = 500m, Intermediario = true
            },
            new EmendaFavorecidoModel
            {
                CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 7, 1),
                Tipo = TipoFavorecido.PESSOA, Uf = "PR", Valor = 50m
            },
            new EmendaFavorecidoModel
            {
                CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 8, 1),
                Tipo = TipoFavorecido.SEM_INFORMACAO, Valor = 10m
            });

        await Db.SaveChangesAsync();
        return idPessoa;
    }

    private static EmendaFavorecidoModel Juridica(
        string codigo, string cnpj, string nome, string natureza, decimal valor) => new()
    {
        CodigoEmenda = codigo, Competencia = new DateOnly(2025, 3, 1), Tipo = TipoFavorecido.PESSOA_JURIDICA,
        Documento = cnpj, Nome = nome, NaturezaJuridica = natureza, Uf = "PR", Valor = valor
    };

    private async Task<T> LerAsync<T>(string url)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<T>(url))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
