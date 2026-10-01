using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Redes sociais na ficha, patrimônio declarado e os convênios que a entidade assinou.
/// </summary>
/// <remarks>
/// <para>
/// Os erros que estas três telas cometeriam sem avisar: virar link um endereço que executa
/// script, mostrar a descrição de um bem (que traz endereço) e ligar convênio a entidade pelo
/// nome. Cada um tem o seu teste.
/// </para>
/// </remarks>
public class TestesRedesEPatrimonio(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Associacao = "11222333000144";

    [SkippableFact]
    public async Task Ficha_TrazAsRedesDoParlamentar()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        Db.RedesSociais.AddRange(
            new RedeSocialModel { PessoaId = pessoaId, Url = "https://x.com/fulano", Rede = TipoRedeSocial.X, Fonte = FonteDaRedeSocial.CAMARA },
            new RedeSocialModel { PessoaId = pessoaId, Url = "https://instagram.com/fulano", Rede = TipoRedeSocial.INSTAGRAM, Fonte = FonteDaRedeSocial.CAMARA });
        await Db.SaveChangesAsync();

        var ficha = await LerAsync<FichaLida>($"/api/parlamentares/{pessoaId}");

        Assert.Equal(["INSTAGRAM", "X"], ficha.RedesSociais.Select(r => r.Rede));
    }

    /// <summary>🔴 O banco recusa endereço que ⛔ seja http(s): a tela o viraria link executável.</summary>
    [SkippableTheory]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://exemplo.com")]
    [InlineData("https://com espaço.com")]
    public async Task Rede_ComEnderecoQueNaoEhHttp_ERejeitadaPeloBanco(string url)
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        Db.RedesSociais.Add(new RedeSocialModel { PessoaId = pessoaId, Url = url, Rede = TipoRedeSocial.OUTRA, Fonte = FonteDaRedeSocial.TSE });

        var erro = await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_rede_url", ((PostgresException)erro.InnerException!).ConstraintName);
    }

    [SkippableFact]
    public async Task Patrimonio_PorCandidatura_DaMaisRecente_ComOsTiposDoMaiorAoMenor()
    {
        ExigeDocker();
        var pessoaId = await SemearAsync();
        Db.Patrimonios.AddRange(
            new PatrimonioModel { PessoaId = pessoaId, AnoEleicao = 2018, TipoBem = "Casa", Valor = 300m, Quantidade = 1 },
            new PatrimonioModel { PessoaId = pessoaId, AnoEleicao = 2022, TipoBem = "Casa", Valor = 400m, Quantidade = 1 },
            new PatrimonioModel { PessoaId = pessoaId, AnoEleicao = 2022, TipoBem = "Veículo", Valor = 900m, Quantidade = 2 });
        await Db.SaveChangesAsync();

        var patrimonio = await LerAsync<PatrimonioLido>($"/api/parlamentares/{pessoaId}/patrimonio");

        Assert.Equal([2022, 2018], patrimonio.Declaracoes.Select(d => d.AnoEleicao));
        var ultima = patrimonio.Declaracoes[0];
        Assert.Equal((1_300m, 3), (ultima.Total, ultima.Bens));
        Assert.Equal(["Veículo", "Casa"], ultima.PorTipo.Select(t => t.Tipo));
    }

    [SkippableFact]
    public async Task Patrimonio_DePessoaInexistente_Responde404()
    {
        ExigeDocker();
        await SemearAsync();

        using var cliente = CriarCliente();
        var resposta = await cliente.GetAsync("/api/parlamentares/999999/patrimonio");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>
    /// O convênio chega à entidade pelo CNPJ do convenente — ⛔ pelo nome, que no arquivo de
    /// emendas vem escrito de outro jeito.
    /// </summary>
    [SkippableFact]
    public async Task Entidade_TrazOsConveniosQueAssinou_PeloCnpj()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Convenios.AddRange(
            new ConvenioModel
            {
                Numero = "1AAQKR", Convenente = "ASSOC EXEMPLO", Objeto = "AQUISICAO DE AMBULANCIA",
                DataPublicacao = new DateOnly(2025, 1, 16), Valor = 500m, ValorLiberado = 200m,
                Situacao = "EM EXECUÇÃO", CnpjConvenente = Associacao
            },
            new ConvenioModel
            {
                Numero = "2BBB", Convenente = "ASSOCIACAO EXEMPLO DE CURITIBA", Objeto = "OUTRA",
                DataPublicacao = new DateOnly(2025, 1, 16), Valor = 900m, CnpjConvenente = null
            });
        await Db.SaveChangesAsync();

        var entidade = await LerAsync<EntidadeLida>($"/api/entidades/{Associacao}");

        var convenio = Assert.Single(entidade.Convenios.Itens);
        Assert.Equal(("1AAQKR", "AQUISICAO DE AMBULANCIA", 200m), (convenio.Numero, convenio.Objeto, convenio.ValorLiberado));
        Assert.Equal("https://portaldatransparencia.gov.br/convenios/1AAQKR", convenio.UrlFonte);
    }

    [SkippableFact]
    public async Task Convenio_ComCnpjForaDoFormato_ERejeitadoPeloBanco()
    {
        ExigeDocker();
        Db.Convenios.Add(new ConvenioModel
        {
            Numero = "3CCC", Convenente = "X", DataPublicacao = new DateOnly(2025, 1, 1), Valor = 1m, CnpjConvenente = "123"
        });

        var erro = await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_convenio_cnpj", ((PostgresException)erro.InnerException!).ConstraintName);
    }

    private record RedeLida(string Rede, string Url, string Fonte);

    private record FichaLida(long Id, List<RedeLida> RedesSociais);

    private record TipoLido(string Tipo, decimal Valor, int Quantidade);

    private record DeclaracaoLida(int AnoEleicao, decimal Total, int Bens, List<TipoLido> PorTipo);

    private record PatrimonioLido(List<DeclaracaoLida> Declaracoes);

    private record ConvenioLido(string Numero, string? Objeto, decimal? ValorLiberado, string UrlFonte);

    private record PaginaLida<T>(List<T> Itens, int Total);

    private record EntidadeLida(string Cnpj, PaginaLida<ConvenioLido> Convenios);

    /// <summary>Um parlamentar da base de teste e uma associação que recebeu emenda dele.</summary>
    private async Task<long> SemearAsync()
    {
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO DE TAL", Tipo = "Emenda Individual",
            CodigoEmenda = "202541840004", Ano = 2025, Localidade = "CURITIBA - PR",
            CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000", ValorEmpenhado = 1_000m, ValorPago = 1_000m
        });
        Db.EmendasFavorecidos.Add(new EmendaFavorecidoModel
        {
            CodigoEmenda = "202541840004", Competencia = new DateOnly(2025, 3, 1), Tipo = TipoFavorecido.PESSOA_JURIDICA,
            Documento = Associacao, Nome = "ASSOCIACAO EXEMPLO", NaturezaJuridica = "Associação Privada", Uf = "PR", Valor = 300m
        });
        await Db.SaveChangesAsync();
        return pessoaId;
    }

    private async Task<T> LerAsync<T>(string url)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<T>(url))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
