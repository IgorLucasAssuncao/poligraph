using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>Os endpoints de parlamentar, ponta a ponta, contra Postgres real.</summary>
public class TestesEndpointParlamentares(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/parlamentares";

    [SkippableFact]
    public async Task Lista_TrazParlamentaresComVoto()
    {
        ExigeDocker();
        await SemearAsync();

        var pagina = await ListarAsync(Rota);

        Assert.Equal(12, pagina.Total);
        Assert.Equal(12, pagina.Itens.Count);
        Assert.All(pagina.Itens, p => Assert.True(p.NVotacoes > 0));
    }

    /// <summary>
    /// A página diz o total. A lista antiga cortava em 100 sem avisar, e a tela não
    /// tinha como saber que havia mais.
    /// </summary>
    [SkippableFact]
    public async Task Lista_PaginaDizOTotalEAvanca()
    {
        ExigeDocker();
        await SemearAsync();

        var primeira = await ListarAsync($"{Rota}?tamanho=5");
        var terceira = await ListarAsync($"{Rota}?tamanho=5&pagina=3");

        Assert.Equal(12, primeira.Total);
        Assert.Equal(["Ana Ribeiro", "Bruno Tavares", "Carla Nunes", "Diego Salles", "Elisa Moraes"],
            primeira.Itens.Select(p => p.Nome));
        Assert.Equal(["Karina Melo", "Lucas Ferraz"], terceira.Itens.Select(p => p.Nome));
    }

    /// <summary>
    /// Por votações, quem tem mais dado primeiro; o empate sai em ordem alfabética, para a
    /// página ser a mesma a cada chamada.
    /// </summary>
    [SkippableFact]
    public async Task Lista_OrdenaPorVotacoes()
    {
        ExigeDocker();
        await SemearAsync();

        var pagina = await ListarAsync($"{Rota}?ordem=VOTACOES");

        Assert.Equal("Ana Ribeiro", pagina.Itens[0].Nome);
        Assert.Equal("Lucas Ferraz", pagina.Itens[^1].Nome);
        Assert.True(pagina.Itens[0].NVotacoes > pagina.Itens[^1].NVotacoes);
    }

    [SkippableFact]
    public async Task Lista_FiltraPorPartido()
    {
        ExigeDocker();
        await SemearAsync();

        var pagina = await ListarAsync($"{Rota}?partido=PARTIDO-B");

        Assert.Equal(4, pagina.Total);
        Assert.All(pagina.Itens, p => Assert.Equal("PARTIDO-B", p.Partido));
    }

    /// <summary>
    /// As opções dos filtros saem da lista inteira. Montadas a partir do resultado,
    /// escolher um partido esvaziava a lista de estados.
    /// </summary>
    [SkippableFact]
    public async Task Lista_OpcoesDosFiltrosNaoDependemDoFiltro()
    {
        ExigeDocker();
        await SemearAsync();

        var pagina = await ListarAsync($"{Rota}?partido=PARTIDO-B&tamanho=1");

        Assert.Equal(["PARTIDO-A", "PARTIDO-B", "PARTIDO-C"], pagina.Partidos);
        Assert.Equal(["BA", "MG", "RS", "SP"], pagina.Ufs);
    }

    [SkippableFact]
    public async Task Lista_BuscaPorNomeIgnoraCaixaEAcento()
    {
        ExigeDocker();
        await SemearAsync();

        var pagina = await ListarAsync($"{Rota}?nome=fabio");

        Assert.Equal("Fábio Lins", Assert.Single(pagina.Itens).Nome);
    }

    [SkippableFact]
    public async Task Ficha_InexistenteRetorna404()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync($"{Rota}/999999");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task Ficha_TrazVotosRecentesEFiliacao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        Assert.NotNull(ficha);
        Assert.NotEmpty(ficha!.Nome);
        Assert.NotEmpty(ficha.VotosRecentes);
        Assert.NotEmpty(ficha.Partido);
    }

    /// <summary>
    /// Pendência 80: "votos com posição" é Sim ou Não. A ficha contava a abstenção, e o painel e a
    /// afinidade não; o fixture precisa ter abstenção, senão os dois números são iguais.
    /// </summary>
    [SkippableFact]
    public async Task Ficha_VotosComPosicao_NaoContaAbstencao()
    {
        ExigeDocker();
        await SemearAsync();
        var id = await PrimeiroParlamentarAsync();
        var voto = await Db.Votos.Where(v => v.PessoaId == id && v.Valor != null).OrderBy(v => v.VotacaoId).FirstAsync();
        voto.Valor = 0;
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        var legislatura = await Db.Votacoes.Where(v => v.Id == voto.VotacaoId).Select(v => v.Legislatura).FirstAsync();
        var simOuNao = await Db.Votos.CountAsync(v => v.PessoaId == id && (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Legislatura == legislatura);
        Assert.Equal(simOuNao, ficha!.NVotacoes);
    }

    /// <summary>
    /// A ementa é o que torna o voto legível.
    ///
    /// <para>
    /// A descrição é o registro processual — <i>"Aprovado o Projeto de Lei nº 2.162"</i>
    /// — e diz o NÚMERO, não o assunto. Sem a ementa, a ficha lista dez linhas que
    /// não informam em que a pessoa votou.
    /// </para>
    ///
    /// <para>
    /// A ementa chegou com a Pendência 40 em 2026-08-28, e a ficha era o lugar que ainda
    /// não a usava — o dado estava no banco, sem chegar à tela.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Ficha_TrazAEmentaDaProposicao_NaoSoADescricaoProcessual()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        var comEmenta = ficha!.VotosRecentes.Where(v => v.Ementa is not null).ToList();

        Assert.NotEmpty(comEmenta);
        Assert.All(comEmenta, v => Assert.False(string.IsNullOrWhiteSpace(v.Materia)));
    }

    /// <summary>
    /// A matéria é a etiqueta que permite conferir na fonte — "PL 2162/2023".
    /// Sem ela, quem quiser checar a ementa não tem por onde procurar.
    /// </summary>
    [SkippableFact]
    public async Task Ficha_MonstaAMateriaComSiglaNumeroEAno()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        var materias = ficha!.VotosRecentes
            .Where(v => v.Materia is not null)
            .Select(v => v.Materia!)
            .ToList();

        Assert.NotEmpty(materias);
        Assert.All(materias, m => Assert.Matches(@"^(PL|PLP|PEC|MPV|PDL|PRC) \d+/\d{4}$", m));
    }

    /// <summary>
    /// A armadilha da invariante I3.
    ///
    /// A similaridade é gravada uma vez por par, sempre com `pessoa_a &lt; pessoa_b`.
    /// Uma consulta que olhasse só `pessoa_a = id` funcionaria para quem tem id baixo
    /// e devolveria lista VAZIA para quem tem id alto — um bug que passa despercebido
    /// porque "funciona" nos primeiros que você testar.
    /// </summary>
    [SkippableFact]
    public async Task Ficha_TrazSimilares_MesmoParaQuemTemIdAlto()
    {
        ExigeDocker();
        await SemearAsync();
        await GravarSimilaridadesAsync();
        using var cliente = CriarCliente();

        var ids = await db_TodosOsIdsAsync();
        var menor = ids.First();
        var maior = ids.Last();

        var fichaMenor = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{menor}");
        var fichaMaior = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{maior}");

        Assert.NotEmpty(fichaMenor!.MaisSimilares);
        Assert.NotEmpty(fichaMaior!.MaisSimilares);
    }

    [SkippableFact]
    public async Task Ficha_SemExecucaoConcluida_NaoQuebra()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        Assert.NotNull(ficha);
        Assert.Empty(ficha!.MaisSimilares);
    }

    /// <summary>
    /// O `GroupBy` da cota precisa ser TRADUZÍVEL pelo EF.
    ///
    /// Projetar direto num `record` posicional compila sem reclamar e estoura em
    /// RUNTIME com `could not be translated` — aconteceu. Só um teste que executa a
    /// consulta contra Postgres de verdade pega isso.
    /// </summary>
    [SkippableFact]
    public async Task Gastos_AgregaPorCategoriaEFornecedor()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearDespesasAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync($"{Rota}/{pessoaId}/gastos");
        resposta.EnsureSuccessStatusCode();

        var gastos = await resposta.Content.ReadFromJsonAsync<GastoLido>();

        Assert.NotNull(gastos);
        Assert.Equal(2025, gastos.Ano);
        Assert.Equal(3, gastos.Lancamentos);
        Assert.Equal(450m, gastos.Total);

        Assert.Equal(2, gastos.PorCategoria.Count);
        Assert.Equal("PASSAGEM AÉREA", gastos.PorCategoria[0].Categoria);
        Assert.Equal(300m, gastos.PorCategoria[0].Total);
    }

    /// <summary>
    /// A ficha aberta num mandato mostra a cota de DENTRO dele: a de 2025 não aparece no
    /// mandato de 2019-2023, e a busca por mandato não cai em outro ano calada.
    /// </summary>
    [SkippableFact]
    public async Task Gastos_DoMandato_SoAnosDele()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearDespesasAsync();
        using var cliente = CriarCliente();

        var doMandato = await cliente.GetFromJsonAsync<GastoLido>($"{Rota}/{pessoaId}/gastos?legislatura=57");
        var deOutro = await cliente.GetFromJsonAsync<GastoLido>($"{Rota}/{pessoaId}/gastos?legislatura=56");

        Assert.Equal(2025, doMandato!.Ano);
        Assert.Equal(0, deOutro!.Ano);
        Assert.Equal(0, deOutro.Lancamentos);
    }

    /// <summary> Sem despesa é caso normal — a tela mostra vazio, não erro.</summary>
    [SkippableFact]
    public async Task Gastos_SemDespesa_DevolveVazioNaoErro()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var id = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();
        var resposta = await cliente.GetAsync($"{Rota}/{id}/gastos");

        resposta.EnsureSuccessStatusCode();
        var gastos = await resposta.Content.ReadFromJsonAsync<GastoLido>();

        Assert.Equal(0, gastos!.Lancamentos);
        Assert.Empty(gastos.PorCategoria);
    }

    /// <summary>
    /// RNF-13 — o documento de fornecedor pessoa física NUNCA sai em claro.
    /// </summary>
    [SkippableFact]
    public async Task Gastos_NaoVazamCpfDeFornecedor()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearDespesasAsync();
        using var cliente = CriarCliente();

        var json = await cliente.GetStringAsync($"{Rota}/{pessoaId}/gastos");

        Assert.DoesNotContain("cnpj", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("12345678909", json);
    }

    /// <summary>
    /// Mesmo risco do `GroupBy` da cota: compila e estoura em runtime.
    ///
    /// E confere o que interessa de verdade: **empenhado ≠ pago**.
    /// </summary>
    [SkippableFact]
    public async Task Emendas_SeparamEmpenhadoDePago()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearEmendasAsync();
        using var cliente = CriarCliente();

        var emendas = await cliente.GetFromJsonAsync<EmendasLidas>($"{Rota}/{pessoaId}/emendas");

        Assert.NotNull(emendas);
        Assert.Equal(2025, emendas!.Ano);
        Assert.Equal(3, emendas.Quantidade);

        Assert.Equal(1_000_000m, emendas.Empenhado);
        Assert.Equal(400_000m, emendas.Pago);
        Assert.NotEqual(emendas.Empenhado, emendas.Pago);
        Assert.Equal(150_000m, emendas.PagoDepois);

        Assert.Equal("Ananindeua - PA", emendas.PorDestino[0].Localidade);
    }

    /// <summary>
    /// O total NÃO pode ser a soma dos itens exibidos.
    ///
    /// `PorDestino` é cortado em 8. Somar a lista cortada daria um total menor que o
    /// real, e nada na tela indicaria o corte — o parlamentar apareceria com menos
    /// emenda do que tem.
    /// </summary>
    [SkippableFact]
    public async Task Emendas_TotalNaoEhASomaDaListaCortada()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        for (var i = 0; i < 12; i++)
        {
            Db.Emendas.Add(new EmendaModel
            {
                PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO",
                CodigoEmenda = $"20255184{i:D4}", Ano = 2025,
                Localidade = $"Municipio {i} - PA",
                ValorEmpenhado = 100m, ValorPago = 100m
            });
        }
        await Db.SaveChangesAsync();

        using var cliente = CriarCliente();
        var emendas = await cliente.GetFromJsonAsync<EmendasLidas>($"{Rota}/{pessoaId}/emendas");

        Assert.Equal(8, emendas!.PorDestino.Count);
        Assert.Equal(12, emendas.Quantidade);
        Assert.Equal(1_200m, emendas.Empenhado);
    }

    /// <summary> Sem emenda é caso normal — inclusive para autor não reconciliado.</summary>
    [SkippableFact]
    public async Task Emendas_SemEmenda_DevolveVazioNaoErro()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var id = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();
        var emendas = await cliente.GetFromJsonAsync<EmendasLidas>($"{Rota}/{id}/emendas");

        Assert.Equal(0, emendas!.Quantidade);
        Assert.Empty(emendas.PorDestino);
    }

    /// <summary>
    /// EmendaModel sem dono NÃO pode aparecer na ficha de ninguém.
    ///
    /// `pessoa_id` é anulável de propósito — emenda de bancada e de autor ainda não
    /// reconciliado entram assim. Atribuí-las a alguém seria inventar autoria.
    /// </summary>
    [SkippableFact]
    public async Task Emendas_DeAutorNaoReconciliado_NaoAparecemNaFicha()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearEmendasAsync();

        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = null,
            CodigoAutor = "9999", NomeAutor = "BANCADA DO PARA",
            CodigoEmenda = "202599990001", Ano = 2025,
            Localidade = "Ananindeua - PA",
            ValorEmpenhado = 50_000_000m, ValorPago = 50_000_000m
        });
        await Db.SaveChangesAsync();

        using var cliente = CriarCliente();
        var emendas = await cliente.GetFromJsonAsync<EmendasLidas>($"{Rota}/{pessoaId}/emendas");

        Assert.Equal(3, emendas!.Quantidade);
        Assert.Equal(1_000_000m, emendas.Empenhado);
    }

    /// <summary>
    /// Fundo Especial e Fundo Partidário são fundos DIFERENTES.
    ///
    /// Somá-los mudaria o número que o TCC cita. A API entrega os dois separados e
    /// deixa a soma para quem quiser assiná-la.
    /// </summary>
    [SkippableFact]
    public async Task Financiamento_SeparaOsDoisFundos()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearReceitasAsync();
        using var cliente = CriarCliente();

        var fin = await cliente.GetFromJsonAsync<FinanciamentoLido>(
            $"{Rota}/{pessoaId}/financiamento");

        Assert.NotNull(fin);
        Assert.Equal(2022, fin!.AnoEleicao);

        Assert.Equal(3_000_000m, fin.FundoEspecial);
        Assert.Equal(200_000m, fin.FundoPartidario);
        Assert.Equal(3_250_000m, fin.Total);

        Assert.NotEqual(fin.Total, fin.FundoEspecial + fin.FundoPartidario);
    }

    /// <summary>
    /// RNF-13 — o documento do doador pessoa física NUNCA sai da API.
    /// </summary>
    [SkippableFact]
    public async Task Financiamento_NaoVazaDocumentoDeDoador()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearReceitasAsync();
        using var cliente = CriarCliente();

        var json = await cliente.GetStringAsync($"{Rota}/{pessoaId}/financiamento");

        Assert.DoesNotContain("cnpj", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("11122233344", json);
        Assert.DoesNotContain(new string('b', 64), json);
    }

    /// <summary> Sem receita é caso normal — o TSE pode não ter sido ingerido.</summary>
    [SkippableFact]
    public async Task Financiamento_SemReceita_DevolveVazioNaoErro()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var id = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();
        var fin = await cliente.GetFromJsonAsync<FinanciamentoLido>(
            $"{Rota}/{id}/financiamento");

        Assert.Equal(0m, fin!.Total);
        Assert.Empty(fin.PorFonte);
    }

    private record DestinoLido(string Localidade, decimal Empenhado, decimal Pago, int Quantidade);

    private record EmendasLidas(
        int Ano, decimal Empenhado, decimal Pago, decimal PagoDepois, int Quantidade,
        IReadOnlyList<DestinoLido> PorDestino);

    private record FonteLida(string Fonte, decimal Total, int Lancamentos);

    private record FinanciamentoLido(
        int AnoEleicao, decimal Total, decimal FundoEspecial, decimal FundoPartidario,
        IReadOnlyList<FonteLida> PorFonte);

    private async Task<long> SemearEmendasAsync()
    {
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Emendas.AddRange(
            new EmendaModel
            {
                PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO DE TAL",
                CodigoEmenda = "202541840001", Ano = 2025,
                Localidade = "Ananindeua - PA", Funcao = "Saúde",
                ValorEmpenhado = 600_000m, ValorPago = 300_000m
            },
            new EmendaModel
            {
                PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO DE TAL",
                CodigoEmenda = "202541840002", Ano = 2025,
                Localidade = "Ananindeua - PA", Funcao = "Saúde",
                ValorEmpenhado = 300_000m, ValorPago = 100_000m, ValorRestoPago = 150_000m
            },
            new EmendaModel
            {
                PessoaId = pessoaId, CodigoAutor = "4184", NomeAutor = "FULANO DE TAL",
                CodigoEmenda = "202541840003", Ano = 2025,
                Localidade = "Belém - PA", Funcao = "Educação",
                ValorEmpenhado = 100_000m, ValorPago = 0m
            });

        await Db.SaveChangesAsync();

        return pessoaId;
    }

    private async Task<long> SemearReceitasAsync()
    {
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.ReceitasDeCampanha.AddRange(
            new ReceitaDeCampanhaModel
            {
                PessoaId = pessoaId, AnoEleicao = 2022,
                FonteReceita = ReceitaDeCampanhaModel.FonteFundoEspecial,
                Doador = "PARTIDO EXEMPLO", DoadorCnpjOuHash = "12345678000199",
                Valor = 3_000_000m
            },
            new ReceitaDeCampanhaModel
            {
                PessoaId = pessoaId, AnoEleicao = 2022,
                FonteReceita = ReceitaDeCampanhaModel.FonteFundoPartidario,
                Doador = "PARTIDO EXEMPLO", DoadorCnpjOuHash = "12345678000199",
                Valor = 200_000m
            },
            new ReceitaDeCampanhaModel
            {
                PessoaId = pessoaId, AnoEleicao = 2022,
                FonteReceita = "OUTROS RECURSOS",
                Doador = "JOSE DA SILVA",
                DoadorCnpjOuHash = new string('b', 64), DoadorEhPessoaFisica = true,
                Valor = 50_000m
            });

        await Db.SaveChangesAsync();

        return pessoaId;
    }

    private record CategoriaLida(string Categoria, decimal Total, int Lancamentos);

    private record GastoLido(
        int Ano, decimal Total, int Lancamentos,
        IReadOnlyList<CategoriaLida> PorCategoria);

    private async Task<long> SemearDespesasAsync()
    {
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Despesas.AddRange(
            new DespesaModel
            {
                PessoaId = pessoaId, Ano = 2025, Mes = 3,
                Categoria = "PASSAGEM AÉREA", Fornecedor = "CIA AEREA",
                CnpjOuHash = "12345678000199", ValorLiquido = 200m
            },
            new DespesaModel
            {
                PessoaId = pessoaId, Ano = 2025, Mes = 4,
                Categoria = "PASSAGEM AÉREA", Fornecedor = "CIA AEREA",
                CnpjOuHash = "12345678000199", ValorLiquido = 100m
            },
            new DespesaModel
            {
                PessoaId = pessoaId, Ano = 2025, Mes = 5,
                Categoria = "COMBUSTÍVEIS", Fornecedor = "POSTO",
                CnpjOuHash = new string('a', 64), FornecedorEhPessoaFisica = true,
                ValorLiquido = 150m
            });

        await Db.SaveChangesAsync();

        return pessoaId;
    }

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task<long> PrimeiroParlamentarAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();

    private async Task<List<long>> db_TodosOsIdsAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).ToListAsync();

    private async Task GravarSimilaridadesAsync()
    {
        var ids = await db_TodosOsIdsAsync();

        var execucao = new ExecucaoModel
        {
            Casa = TipoCasa.CAMARA, Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = TipoStatusDaExecucao.CONCLUIDA
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            for (var j = i + 1; j < ids.Count; j++)
            {
                Db.Similaridades.Add(new SimilaridadeModel
                {
                    ExecucaoId = execucao.Id,
                    PessoaA = ids[i],
                    PessoaB = ids[j],
                    Metrica = TipoMetrica.CONCORDANCIA,
                    Valor = 0.5f + (i + j) / 100f,
                    NVotacoesComuns = 25
                });
            }
        }

        await Db.SaveChangesAsync();
    }

    private record ParlamentarJson(long Id, string Nome, string Partido, string Uf, int NVotacoes);

    private record PaginaJson(
        List<ParlamentarJson> Itens, int Pagina, int Tamanho, int Total,
        List<string> Partidos, List<string> Ufs);

    private async Task<PaginaJson> ListarAsync(string rota)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<PaginaJson>(rota))!;
    }
    private record SimilarJson(long PessoaId, string Nome, string Partido, float Valor, int Comuns);
    private record FichaJson(
        long Id, string Nome, string NomeCivil, string Partido, string Uf, int NVotacoes,
        List<VotoJson> VotosRecentes, List<SimilarJson> MaisSimilares);
    private record VotoJson(
        string VotacaoId, DateOnly Data, string? Descricao, short? Valor,
        string? OrientacaoDoGoverno, string? Ementa, string? Materia);
}
