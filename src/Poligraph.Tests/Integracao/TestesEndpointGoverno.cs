using System.Net;
using System.Net.Http.Json;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// O perfil do governo federal: quem governa, de onde veio o dinheiro e para onde foi.
/// </summary>
/// <remarks>
/// <para>
/// Três somas desta tela são fáceis de errar sem erro nenhum: a dívida emitida somada à
/// arrecadação, a rolagem da dívida contada como gasto de área, e o pago sem os restos a
/// pagar. Cada uma tem o seu teste.
/// </para>
/// </remarks>
public class TestesEndpointGoverno(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/governo";

    /// <summary>
    /// Sem período, todos os anos: a área soma os dois, e o ano a ano vem ao lado para a
    /// comparação não depender de trocar o filtro.
    /// </summary>
    [SkippableFact]
    public async Task SemPeriodo_SomaTodosOsAnos_EDaOAnoAAno()
    {
        ExigeDocker();
        await SemearAsync();

        var governo = await LerAsync(Rota);

        Assert.Equal(new PeriodoLido(2025, 2026), governo.Periodo);
        Assert.Equal([2025, 2026], governo.AnosDisponiveis);
        Assert.Equal(250m + 130m, governo.Despesa.Areas.Single(a => a.CodigoDaFuncao == "10").Pago
            + governo.Despesa.Areas.Single(a => a.CodigoDaFuncao == "10").RestosAPagarPagos);
        Assert.Equal([2025, 2026], governo.PorAno.Select(a => a.AnoDoOrcamento));
    }

    /// <summary>
    /// "Gastou" é áreas + repasses + dívida paga, não a rolagem: dívida paga com dívida nova.
    /// </summary>
    [SkippableFact]
    public async Task AnoAAno_GastouDeixaARolagemDeFora()
    {
        ExigeDocker();
        await SemearAsync();

        var ano2025 = (await LerAsync(Rota)).PorAno.Single(a => a.AnoDoOrcamento == 2025);

        Assert.Equal(1_160m + 250m + 300m + 600m, ano2025.Gastou);
        Assert.Equal(2_500m, ano2025.Arrecadou);
        Assert.Equal(2_400m, ano2025.PegouEmprestado);
    }

    /// <summary>
    /// As gestões disponíveis não dependem do período: com um ano de uma gestão escolhido, a
    /// outra continua oferecida como atalho.
    /// </summary>
    [SkippableFact]
    public async Task GestoesDisponiveis_NaoDependemDoPeriodo()
    {
        ExigeDocker();
        await SemearAsync();
        Db.Gestoes.Add(new GestaoModel
        {
            Eleicao = 2018, PrimeiroAno = 2019, UltimoAno = 2022,
            PresidenteNome = "PRESIDENTE ANTERIOR", PresidenteNomeDeUrna = "ANTERIOR", PresidentePartido = "XYZ",
            ViceNome = "VICE ANTERIOR", ViceNomeDeUrna = "VICE", VicePartido = "XYZ"
        });
        Db.OrcamentoPorFuncao.Add(Funcao(2022, "10", "Saúde", pago: 100m, restos: 0m, acima: 0m, new DateOnly(2023, 1, 20)));
        await Db.SaveChangesAsync();

        var governo = await LerAsync($"{Rota}?ano=2025");

        Assert.Equal([2022], governo.Gestoes.Select(g => g.AnoDaEleicao));
        Assert.Equal([2018, 2022], governo.GestoesDisponiveis.Select(g => g.AnoDaEleicao));
    }

    [SkippableFact]
    public async Task AnoCorrente_VemMarcadoComoEmAndamento()
    {
        ExigeDocker();
        await SemearAsync();

        var governo = await LerAsync($"{Rota}?ano=2026");

        Assert.Equal(2026, governo.EmAndamento);
        Assert.False(Assert.Single(governo.PorAno).Fechado);
    }

    [SkippableFact]
    public async Task Gestao_EAQueCobreOAno()
    {
        ExigeDocker();
        await SemearAsync();

        var gestao = Assert.Single((await LerAsync(Rota)).Gestoes);

        Assert.Equal("LULA", gestao.Presidente.NomeDeUrna);
        Assert.Equal("PSB", gestao.Vice.Partido);
        Assert.Equal((2023, 2026), (gestao.PrimeiroAno, gestao.UltimoAno));
    }

    /// <summary>
    /// Emissão de dívida não é arrecadação, e o que o governo paga a si mesmo não entra
    /// em nenhuma das duas.
    /// </summary>
    [SkippableFact]
    public async Task Arrecadacao_SeparaDividaEIgnoraIntraOrcamentaria()
    {
        ExigeDocker();
        await SemearAsync();

        var arrecadacao = (await LerAsync($"{Rota}?ano=2025")).Arrecadacao;

        Assert.Equal(2_500m, arrecadacao.Arrecadado);
        Assert.Equal(2_400m, arrecadacao.EmissaoDeDivida);
        Assert.Equal("Contribuições", arrecadacao.PorOrigem[0].Origem);
    }

    /// <summary>
    /// A rolagem da dívida vai em grupo próprio, e não entre as áreas.
    /// </summary>
    [SkippableFact]
    public async Task Encargos_SaemEmGrupos_ForaDasAreas()
    {
        ExigeDocker();
        await SemearAsync();

        var despesa = (await LerAsync($"{Rota}?ano=2025")).Despesa;

        Assert.DoesNotContain(despesa.Areas, a => a.CodigoDaFuncao == "28");
        Assert.Equal(1_400m, despesa.Encargos.Single(e => e.Grupo == "REFINANCIAMENTO").Pago);
        Assert.Equal(600m, despesa.Encargos.Single(e => e.Grupo == "SERVICO_DA_DIVIDA").Pago);
        Assert.Equal(0m, despesa.Encargos.Single(e => e.Grupo == "OUTROS").Pago);
    }

    /// <summary>
    /// As áreas saem pelo total que saiu no ano, somado o de anos anteriores: por essa
    /// soma, Urbanismo passa de uma área que pagou menos no próprio ano.
    /// </summary>
    [SkippableFact]
    public async Task Areas_OrdenadasPeloPagoComRestosAPagar()
    {
        ExigeDocker();
        await SemearAsync();

        var areas = (await LerAsync($"{Rota}?ano=2025")).Despesa.Areas;

        Assert.Equal(["09", "15", "10"], areas.Select(a => a.CodigoDaFuncao));
        Assert.False(areas.Single(a => a.CodigoDaFuncao == "09").DotacaoCompleta);
    }

    /// <summary>
    /// O sigiloso do cartão vem com a base — o cartão inteiro —, e órgão sem sigilo nenhum
    /// Não entra na lista.
    /// </summary>
    [SkippableFact]
    public async Task Sigilo_TrazCartaoComBaseEAcao_SoOrgaosComSigilo()
    {
        ExigeDocker();
        await SemearAsync();
        Db.GastosSigilosos.AddRange(
            Sigiloso(OrigemDoSigilo.CARTAO_CORPORATIVO, "Presidência da República", 20m, 30m, 5),
            Sigiloso(OrigemDoSigilo.CARTAO_CORPORATIVO, "Ministério da Saúde", 0m, 70m, 0),
            Sigiloso(OrigemDoSigilo.ACAO_SIGILOSA, "Ministério da Defesa", 8m, 8m, null));
        await Db.SaveChangesAsync();

        var sigilo = (await LerAsync($"{Rota}?ano=2025")).Sigilo!;

        Assert.Equal((20m, 100m, 5, 8m), (sigilo.CartaoSigiloso, sigilo.CartaoTotal, sigilo.TransacoesSigilosas, sigilo.AcaoSigilosa));
        Assert.Equal(["Presidência da República", "Ministério da Defesa"], sigilo.PorOrgao.Select(o => o.Orgao));
    }

    [SkippableFact]
    public async Task Sigilo_SemCarga_VemNulo()
    {
        ExigeDocker();
        await SemearAsync();

        Assert.Null((await LerAsync(Rota)).Sigilo);
    }

    /// <summary>A ação sigilosa não tem base à parte nem transação: o banco recusa a linha que finja ter.</summary>
    [SkippableFact]
    public async Task Sigilo_AcaoComTotalDiferente_ERejeitadaPeloBanco()
    {
        ExigeDocker();
        Db.GastosSigilosos.Add(Sigiloso(OrigemDoSigilo.ACAO_SIGILOSA, "Ministério da Defesa", 8m, 9m, null));

        var erro = await Assert.ThrowsAsync<Microsoft.EntityFrameworkCore.DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_sigilo_base", ((Npgsql.PostgresException)erro.InnerException!).ConstraintName);
    }

    /// <summary>
    /// O cartão da Defesa Civil soma por ano e por UF, separa o governo do estado e diz o mês que
    /// o Portal não publicou. Os meses depois do último do ano corrente não contam como falta.
    /// </summary>
    [SkippableFact]
    public async Task DefesaCivil_SomaPorAnoEUf_EDizOMesSemArquivo()
    {
        ExigeDocker();
        await SemearAsync();
        for (short mes = 1; mes <= 12; mes++)
        {
            if (mes != 11)
            {
                Db.GastosDaDefesaCivil.Add(DaDefesaCivil(2025, mes, "PORTO ALEGRE", "RS", "MUNICIPAL", 10m));
            }
        }

        Db.GastosDaDefesaCivil.AddRange(
            DaDefesaCivil(2025, 5, "GOVERNO DO ESTADO", "RS", "ESTADUAL", 50m),
            DaDefesaCivil(2026, 1, "ASSIS BRASIL", "AC", "MUNICIPAL", 7m),
            DaDefesaCivil(2026, 2, "ASSIS BRASIL", "AC", "MUNICIPAL", -2m),
            DaDefesaCivil(2025, 8, "Sem informação", null, "NAO_INFORMADA", 4m));
        await Db.SaveChangesAsync();

        var defesaCivil = (await LerAsync(Rota)).DefesaCivil!;

        Assert.Equal((169m, 50m, 4m, 4), (defesaCivil.Total, defesaCivil.Estadual, defesaCivil.NaoInformado, defesaCivil.Executores));
        Assert.Equal([(2025, 164m, 11), (2026, 5m, 2)], defesaCivil.PorAno.Select(a => (a.AnoDoExtrato, a.Valor, a.Meses)));
        Assert.Equal([("RS", 160m), ("AC", 5m)], defesaCivil.PorUf.Select(u => (u.Uf, u.Valor)));
        Assert.Equal(["2025-11"], defesaCivil.MesesSemArquivo);
    }

    [SkippableFact]
    public async Task DefesaCivil_SemCarga_VemNulo()
    {
        ExigeDocker();
        await SemearAsync();

        Assert.Null((await LerAsync(Rota)).DefesaCivil);
    }

    [SkippableFact]
    public async Task SemDado_Responde404()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync(Rota);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    private record PessoaLida(string Nome, string NomeDeUrna, string Partido);

    private record GestaoLida(int AnoDaEleicao, int PrimeiroAno, int UltimoAno, PessoaLida Presidente, PessoaLida Vice);

    private record OrigemLida(string Origem, decimal Realizada);

    private record ArrecadacaoLida(decimal Arrecadado, List<OrigemLida> PorOrigem, decimal EmissaoDeDivida);

    private record AreaLida(string CodigoDaFuncao, decimal Pago, decimal RestosAPagarPagos, bool DotacaoCompleta);

    private record EncargoLido(string Grupo, decimal Pago);

    private record DespesaLida(List<AreaLida> Areas, List<EncargoLido> Encargos);

    private record OrgaoLido(string Orgao);

    private record SigiloLido(
        decimal CartaoSigiloso, decimal CartaoTotal, int TransacoesSigilosas, decimal AcaoSigilosa, List<OrgaoLido> PorOrgao);

    private record DefesaCivilNoAnoLido(int AnoDoExtrato, decimal Valor, int Meses);

    private record DefesaCivilNaUfLida(string Uf, decimal Valor, int Executores);

    private record DefesaCivilLida(
        decimal Total, decimal Estadual, decimal NaoInformado, int Executores, List<DefesaCivilNoAnoLido> PorAno, List<DefesaCivilNaUfLida> PorUf,
        List<string> MesesSemArquivo);

    private record PeriodoLido(int PrimeiroAno, int UltimoAno);

    private record AnoLido(int AnoDoOrcamento, decimal Arrecadou, decimal Gastou, decimal PegouEmprestado, bool Fechado);

    private record GovernoLido(
        List<GestaoLida> Gestoes, PeriodoLido Periodo, int? EmAndamento, List<int> AnosDisponiveis,
        ArrecadacaoLida Arrecadacao, DespesaLida Despesa, SigiloLido? Sigilo, DefesaCivilLida? DefesaCivil, List<AnoLido> PorAno,
        List<GestaoLida> GestoesDisponiveis);

    private static GastoSigilosoModel Sigiloso(
        OrigemDoSigilo origem, string orgao, decimal sigiloso, decimal total, int? lancamentos) => new()
    {
        Ano = 2025, Origem = origem, OrgaoSuperior = orgao, Sigiloso = sigiloso, Total = total,
        Lancamentos = lancamentos, Meses = 12
    };

    private static GastoDaDefesaCivilModel DaDefesaCivil(short ano, short mes, string executor, string? uf, string esfera, decimal valor) => new()
    {
        Ano = ano, Mes = mes, Executor = executor, Uf = uf, Esfera = esfera,
        CnpjConvenente = "92958800000138", Valor = valor, Transacoes = 1
    };

    private async Task SemearAsync()
    {
        var gerado = new DateOnly(2026, 9, 22);

        Db.Gestoes.Add(new GestaoModel
        {
            Eleicao = 2022, PrimeiroAno = 2023, UltimoAno = 2026,
            PresidenteNome = "LUIZ INÁCIO LULA DA SILVA", PresidenteNomeDeUrna = "LULA", PresidentePartido = "PT",
            ViceNome = "GERALDO JOSÉ RODRIGUES ALCKMIN FILHO", ViceNomeDeUrna = "GERALDO ALCKMIN", VicePartido = "PSB"
        });

        Db.OrcamentoPorFuncao.AddRange(
            Funcao(2025, "09", "Previdência social", pago: 1_100m, restos: 60m, acima: 130m, gerado),
            Funcao(2025, "10", "Saúde", pago: 230m, restos: 20m, acima: 0m, gerado),
            Funcao(2025, "15", "Urbanismo", pago: 200m, restos: 100m, acima: 0m, gerado),
            Funcao(2025, "28", "Encargos especiais", pago: 2_000m, restos: 50m, acima: 0m, gerado),
            Funcao(2026, "10", "Saúde", pago: 120m, restos: 10m, acima: 0m, gerado));

        Db.EncargosEspeciais.AddRange(
            Encargo("841", "Refinanciamento da dívida interna", 1_400m),
            Encargo("843", "Serviço da dívida interna", 600m));

        Db.ReceitasPorOrigem.AddRange(
            Receita("Receitas Correntes", "Contribuições", 1_400m, gerado),
            Receita("Receitas Correntes", "Impostos, Taxas e Contribuições de Melhoria", 1_100m, gerado),
            Receita("Receitas de Capital", "Operações de Crédito", 2_400m, gerado),
            Receita("Receitas Correntes - intra-orçamentárias", "Contribuições", 23m, gerado));

        await Db.SaveChangesAsync();
    }

    private static OrcamentoPorFuncaoModel Funcao(
        short ano, string codigo, string nome, decimal pago, decimal restos, decimal acima,
        DateOnly gerado) => new()
    {
        Ano = ano, CodigoFuncao = codigo, Funcao = nome,
        DotacaoInicial = 1_000m, DotacaoAtualizada = 1_000m, Empenhado = pago,
        Pago = pago, RestosAPagarPagos = restos, EmpenhadoAcimaDaDotacao = acima, GeradoEm = gerado
    };

    private static EncargoEspecialModel Encargo(string codigo, string nome, decimal pago) => new()
    {
        Ano = 2025, CodigoSubfuncao = codigo, Subfuncao = nome,
        DotacaoAtualizada = pago, Empenhado = pago, Pago = pago
    };

    private static ReceitaPorOrigemModel Receita(
        string categoria, string origem, decimal realizada, DateOnly gerado) => new()
    {
        Ano = 2025, Categoria = categoria, Origem = origem,
        Prevista = realizada, Realizada = realizada, GeradoEm = gerado
    };

    private async Task<GovernoLido> LerAsync(string rota)
    {
        using var cliente = CriarCliente();
        return (await cliente.GetFromJsonAsync<GovernoLido>(rota))!;
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
