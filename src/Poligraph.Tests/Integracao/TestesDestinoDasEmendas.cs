using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Para onde foi o dinheiro das emendas: quem recebeu, quando e por que convênio.
/// </summary>
/// <remarks>
/// <para>
/// Três números desta tela são fáceis de inflar sem erro nenhum: o convênio somado uma vez
/// por emenda, o intermediário contado como destino e a emenda de duas linhas contada
/// duas vezes. Cada um tem o seu teste.
/// </para>
/// </remarks>
public class TestesDestinoDasEmendas(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/parlamentares";
    private const string Codigo = "202541840004";

    /// <summary>
    /// Uma emenda em duas localidades é uma emenda, com o dinheiro das duas.
    /// </summary>
    [SkippableFact]
    public async Task EmendaEmDuasLinhas_ContaUmaVezComOValorDasDuas()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.Emendas.Add(Emenda(pessoaId, "PARANÁ (UF)", 400_000m));
        await Db.SaveChangesAsync();

        var emendas = await LerAsync(pessoaId);

        Assert.Equal(1, emendas.Quantidade);
        Assert.Equal(1_200_000m, emendas.Empenhado);
    }

    /// <summary>
    /// O intermediário, a pessoa e o sem identificação saem da lista, e não da conta.
    /// </summary>
    [SkippableFact]
    public async Task Favorecidos_SeparamIntermediarioPessoaESemIdentificacao()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.EmendasFavorecidos.AddRange(
            Empresa(new DateOnly(2025, 3, 1), 300m),
            Empresa(new DateOnly(2025, 7, 1), 100m),
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
                CodigoEmenda = Codigo, Competencia = new DateOnly(2026, 1, 1),
                Tipo = TipoFavorecido.SEM_INFORMACAO, Valor = 10m
            });
        await Db.SaveChangesAsync();

        var favorecidos = (await LerAsync(pessoaId)).Favorecidos;

        Assert.Equal(960m, favorecidos.Recebido);
        Assert.Equal(500m, favorecidos.ViaIntermediario);
        Assert.Equal(50m, favorecidos.APessoas);
        Assert.Equal(10m, favorecidos.SemIdentificacao);
        Assert.Equal(new DateOnly(2026, 1, 1), favorecidos.UltimoMes);

        var unico = Assert.Single(favorecidos.Maiores);
        Assert.Equal("CONSTRUTORA EXEMPLO LTDA", unico.Nome);
        Assert.Equal(400m, unico.Recebido);
    }

    /// <summary>
    /// O CNPJ de empresa sai — é a chave da página da entidade —; o de empresário
    /// individual, não : é de uma pessoa.
    /// </summary>
    [SkippableFact]
    public async Task Favorecidos_SoSaiCnpjDePessoaJuridica()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.EmendasFavorecidos.AddRange(
            Empresa(new DateOnly(2025, 3, 1), 300m),
            new EmendaFavorecidoModel
            {
                CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 3, 1),
                Tipo = TipoFavorecido.PESSOA_JURIDICA, Documento = "22333444000155",
                Nome = "FULANA DE TAL", NaturezaJuridica = "Empresário (Individual)", Uf = "PR", Valor = 20m
            });
        await Db.SaveChangesAsync();

        using var cliente = CriarCliente();
        var json = await cliente.GetStringAsync($"{Rota}/{pessoaId}/emendas");

        Assert.Contains("12345678000190", json);
        Assert.DoesNotContain("22333444000155", json);
    }

    /// <summary>
    /// PL74: a cota do mesmo parlamentar ao mesmo CNPJ, só nos anos de despesa do mandato
    /// da emenda. A emenda de 2025 é da 57ª, e a cota que conta é a de 2023 a 2026.
    /// </summary>
    [SkippableFact]
    public async Task Favorecido_TambemNaCota_SoDoMesmoParlamentarNoMesmoMandato()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        var outro = await Db.Pessoas.AsNoTracking().Where(p => p.Id != pessoaId).Select(p => p.Id).FirstAsync();
        Db.EmendasFavorecidos.Add(Empresa(new DateOnly(2025, 3, 1), 300m));
        Db.Despesas.AddRange(
            Despesa(pessoaId, 2024, 120m),
            Despesa(pessoaId, 2026, 30m),
            Despesa(pessoaId, 2022, 1_000m),
            Despesa(outro, 2024, 5_000m));
        await Db.SaveChangesAsync();

        var unico = Assert.Single((await LerAsync(pessoaId)).Favorecidos.Maiores);

        Assert.Equal(150m, unico.TambemNaCota);
    }

    /// <summary>Sem pagamento da cota ao CNPJ, o campo vem nulo e a tela não diz nada.</summary>
    [SkippableFact]
    public async Task Favorecido_SemCota_VemNulo()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.EmendasFavorecidos.Add(Empresa(new DateOnly(2025, 3, 1), 300m));
        await Db.SaveChangesAsync();

        Assert.Null(Assert.Single((await LerAsync(pessoaId)).Favorecidos.Maiores).TambemNaCota);
    }

    /// <summary>
    /// A cidade sai da sede de quem recebeu, pelo CNPJ — não da localidade declarada na emenda.
    /// </summary>
    [SkippableFact]
    public async Task Cidades_SaemDaSedeDeQuemRecebeu()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.Municipios.Add(new MunicipioModel { CodigoIbge = "4106902", CodigoTom = "7535", Nome = "CURITIBA", Uf = "PR" });
        Db.CnpjsMunicipio.Add(new CnpjMunicipioModel
        {
            Cnpj = "12345678000190", CodigoIbge = "4106902", CadastroDe = new DateOnly(2026, 9, 1)
        });
        Db.EmendasFavorecidos.AddRange(
            Empresa(new DateOnly(2025, 3, 1), 300m),
            Empresa(new DateOnly(2025, 7, 1), 100m));
        await Db.SaveChangesAsync();

        var cidades = (await LerAsync(pessoaId)).Cidades;

        var curitiba = Assert.Single(cidades.Maiores);
        Assert.Equal(("4106902", 400m), (curitiba.Municipio.CodigoIbge, curitiba.Recebido));
        Assert.Equal(1, cidades.Quantidade);
    }

    [SkippableFact]
    public async Task PagamentosPorMes_VemEmOrdemESomados()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.EmendasFavorecidos.AddRange(
            Empresa(new DateOnly(2025, 12, 1), 70m),
            Empresa(new DateOnly(2025, 3, 1), 30m),
            new EmendaFavorecidoModel
            {
                CodigoEmenda = Codigo, Competencia = new DateOnly(2025, 3, 1),
                Tipo = TipoFavorecido.PESSOA, Valor = 5m
            });
        await Db.SaveChangesAsync();

        var meses = (await LerAsync(pessoaId)).PagamentosPorMes;

        Assert.Equal(
            [(new DateOnly(2025, 3, 1), 35m), (new DateOnly(2025, 12, 1), 70m)],
            meses.Select(m => (m.Mes, m.Valor)));
    }

    /// <summary>
    /// O convênio financiado por duas emendas mostra o valor dele uma vez, e diz que
    /// foram duas.
    /// </summary>
    [SkippableFact]
    public async Task Convenio_DeDuasEmendas_DizQuantasOFinanciam()
    {
        ExigeDocker();
        var pessoaId = await SemearEmendaAsync();
        Db.Convenios.Add(new ConvenioModel
        {
            Numero = "1AAQKR", Convenente = "MUNICIPIO DE LINDOESTE",
            Objeto = "AQUISICAO DE EQUIPAMENTO", DataPublicacao = new DateOnly(2025, 1, 16),
            Valor = 80_000_000m
        });
        Db.EmendasConvenios.AddRange(
            new EmendaConvenioModel { CodigoEmenda = Codigo, NumeroConvenio = "1AAQKR" },
            new EmendaConvenioModel { CodigoEmenda = "202599990001", NumeroConvenio = "1AAQKR" });
        await Db.SaveChangesAsync();

        var convenios = (await LerAsync(pessoaId)).Convenios;

        Assert.Equal(1, convenios.Quantidade);
        var convenio = Assert.Single(convenios.Maiores);
        Assert.Equal(80_000_000m, convenio.Valor);
        Assert.Equal(2, convenio.EmendasQueFinanciam);
    }

    /// <summary>
    /// Pessoa nunca é gravada com nome, e só pessoa jurídica pode ser intermediária.
    /// </summary>
    /// <remarks>
    /// <para>Por SQL, e não pelo EF: quem grava esta tabela é o ETL Python.</para>
    /// <para>O domínio de <c>tipo</c> fica no teste de contrato do Python: um tipo inventado também viola a identificação, e o Postgres reporta a que avalia primeiro.</para>
    /// </remarks>
    [SkippableTheory]
    [InlineData("'PESSOA', NULL, 'FULANA DE TAL', false", "ck_favorecido_identificacao")]
    [InlineData("'PESSOA_JURIDICA', '123', 'EMPRESA', false", "ck_favorecido_identificacao")]
    [InlineData("'PESSOA', NULL, NULL, true", "ck_favorecido_intermediario")]
    [InlineData("'PESSOA_JURIDICA', '12345678000190', NULL, false", "ck_favorecido_identificacao")]
    public async Task Favorecido_ForaDaRegra_ERejeitadoPeloBanco(string valores, string restricao)
    {
        ExigeDocker();

#pragma warning disable EF1002
        var erro = await Assert.ThrowsAsync<PostgresException>(() =>
            Db.Database.ExecuteSqlRawAsync(
                "INSERT INTO emendas_favorecidos (codigo_emenda, competencia, tipo, documento, "
                + "nome, intermediario, valor) "
                + $"VALUES ('202541840004', DATE '2025-03-01', {valores}, 10)"));
#pragma warning restore EF1002

        Assert.Equal(restricao, erro.ConstraintName);
    }

    private record FavorecidoLido(string Nome, decimal Recebido, decimal? TambemNaCota = null);

    private record FavorecidosLidos(
        decimal Recebido, decimal ViaIntermediario, decimal APessoas, decimal SemIdentificacao,
        DateOnly? UltimoMes, IReadOnlyList<FavorecidoLido> Maiores);

    private record MesLido(DateOnly Mes, decimal Valor);

    private record ConvenioLido(string Numero, decimal Valor, int EmendasQueFinanciam);

    private record ConveniosLidos(int Quantidade, IReadOnlyList<ConvenioLido> Maiores);

    private record MunicipioLido(string CodigoIbge, string Nome, string Uf);

    private record CidadeLida(MunicipioLido Municipio, decimal Recebido);

    private record CidadesLidas(int Quantidade, IReadOnlyList<CidadeLida> Maiores);

    private record EmendasLidas(
        int Quantidade, decimal Empenhado, FavorecidosLidos Favorecidos,
        IReadOnlyList<MesLido> PagamentosPorMes, ConveniosLidos Convenios, CidadesLidas Cidades);

    private async Task<long> SemearEmendaAsync()
    {
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Emendas.Add(Emenda(pessoaId, "LINDOESTE - PR", 800_000m));
        await Db.SaveChangesAsync();

        return pessoaId;
    }

    private static EmendaModel Emenda(long pessoaId, string localidade, decimal empenhado) => new()
    {
        PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO DE TAL",
        CodigoEmenda = Codigo, Ano = 2025, Localidade = localidade,
        CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000",
        ValorEmpenhado = empenhado, ValorPago = empenhado / 2
    };

    private static DespesaModel Despesa(long pessoaId, short ano, decimal valor) => new()
    {
        PessoaId = pessoaId, Ano = ano, Mes = 5, Categoria = "PASSAGEM AÉREA",
        Fornecedor = "CONSTRUTORA EXEMPLO LTDA", CnpjOuHash = "12345678000190", ValorLiquido = valor
    };

        private static EmendaFavorecidoModel Empresa(DateOnly mes, decimal valor) => new()
    {
        CodigoEmenda = Codigo, Competencia = mes, Tipo = TipoFavorecido.PESSOA_JURIDICA,
        Documento = "12345678000190", Nome = "CONSTRUTORA EXEMPLO LTDA",
        NaturezaJuridica = "Sociedade Empresária Limitada", Uf = "PR",
        Municipio = "LINDOESTE", Valor = valor
    };

    private async Task<EmendasLidas> LerAsync(long pessoaId)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<EmendasLidas>($"{Rota}/{pessoaId}/emendas"))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
