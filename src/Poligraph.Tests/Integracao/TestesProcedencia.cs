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
        Assert.StartsWith("Ato da Mesa 43/2009", primeira.BaseLegal);
    }

    /// <summary>A linha de "Em quê": só a categoria pedida, e a regra diz qual.</summary>
    [SkippableFact]
    public async Task Cota_ComCategoria_SoElaComAsLinhas()
    {
        ExigeDocker();
        var (pessoaId, a, _) = await SemearAsync();
        var combustivel = Despesa(pessoaId, 2025, a);
        combustivel.Categoria = "COMBUSTÍVEIS";
        combustivel.Fornecedor = "POSTO 123.456.789-09 LTDA";
        Db.Despesas.AddRange(Despesa(pessoaId, 2025, a), combustivel);
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?pessoa={pessoaId}&legislatura=57&ano=2025&categoria=COMBUST%C3%8DVEIS");

        Assert.Equal(1, lida.Linhas);
        Assert.Contains("COMBUSTÍVEIS", lida.Regra);
        var linha = Assert.Single(lida.Lista!);
        Assert.Equal(10m, linha.Valor);
        Assert.DoesNotContain("123.456.789-09", linha.Descricao);
    }

    /// <summary>Acima do limite, o painel fica só com a contagem e os arquivos.</summary>
    [SkippableFact]
    public async Task Lista_AcimaDoLimite_NaoVem()
    {
        ExigeDocker();
        var (pessoaId, a, _) = await SemearAsync();
        Db.Despesas.AddRange(Enumerable.Range(0, 51).Select(_ => Despesa(pessoaId, 2025, a)));
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?pessoa={pessoaId}&legislatura=57&ano=2025");

        Assert.Equal(51, lida.Linhas);
        Assert.Null(lida.Lista);
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

    /// <summary>O "Pago em emendas" do mapa: os pagamentos das emendas do período, pelo ano no código.</summary>
    [SkippableFact]
    public async Task Pagamentos_DoPeriodoDaEmenda_PeloCodigo()
    {
        ExigeDocker();
        var carga = Carga('d', "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO");
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        Db.EmendasFavorecidos.AddRange(
            Favorecido("202541840004", carga.Id), Favorecido("202541840005", carga.Id), Favorecido("202341840001", null));
        await Db.SaveChangesAsync();

        var lida = await LerAsync("/api/procedencia/pagamentos?de=2025&ate=2025");

        Assert.Equal((2, 0), (lida.Linhas, lida.LinhasSemCarga));
        Assert.Equal(carga.Id, Assert.Single(lida.Cargas).Id);
    }

    /// <summary>A linha do estado na tabela do mapa: só o que chegou a quem tem sede nele.</summary>
    [SkippableFact]
    public async Task Pagamentos_PorUf_PelaSede()
    {
        ExigeDocker();
        var carga = Carga('9', "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO");
        Db.Cargas.Add(carga);
        Db.Municipios.Add(new MunicipioModel { CodigoIbge = "4106902", CodigoTom = "7535", Nome = "CURITIBA", Uf = "PR" });
        Db.CnpjsMunicipio.Add(new CnpjMunicipioModel { Cnpj = "12345678000190", CodigoIbge = "4106902", CadastroDe = new DateOnly(2026, 9, 1) });
        await Db.SaveChangesAsync();
        var semSede = Favorecido("202541840005", carga.Id);
        semSede.Documento = "99999999000199";
        Db.EmendasFavorecidos.AddRange(Favorecido("202541840004", carga.Id), semSede);
        await Db.SaveChangesAsync();

        var doPr = await LerAsync("/api/procedencia/pagamentos?de=2025&ate=2025&uf=PR");
        var deSp = await LerAsync("/api/procedencia/pagamentos?de=2025&ate=2025&uf=SP");
        var daCidade = await LerAsync("/api/procedencia/pagamentos?de=2025&ate=2025&municipio=4106902");

        Assert.Equal(1, doPr.Linhas);
        Assert.Contains("sede em PR", doPr.Regra);
        Assert.Equal(0, deSp.Linhas);
        Assert.Equal(1, daCidade.Linhas);
    }

    /// <summary>O total da entidade: os pagamentos diretos ao CNPJ, sem o intermediário, como no índice de entidades.</summary>
    [SkippableFact]
    public async Task Entidade_PagamentosDiretosAoCnpj()
    {
        ExigeDocker();
        var carga = Carga('e', "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO");
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        var intermediario = Favorecido("202541840006", carga.Id);
        intermediario.Intermediario = true;
        var outro = Favorecido("202541840007", carga.Id);
        outro.Documento = "99999999000199";
        Db.EmendasFavorecidos.AddRange(Favorecido("202541840004", carga.Id), Favorecido("202341840001", null), intermediario, outro);
        await Db.SaveChangesAsync();

        var lida = await LerAsync("/api/procedencia/entidade?cnpj=12345678000190");

        Assert.Equal((2, 1), (lida.Linhas, lida.LinhasSemCarga));
    }

    /// <summary>Pendência 84: o gasto do Governo vem do arquivo anual do orçamento, no período da página.</summary>
    [SkippableFact]
    public async Task GovernoGastos_SoOsAnosDoPeriodo()
    {
        ExigeDocker();
        var carga = Carga('f', "https://portaldatransparencia.gov.br/download-de-dados/orcamento-despesa/2025");
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        Db.OrcamentoPorFuncao.AddRange(
            new OrcamentoPorFuncaoModel { Ano = 2025, CodigoFuncao = "10", Funcao = "Saúde", CargaId = carga.Id },
            new OrcamentoPorFuncaoModel { Ano = 2024, CodigoFuncao = "10", Funcao = "Saúde" });
        await Db.SaveChangesAsync();

        var lida = await LerAsync("/api/procedencia/governo-gastos?de=2025&ate=2025");

        Assert.Equal((1, 0), (lida.Linhas, lida.LinhasSemCarga));
        Assert.Equal(carga.Id, Assert.Single(lida.Cargas).Id);
    }

    [SkippableTheory]
    [InlineData("/api/procedencia/governo-gastos?de=2025")]
    [InlineData("/api/procedencia/entidade?cnpj=123")]
    [InlineData("/api/procedencia/pagamentos?de=2025")]
    [InlineData("/api/procedencia/pagamentos?de=2025&ate=2025&uf=pr")]
    [InlineData("/api/procedencia/pagamentos?de=2025&ate=2025&municipio=41")]
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

    private static EmendaFavorecidoModel Favorecido(string codigo, long? carga) => new()
    {
        CodigoEmenda = codigo, Competencia = new DateOnly(2025, 3, 1), Tipo = TipoFavorecido.PESSOA_JURIDICA,
        Documento = "12345678000190", Nome = "EMPRESA", Uf = "PR", Valor = 10m, CargaId = carga
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

    private record LinhaLida(string Descricao, string? Detalhe, DateOnly? Data, decimal? Valor, string? Url);

    private record ProcedenciaLida(
        string Regra, int Linhas, int LinhasSemCarga, IReadOnlyList<CargaLida> Cargas, IReadOnlyList<LinhaLida>? Lista);
}
