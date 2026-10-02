using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Quem recebeu emenda, por pessoa jurídica: a lista, a página e a busca do cabeçalho.
/// </summary>
/// <remarks>
/// <para>
/// Os erros que esta tela cometeria sem avisar: tratar bancada como pessoa, mostrar o CNPJ
/// de um empresário individual e casar a cota pelo nome em vez do CNPJ. Cada um tem o seu teste.
/// </para>
/// </remarks>
public class TestesEntidades(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Associacao = "11222333000144";
    private const string Prefeitura = "76205954000150";
    private const string Individual = "22333444000155";

    [SkippableFact]
    public async Task Lista_OrdenaPeloValor_EFiltraPorGrupo()
    {
        ExigeDocker();
        await SemearAsync();

        var todas = await LerAsync<PaginaLida<EntidadeLida>>("/api/entidades");
        var semFins = await LerAsync<PaginaLida<EntidadeLida>>("/api/entidades?grupo=SEM_FINS_LUCRATIVOS");

        Assert.Equal([Prefeitura, Associacao], todas.Itens.Select(e => e.Cnpj));
        Assert.Equal([Associacao], semFins.Itens.Select(e => e.Cnpj));
        Assert.Equal("SEM_FINS_LUCRATIVOS", semFins.Itens[0].Grupo);
        Assert.Equal("CURITIBA", semFins.Itens[0].Sede!.Nome);
    }

    /// <summary>RISCO: O CNPJ de empresário individual é de uma pessoa: Não entra na lista.</summary>
    [SkippableFact]
    public async Task Lista_DeixaDeForaEmpresarioIndividual()
    {
        ExigeDocker();
        await SemearAsync();

        using var cliente = CriarCliente();
        var json = await cliente.GetStringAsync("/api/entidades");

        Assert.DoesNotContain(Individual, json);
    }

    [SkippableTheory]
    [InlineData("associacao exemplo")]
    [InlineData("ASSOCIAÇÃO")]
    [InlineData("11.222.333")]
    public async Task Busca_PorNomeSemAcentoOuPorCnpj(string termo)
    {
        ExigeDocker();
        await SemearAsync();

        var achadas = await LerAsync<PaginaLida<EntidadeLida>>($"/api/entidades?busca={Uri.EscapeDataString(termo)}");

        Assert.Equal(Associacao, Assert.Single(achadas.Itens).Cnpj);
    }

    /// <summary>
    /// A página separa quem é pessoa de quem é grupo, soma por ano e cruza a cota pelo CNPJ —
    /// Não pelo nome, que na cota vem escrito de outro jeito.
    /// </summary>
    [SkippableFact]
    public async Task Pagina_SeparaAutores_SomaPorAno_ECruzaACotaPeloCnpj()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();

        var entidade = await LerAsync<EntidadeLidaCompleta>($"/api/entidades/{Associacao}");

        Assert.Equal(1_300m, entidade.Recebido);
        Assert.Equal([(2025, 300m), (2026, 1_000m)], entidade.PorAno.Select(a => (a.Ano, a.Recebido)));
        Assert.Equal((pessoaId, 300m), (Assert.Single(entidade.Parlamentares.Itens).PessoaId, entidade.DeParlamentares));
        Assert.Equal("BANCADA", Assert.Single(entidade.Coletivos).Tipo);
        Assert.Equal($"https://portaldatransparencia.gov.br/busca/pessoa-juridica/{Associacao}", entidade.UrlFonte);

        var cota = entidade.NaCota!;
        Assert.Equal((150m, 2), (cota.Total, cota.Lancamentos));
        Assert.Equal(pessoaId, Assert.Single(cota.PorParlamentar).PessoaId);
    }

    [SkippableTheory]
    [InlineData("99999999000199")]
    [InlineData("123")]
    [InlineData(Individual)]
    public async Task Pagina_ForaDaLista_Responde404(string cnpj)
    {
        ExigeDocker();
        await SemearAsync();

        using var cliente = CriarCliente();
        var resposta = await cliente.GetAsync($"/api/entidades/{cnpj}");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>"Curitiba" é cidade e parte do nome de entidade: a busca responde nos dois grupos.</summary>
    [SkippableFact]
    public async Task BuscaDoCabecalho_RespondeNosTresGrupos()
    {
        ExigeDocker();
        await SemearAsync();

        var busca = await LerAsync<BuscaLida>("/api/busca?q=curitiba");

        Assert.Equal("4106902", Assert.Single(busca.Municipios).CodigoIbge);
        Assert.Equal(Associacao, Assert.Single(busca.Entidades).Cnpj);
        Assert.NotNull(busca.Parlamentares);
    }

    [SkippableFact]
    public async Task BuscaDoCabecalho_TermoCurto_VoltaVazia()
    {
        ExigeDocker();
        await SemearAsync();

        var busca = await LerAsync<BuscaLida>("/api/busca?q=c");

        Assert.Empty(busca.Municipios);
        Assert.Empty(busca.Entidades);
        Assert.Empty(busca.Parlamentares);
    }

    [Theory]
    [InlineData("Município", GrupoDeEntidade.MUNICIPIO)]
    [InlineData("Fundo Público da Administração Direta Municipal", GrupoDeEntidade.MUNICIPIO)]
    [InlineData("Estado ou Distrito Federal", GrupoDeEntidade.ESTADO)]
    [InlineData("Autarquia Estadual ou do Distrito Federal", GrupoDeEntidade.ESTADO)]
    [InlineData("Associação Privada", GrupoDeEntidade.SEM_FINS_LUCRATIVOS)]
    [InlineData("Organização Social (OS)", GrupoDeEntidade.SEM_FINS_LUCRATIVOS)]
    [InlineData("Sociedade Empresária Limitada", GrupoDeEntidade.EMPRESA)]
    [InlineData("Empresa Pública", GrupoDeEntidade.EMPRESA)]
    [InlineData("Consórcio Público de Direito Público (Associação Pública)", GrupoDeEntidade.OUTRO)]
    [InlineData(null, GrupoDeEntidade.OUTRO)]
    public void Grupo_SaiDaNaturezaJuridica(string? natureza, GrupoDeEntidade esperado) =>
        Assert.Equal(esperado, ServicoEntidades.GrupoDe(natureza));

    private record PaginaLida<T>(List<T> Itens, int Pagina, int Total);

    private record SedeLida(string CodigoIbge, string Nome, string Uf);

    private record EntidadeLida(string Cnpj, string Nome, string Grupo, SedeLida? Sede, decimal Recebido);

    private record AnoLido(int Ano, decimal Recebido);

    private record AutorLido(long? PessoaId, decimal Recebido);

    private record ColetivoLido(string Tipo, decimal Recebido);

    private record CotaPorParlamentarLida(long PessoaId, decimal Total);

    private record CotaLida(decimal Total, int Lancamentos, List<CotaPorParlamentarLida> PorParlamentar);

    private record EntidadeLidaCompleta(
        string Cnpj, decimal Recebido, string UrlFonte, List<AnoLido> PorAno, decimal DeParlamentares,
        PaginaLida<AutorLido> Parlamentares, List<ColetivoLido> Coletivos, CotaLida? NaCota);

    private record MunicipioLido(string CodigoIbge);

    private record EntidadeNaBusca(string Cnpj);

    private record BuscaLida(List<object> Parlamentares, List<MunicipioLido> Municipios, List<EntidadeNaBusca> Entidades);

    /// <summary>
    /// Uma associação de Curitiba com emenda individual (2025) e de bancada (2026), paga também
    /// pela cota; uma prefeitura que recebeu mais; um empresário individual.
    /// </summary>
    private async Task<long> SemearAsync()
    {
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Municipios.AddRange(
            new MunicipioModel { CodigoIbge = "4106902", CodigoTom = "7535", Nome = "CURITIBA", Uf = "PR" },
            new MunicipioModel { CodigoIbge = "4113734", CodigoTom = "7979", Nome = "LUIZIANA", Uf = "PR" });

        var cadastro = new DateOnly(2026, 9, 1);
        Db.CnpjsMunicipio.AddRange(
            new CnpjMunicipioModel { Cnpj = Associacao, CodigoIbge = "4106902", CadastroDe = cadastro },
            new CnpjMunicipioModel { Cnpj = Prefeitura, CodigoIbge = "4113734", CadastroDe = cadastro });

        Db.Emendas.AddRange(
            Emenda("202541840004", pessoaId, "4184", "FULANO DE TAL", "Emenda Individual - Transferências com Finalidade Definida"),
            Emenda("202671240001", null, "7124", "BANCADA DO PARANA", "Emenda de Bancada"));

        Db.EmendasFavorecidos.AddRange(
            Juridica("202541840004", Associacao, "ASSOCIAÇÃO EXEMPLO DE CURITIBA", "Associação Privada", 300m),
            Juridica("202671240001", Associacao, "ASSOCIAÇÃO EXEMPLO DE CURITIBA", "Associação Privada", 1_000m),
            Juridica("202541840004", Prefeitura, "MUNICIPIO DE LUIZIANA", "Município", 5_000m),
            Juridica("202541840004", Individual, "FULANA DE TAL", "Empresário (Individual)", 50m));

        Db.Despesas.AddRange(
            Cota(pessoaId, Associacao, "ASSOC EXEMPLO", 100m),
            Cota(pessoaId, Associacao, "ASSOCIACAO EXEMPLO CWB", 50m));

        await Db.SaveChangesAsync();
        return pessoaId;
    }

    private static EmendaModel Emenda(string codigo, long? pessoaId, string codigoAutor, string nomeAutor, string tipo) => new()
    {
        PessoaId = pessoaId, CodigoAutor = codigoAutor, NomeAutor = nomeAutor, Tipo = tipo,
        CodigoEmenda = codigo, Ano = short.Parse(codigo[..4]), Localidade = "CURITIBA - PR",
        CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000", ValorEmpenhado = 10_000m, ValorPago = 10_000m
    };

    private static EmendaFavorecidoModel Juridica(string codigo, string cnpj, string nome, string natureza, decimal valor) => new()
    {
        CodigoEmenda = codigo, Competencia = new DateOnly(2025, 3, 1), Tipo = TipoFavorecido.PESSOA_JURIDICA,
        Documento = cnpj, Nome = nome, NaturezaJuridica = natureza, Uf = "PR", Valor = valor
    };

    private static DespesaModel Cota(long pessoaId, string cnpj, string fornecedor, decimal valor) => new()
    {
        PessoaId = pessoaId, Ano = 2025, Mes = 3, Categoria = "MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR",
        Fornecedor = fornecedor, CnpjOuHash = cnpj, FornecedorEhPessoaFisica = false, ValorLiquido = valor
    };

    private async Task<T> LerAsync<T>(string url)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<T>(url))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
