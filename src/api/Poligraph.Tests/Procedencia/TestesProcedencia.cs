using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests;

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
        var (idPessoa, a, b) = await SemearAsync();
        Db.Despesas.AddRange(
            Despesa(idPessoa, 2024, a), Despesa(idPessoa, 2025, a),
            Despesa(idPessoa, 2025, b), Despesa(idPessoa, 2026, null),
            Despesa(idPessoa, 2022, b));
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?idPessoa={idPessoa}&legislatura=57");

        Assert.Equal(4, lida.Linhas);
        Assert.Equal(1, lida.LinhasSemCarga);
        Assert.Equal([a, b], lida.Cargas.Select(c => c.IdCarga));
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
        var (idPessoa, a, _) = await SemearAsync();
        var combustivel = Despesa(idPessoa, 2025, a);
        combustivel.Categoria = "COMBUSTÍVEIS";
        combustivel.Fornecedor = "POSTO 123.456.789-09 LTDA";
        Db.Despesas.AddRange(Despesa(idPessoa, 2025, a), combustivel);
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?idPessoa={idPessoa}&legislatura=57&anoDaDespesa=2025&categoria=COMBUST%C3%8DVEIS");

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
        var (idPessoa, a, _) = await SemearAsync();
        Db.Despesas.AddRange(Enumerable.Range(0, 51).Select(_ => Despesa(idPessoa, 2025, a)));
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?idPessoa={idPessoa}&legislatura=57&anoDaDespesa=2025");

        Assert.Equal(51, lida.Linhas);
        Assert.Null(lida.Lista);
    }

    /// <summary>Um ano pedido troca o mandato pelo ano.</summary>
    [SkippableFact]
    public async Task Cota_ComAno_SoAquele()
    {
        ExigeDocker();
        var (idPessoa, a, b) = await SemearAsync();
        Db.Despesas.AddRange(Despesa(idPessoa, 2024, a), Despesa(idPessoa, 2025, b));
        await Db.SaveChangesAsync();

        var lida = await LerAsync($"/api/procedencia/cota?idPessoa={idPessoa}&legislatura=57&anoDaDespesa=2025");

        Assert.Equal(b, Assert.Single(lida.Cargas).IdCarga);
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
        Assert.Equal(carga.Id, Assert.Single(lida.Cargas).IdCarga);
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
        Assert.Equal(carga.Id, Assert.Single(lida.Cargas).IdCarga);
    }

    [SkippableTheory]
    [InlineData("/api/procedencia/governo-gastos?de=2025")]
    [InlineData("/api/procedencia/pagamentos?de=2025")]
    [InlineData("/api/procedencia/cota?legislatura=57")]
    [InlineData("/api/procedencia/painel?legislatura=57")]
    public async Task SemOParametroDoContexto_Da404(string rota)
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync(rota);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>
    /// Os outros números da ficha: votos, emendas, campanha e patrimônio contam no recorte do mandato,
    /// e o ano pedido troca o recorte.
    /// </summary>
    [SkippableFact]
    public async Task Ficha_VotosEmendasCampanhaEPatrimonio_NoRecorteDoMandato()
    {
        ExigeDocker();
        var (idPessoa, a, _) = await SemearAsync();
        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = idPessoa, CodigoAutor = "1", NomeAutor = "AUTOR", CodigoEmenda = "202500010001", Ano = 2025,
            ValorEmpenhado = 100m, Localidade = "CURITIBA - PR", CargaId = a,
        });
        Db.ReceitasDeCampanha.Add(new ReceitaDeCampanhaModel
        {
            PessoaId = idPessoa, AnoEleicao = 2022, FonteReceita = "FUNDO ESPECIAL", Doador = "Direção Nacional", Valor = 1000m, CargaId = a,
        });
        Db.Patrimonios.Add(new PatrimonioModel { PessoaId = idPessoa, AnoEleicao = 2022, TipoBem = "Casa", Valor = 500m, Quantidade = 1, CargaId = a });
        await Db.SaveChangesAsync();
        var votosNoBanco = await Db.Votos.CountAsync(v => v.PessoaId == idPessoa && (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Legislatura == 57);

        var votos = await LerAsync($"/api/procedencia/votos?idPessoa={idPessoa}&legislatura=57");
        var emendas = await LerAsync($"/api/procedencia/emendas?idPessoa={idPessoa}&legislatura=57");
        var emendasDe2024 = await LerAsync($"/api/procedencia/emendas?idPessoa={idPessoa}&legislatura=57&anoDaEmenda=2024");
        var campanha = await LerAsync($"/api/procedencia/campanha?idPessoa={idPessoa}&legislatura=57");
        var patrimonio = await LerAsync($"/api/procedencia/patrimonio?idPessoa={idPessoa}&legislatura=57");
        var patrimonioDe2018 = await LerAsync($"/api/procedencia/patrimonio?idPessoa={idPessoa}&legislatura=57&anoDaEleicao=2018");

        Assert.Equal(votosNoBanco, votos.Linhas);
        Assert.Contains("57ª legislatura", votos.Regra);
        Assert.Equal(1, emendas.Linhas);
        Assert.Equal("Emenda 202500010001", Assert.Single(emendas.Lista!).Descricao);
        Assert.Equal(0, emendasDe2024.Linhas);
        Assert.Contains("de 2024", emendasDe2024.Regra);
        Assert.Equal(1, campanha.Linhas);
        Assert.Contains("campanha de 2022", campanha.Regra);
        Assert.Equal(1, patrimonio.Linhas);
        Assert.Equal(0, patrimonioDe2018.Linhas);
        Assert.Contains("2018", patrimonioDe2018.Regra);
    }

    /// <summary>A receita e o gasto sigiloso do Governo, no período do orçamento; "ano" vale pelas duas pontas.</summary>
    [SkippableFact]
    public async Task Governo_ReceitasESigiloso_NoPeriodoDoOrcamento()
    {
        ExigeDocker();
        var carga = Carga('7', "https://portaldatransparencia.gov.br/download-de-dados/receitas/2025");
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        Db.ReceitasPorOrigem.AddRange(
            new ReceitaPorOrigemModel { Ano = 2025, Categoria = "Receitas Correntes", Origem = "Impostos", Prevista = 1m, Realizada = 1m, GeradoEm = new DateOnly(2026, 1, 10), CargaId = carga.Id },
            new ReceitaPorOrigemModel { Ano = 2024, Categoria = "Receitas Correntes", Origem = "Impostos", Prevista = 1m, Realizada = 1m, GeradoEm = new DateOnly(2025, 1, 10), CargaId = carga.Id });
        Db.GastosSigilosos.Add(new GastoSigilosoModel
        {
            Ano = 2025, Origem = OrigemDoSigilo.CARTAO_CORPORATIVO, OrgaoSuperior = "Presidência da República", Sigiloso = 1m, Total = 2m, Lancamentos = 1, Meses = 12,
        });
        await Db.SaveChangesAsync();

        var receitas = await LerAsync("/api/procedencia/governo-receitas?de=2025&ate=2025");
        var sigiloso = await LerAsync("/api/procedencia/governo-sigiloso?ano=2025");

        Assert.Equal((1, 0), (receitas.Linhas, receitas.LinhasSemCarga));
        Assert.Contains("de 2025", receitas.Regra);
        Assert.Equal((1, 1), (sigiloso.Linhas, sigiloso.LinhasSemCarga));
    }

    /// <summary>A população do mapa por habitante leva ao arquivo do IBGE, não à tabela de códigos da Receita.</summary>
    [SkippableFact]
    public async Task Populacao_LevaAoArquivoDoIbge()
    {
        ExigeDocker();
        var receita = Carga('a', "https://www.gov.br/receitafederal/dados/municipios.csv");
        var ibge = Carga('b', "https://apisidra.ibge.gov.br/values/t/6579");
        Db.Cargas.AddRange(receita, ibge);
        await Db.SaveChangesAsync();
        Db.Municipios.AddRange(
            new MunicipioModel { CodigoIbge = "4314902", CodigoTom = "8801", Nome = "Porto Alegre", Uf = "RS", Populacao = 1_332_570, PopulacaoAno = 2025, CargaId = receita.Id, PopulacaoCargaId = ibge.Id },
            new MunicipioModel { CodigoIbge = "3550308", CodigoTom = "7107", Nome = "São Paulo", Uf = "SP", Populacao = 11_895_578, PopulacaoAno = 2025, CargaId = receita.Id, PopulacaoCargaId = ibge.Id });
        await Db.SaveChangesAsync();

        var brasil = await LerAsync("/api/procedencia/populacao");
        var rs = await LerAsync("/api/procedencia/populacao?uf=RS");

        Assert.Equal((2, 0, new string('b', 64)), (brasil.Linhas, brasil.LinhasSemCarga, brasil.Cargas.Single().Sha256));
        Assert.Equal(1, rs.Linhas);
    }

    /// <summary>Sanções, cadastro do parlamentar com as redes, e gestões: cada um leva ao arquivo que o gravou.</summary>
    [SkippableFact]
    public async Task SancoesParlamentarEGestoes_LevamAoArquivo()
    {
        ExigeDocker();
        var carga = Carga('9', "https://portaldatransparencia.gov.br/download-de-dados/ceis");
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        Db.SancoesDeEmpresas.Add(new SancaoDeEmpresaModel
        {
            Cadastro = "CEIS", CodigoDaSancao = "1", Cnpj = "11222333000181", Nome = "EMPRESA", Categoria = "Impedimento",
            OrgaoSancionador = "Ministério X", CargaId = carga.Id,
        });
        var pessoa = new PessoaModel { NomeCivil = "Ana", NomeExibicao = "Ana", CargaId = carga.Id };
        Db.Pessoas.Add(pessoa);
        await Db.SaveChangesAsync();
        await DadosDeTeste.SemearChapaAsync(Db, 2022, ("P", "P", "X"), ("V", "V", "Y"), carga.Id);
        Db.RedesSociais.Add(new RedeSocialModel
        {
            PessoaId = pessoa.Id, Url = "https://instagram.com/ana", Rede = TipoRedeSocial.INSTAGRAM, Fonte = FonteDaRedeSocial.CAMARA, CargaId = carga.Id,
        });
        await Db.SaveChangesAsync();

        var sancoes = await LerAsync("/api/procedencia/sancoes?cnpj=11222333000181");
        var parlamentar = await LerAsync($"/api/procedencia/parlamentar?idPessoa={pessoa.Id}");
        var gestoes = await LerAsync("/api/procedencia/gestoes?de=2025&ate=2025");

        Assert.Equal((1, 0), (sancoes.Linhas, sancoes.LinhasSemCarga));
        Assert.Equal((2, 0), (parlamentar.Linhas, parlamentar.LinhasSemCarga));
        Assert.Equal(["Ana", "https://instagram.com/ana"], parlamentar.Lista!.Select(l => l.Descricao));
        Assert.Equal((1, 0), (gestoes.Linhas, gestoes.LinhasSemCarga));
    }

    /// <summary>Viagens, compras, Defesa Civil e compras centralizadas: cada total da aba leva aos arquivos do período.</summary>
    [SkippableFact]
    public async Task AbasDoGoverno_LevamAosArquivosDoPeriodo()
    {
        ExigeDocker();
        var carga = Carga('8', "https://portaldatransparencia.gov.br/download-de-dados/viagens/2025");
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        Db.ViagensDoOrgao.AddRange(
            new ViagensDoOrgaoModel { Ano = 2025, OrgaoSuperior = "Ministério da Saúde", Viagens = 1, Diarias = 10m, CargaId = carga.Id },
            new ViagensDoOrgaoModel { Ano = 2024, OrgaoSuperior = "Ministério da Saúde", Viagens = 1, Diarias = 10m, CargaId = carga.Id });
        Db.ComprasCentralizadasNoCartao.Add(new CompraCentralizadaNoCartaoModel
        {
            Ano = 2025, Mes = 1, OrgaoSuperior = "Ministério da Educação", Valor = 5m, Transacoes = 1, CargaId = carga.Id,
        });
        await Db.SaveChangesAsync();

        var viagens = await LerAsync("/api/procedencia/governo-viagens?de=2025&ate=2025");
        var centralizadas = await LerAsync("/api/procedencia/governo-compras-centralizadas?de=2025&ate=2025");
        var compras = await LerAsync("/api/procedencia/governo-compras?de=2025&ate=2025");

        Assert.Equal((1, 0, new string('8', 64)), (viagens.Linhas, viagens.LinhasSemCarga, viagens.Cargas.Single().Sha256));
        Assert.Contains("Sigiloso", viagens.Regra);
        Assert.Equal((1, 0), (centralizadas.Linhas, centralizadas.LinhasSemCarga));
        Assert.Equal(0, compras.Linhas);
    }

    /// <summary>Cada parâmetro tem tipo próprio: o formato errado é recusado na entrada, antes do serviço.</summary>
    [SkippableTheory]
    [InlineData("/api/procedencia/inventado?idPessoa=1&legislatura=57")]
    [InlineData("/api/procedencia/entidade?cnpj=123")]
    [InlineData("/api/procedencia/pagamentos?de=2025&ate=2025&uf=XX")]
    [InlineData("/api/procedencia/pagamentos?de=2025&ate=2025&municipio=41")]
    [InlineData("/api/procedencia/cota?idPessoa=-3&legislatura=57")]
    public async Task ParametroForaDoFormato_Da400(string rota)
    {
        ExigeDocker();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var resposta = await cliente.GetAsync(rota);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    private async Task<(long Pessoa, long A, long B)> SemearAsync()
    {
        await DadosDeTeste.SemearAsync(Db);
        var idPessoa = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        var a = Carga('a', "https://www.camara.leg.br/cotas/Ano-2025.csv.zip");
        var b = Carga('b', "https://www.camara.leg.br/cotas/Ano-2024.csv.zip");
        Db.Cargas.AddRange(a, b);
        await Db.SaveChangesAsync();

        return (idPessoa, a.Id, b.Id);
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

    private static DespesaModel Despesa(long idPessoa, short ano, long? carga) => new()
    {
        PessoaId = idPessoa, Ano = ano, Mes = 3, Categoria = "PASSAGEM AÉREA", ValorLiquido = 10m, CargaId = carga
    };

    private async Task<ProcedenciaLida> LerAsync(string rota)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<ProcedenciaLida>(rota))!;
    }

    private record CargaLida(long IdCarga, string Orgao, string BaseLegal, string Sha256, string? Versao, int Linhas);

    private record LinhaLida(string Descricao, string? Detalhe, DateOnly? Data, decimal? Valor, string? Url);

    private record ProcedenciaLida(
        string Regra, int Linhas, int LinhasSemCarga, IReadOnlyList<CargaLida> Cargas, IReadOnlyList<LinhaLida>? Lista);
}
