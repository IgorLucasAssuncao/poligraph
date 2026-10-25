using System.Net.Http.Json;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// A lista de políticos do TSE (Pendência 90, fase 2): o filtro por nível, cargo, UF e município, e o grupo novo da busca do cabeçalho.
/// </summary>
public class TestesPoliticos(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string SaoPaulo = "3550308";

    /// <summary>Quem foi prefeito e depois governador aparece pelo mandato que responde ao filtro, e a lista vai do mandato mais recente ao mais antigo.</summary>
    [SkippableFact]
    public async Task Filtro_MostraOMandatoQueResponde_DoMaisRecente()
    {
        ExigeDocker();
        var (prefeitoEGovernador, prefeita) = await SemearAsync();

        var municipais = await LerAsync<PaginaLida>($"/api/politicos?nivel=MUNICIPAL&municipio={SaoPaulo}");
        var estaduais = await LerAsync<PaginaLida>("/api/politicos?cargo=GOVERNADOR&uf=SP");

        Assert.Equal([prefeita, prefeitoEGovernador], municipais.Itens.Select(p => p.IdPessoa));
        Assert.Equal((2016, "São Paulo"), (municipais.Itens[1].Mandato.AnoEleicao, municipais.Itens[1].Mandato.Municipio!.Nome));
        Assert.Equal([prefeitoEGovernador], estaduais.Itens.Select(p => p.IdPessoa));
        Assert.Equal(("GOVERNADOR", 2), (estaduais.Itens[0].Mandato.Cargo, estaduais.Itens[0].Mandatos));
    }

    [SkippableFact]
    public async Task Filtro_SemNinguem_ListaVazia()
    {
        ExigeDocker();
        await SemearAsync();

        var lista = await LerAsync<PaginaLida>("/api/politicos?cargo=DEPUTADO_DISTRITAL");

        Assert.Equal(0, lista.Total);
    }

    [SkippableFact]
    public async Task Busca_DoCabecalho_TrazOsPoliticosNoGrupoProprio()
    {
        ExigeDocker();
        var (prefeitoEGovernador, _) = await SemearAsync();

        var busca = await LerAsync<BuscaLida>("/api/busca?q=joao");

        Assert.Equal([prefeitoEGovernador], busca.Politicos.Select(p => p.IdPessoa));
    }

    [SkippableFact]
    public async Task Ficha_TrazOsMandatosDoMaisRecente()
    {
        ExigeDocker();
        var (prefeitoEGovernador, _) = await SemearAsync();

        var ficha = await LerAsync<FichaLida>($"/api/politicos/{prefeitoEGovernador}");

        Assert.Equal(["GOVERNADOR", "PREFEITO"], ficha.Mandatos.Select(m => m.Cargo));
        Assert.False(ficha.Parlamentar);
    }

    [SkippableFact]
    public async Task Ficha_DeQuemNaoTemMandato_Responde404()
    {
        ExigeDocker();
        await SemearAsync();
        var semMandato = new PessoaModel { NomeCivil = "Sem Mandato", NomeExibicao = "Sem Mandato" };
        Db.Pessoas.Add(semMandato);
        await Db.SaveChangesAsync();

        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        var resposta = await cliente.GetAsync($"/api/politicos/{semMandato.Id}");

        Assert.Equal(System.Net.HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>Cada gestão municipal traz o governador eleito nos anos que coincidem, e o reeleito aparece uma vez só.</summary>
    [SkippableFact]
    public async Task Gestoes_DaCidade_TrazemOsEleitosDoPeriodo()
    {
        ExigeDocker();
        var (joao, maria) = await SemearAsync();
        Db.Mandatos.AddRange(
            Mandato(joao, TipoCargo.GOVERNADOR, 2022, "SP", null, null, "4"));
        await Db.SaveChangesAsync();

        var cidade = await LerAsync<GestoesLidas>($"/api/municipios/{SaoPaulo}/gestoes");

        Assert.Equal([2025, 2017], cidade.Gestoes.Select(g => g.PrimeiroAno));
        Assert.Equal([maria], cidade.Gestoes[0].Prefeitos.Select(p => p.IdPessoa));
        var governadores = cidade.Gestoes[0].Governadores;
        Assert.Single(governadores);
        Assert.Equal((joao, 2025, 2026), (governadores[0].Governador.IdPessoa, governadores[0].DeAno, governadores[0].AteAno));
        Assert.False(cidade.Gestoes[0].ComPagamento);
    }

    /// <summary>Regra 5: o ano declarado 10 vezes fora da mediana da cidade sai da soma e aparece com o valor, para conferir.</summary>
    [SkippableFact]
    public async Task Gestoes_AnoDeclaradoForaDoPadrao_SaiDaSomaEApareceComOValor()
    {
        ExigeDocker();
        await SemearAsync();
        Db.ContasDosMunicipios.AddRange(
            Contas(2025, 600m), Contas(2026, 650m), Contas(2027, 11_000m), Contas(2028, 700m));
        await Db.SaveChangesAsync();

        var cidade = await LerAsync<GestoesComContas>($"/api/municipios/{SaoPaulo}/gestoes");

        var contas = cidade.Gestoes[0].Contas!;
        Assert.Equal((1_950m, 3), (contas.Receita, contas.AnosDeclarados));
        var fora = Assert.Single(contas.ForaDoPadrao);
        Assert.Equal((2027, 11_000m), (fora.Ano, fora.ReceitaDeclarada));
    }

    private static ContasDoMunicipioModel Contas(short ano, decimal receita) => new()
    {
        CodigoIbge = SaoPaulo, Ano = ano, ReceitaBruta = receita, Deducoes = 0m, DespesaEmpenhada = receita, DespesaPaga = receita,
    };

    /// <summary>Pendência 92: um ano por linha, do mais recente, com a eleição e os bens do mesmo ano juntos.</summary>
    [SkippableFact]
    public async Task LinhaDoTempo_JuntaOsMarcosPorAno()
    {
        ExigeDocker();
        var (joao, _) = await SemearAsync();
        Db.Patrimonios.Add(new PatrimonioModel { PessoaId = joao, AnoEleicao = 2018, TipoBem = "Casa", Valor = 500m, Quantidade = 1 });
        await Db.SaveChangesAsync();

        var linha = await LerAsync<LinhaLida>($"/api/politicos/{joao}/linha-do-tempo");

        Assert.Equal([2018, 2016], linha.Anos.Select(a => a.Ano));
        Assert.Equal(["ELEITO", "DECLAROU_BENS"], linha.Anos[0].Marcos.Select(m => m.Tipo));
        Assert.Equal(500m, linha.Anos[0].Marcos[1].Valor);
    }

    /// <summary>RISCO: o senador eleito em 2018 está na 57ª, e a campanha dele é a de 2018, não a de 2022.</summary>
    [SkippableFact]
    public async Task Campanha_DoSenador_EaDaEleicaoDoMandato()
    {
        ExigeDocker();
        var (joao, _) = await SemearAsync();
        Db.Mandatos.Add(new MandatoModel
        {
            PessoaId = joao, Cargo = TipoCargo.SENADOR, AnoEleicao = 2018, SqCandidato = "s", PrimeiroAno = 2019, UltimoAno = 2026,
            Uf = "SP", Partido = "XYZ", NomeDeUrna = "EXEMPLO",
        });
        Db.ReceitasDeCampanha.Add(new ReceitaDeCampanhaModel
        {
            PessoaId = joao, AnoEleicao = 2018, FonteReceita = "FUNDO ESPECIAL", Valor = 1000m, DoadorEhPessoaFisica = false,
        });
        await Db.SaveChangesAsync();

        var campanha = await LerAsync<CampanhaLida>($"/api/parlamentares/{joao}/financiamento?legislatura=57");

        Assert.Equal((2018, 1000m), (campanha.AnoEleicao, campanha.Total));
    }

    /// <summary>O link de compartilhar devolve a prévia com o nome e leva à ficha; o nome vem escapado.</summary>
    [SkippableFact]
    public async Task Compartilhar_DevolveAPreviaComONomeELevaAFicha()
    {
        ExigeDocker();
        var (_, maria) = await SemearAsync();
        var pessoa = await Db.Pessoas.FindAsync(maria);
        pessoa!.NomeExibicao = "MARIA <b>EXEMPLO</b>";
        await Db.SaveChangesAsync();

        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        var resposta = await cliente.GetAsync($"/api/compartilhar/{maria}");
        var html = await resposta.Content.ReadAsStringAsync();

        Assert.Equal("text/html", resposta.Content.Headers.ContentType?.MediaType);
        Assert.Contains("property=\"og:title\"", html);
        Assert.Contains($"/politico/{maria}", html);
        Assert.Contains("Prefeito de São Paulo", html);
        Assert.DoesNotContain("<b>", html);
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await cliente.GetAsync("/api/compartilhar/999999")).StatusCode);
    }

    /// <summary>A prévia da cidade diz o prefeito eleito mais recente e leva à página da cidade; CNPJ sem página dá 404.</summary>
    [SkippableFact]
    public async Task Compartilhar_ACidade_TrazOPrefeitoELevaAPaginaDaCidade()
    {
        ExigeDocker();
        await SemearAsync();

        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        var html = await cliente.GetStringAsync($"/api/compartilhar/cidade/{SaoPaulo}");

        Assert.Contains("São Paulo – SP", html);
        Assert.Contains("Prefeito eleito: Maria Exemplo", html);
        Assert.Contains($"/cidades/{SaoPaulo}", html);
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await cliente.GetAsync("/api/compartilhar/entidade/11222333000181")).StatusCode);
    }

    /// <summary>RISCO: o banco recusa prefeito sem município; a lista o mostraria sem saber de onde.</summary>
    [SkippableFact]
    public async Task Prefeito_SemMunicipio_ERejeitadoPeloBanco()
    {
        ExigeDocker();
        var (pessoa, _) = await SemearAsync();
        Db.Mandatos.Add(Mandato(pessoa, TipoCargo.PREFEITO, 2020, "SP", municipioTse: null, ibge: null, sq: "9"));

        var erro = await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_mandato_ente", ((PostgresException)erro.InnerException!).ConstraintName);
    }

    private async Task<(long PrefeitoEGovernador, long Prefeita)> SemearAsync()
    {
        Db.Municipios.Add(new MunicipioModel { CodigoIbge = SaoPaulo, CodigoTom = "7107", Nome = "São Paulo", Uf = "SP" });
        var joao = new PessoaModel { NomeCivil = "João Exemplo", NomeExibicao = "João Exemplo" };
        var maria = new PessoaModel { NomeCivil = "Maria Exemplo", NomeExibicao = "Maria Exemplo" };
        Db.Pessoas.AddRange(joao, maria);
        await Db.SaveChangesAsync();

        Db.Mandatos.AddRange(
            Mandato(joao.Id, TipoCargo.PREFEITO, 2016, "SP", "71072", SaoPaulo, "1"),
            Mandato(joao.Id, TipoCargo.GOVERNADOR, 2018, "SP", null, null, "2"),
            Mandato(maria.Id, TipoCargo.PREFEITO, 2024, "SP", "71072", SaoPaulo, "3"));
        await Db.SaveChangesAsync();
        return (joao.Id, maria.Id);
    }

    private static MandatoModel Mandato(
        long pessoa, TipoCargo cargo, short eleicao, string uf, string? municipioTse, string? ibge, string sq) => new()
        {
            PessoaId = pessoa,
            Cargo = cargo,
            AnoEleicao = eleicao,
            SqCandidato = sq,
            PrimeiroAno = (short)(eleicao + 1),
            UltimoAno = (short)(eleicao + 4),
            Uf = uf,
            CodigoMunicipioTse = municipioTse,
            CodigoMunicipioIbge = ibge,
            Partido = "XYZ",
            NomeDeUrna = "EXEMPLO",
        };

    private async Task<T> LerAsync<T>(string url)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<T>(url))!;
    }

    private sealed record MandatoLido(string Cargo, short AnoEleicao, MunicipioLido? Municipio);

    private sealed record MunicipioLido(string Nome);

    private sealed record PoliticoLido(long IdPessoa, MandatoLido Mandato, int Mandatos);

    private sealed record PaginaLida(List<PoliticoLido> Itens, int Total);

    private sealed record BuscaLida(List<PoliticoLido> Politicos);

    private sealed record EleitoLido(long IdPessoa);

    private sealed record ForaLido(int Ano, decimal ReceitaDeclarada);

    private sealed record ContasLidas(decimal Receita, int AnosDeclarados, List<ForaLido> ForaDoPadrao);

    private sealed record GestaoComContas(ContasLidas? Contas);

    private sealed record GestoesComContas(List<GestaoComContas> Gestoes);

    private sealed record CampanhaLida(int AnoEleicao, decimal Total);

    private sealed record MarcoLido(string Tipo, decimal? Valor);

    private sealed record AnoLido(int Ano, List<MarcoLido> Marcos);

    private sealed record LinhaLida(List<AnoLido> Anos);

    private sealed record GovernadorLido(EleitoLido Governador, int DeAno, int AteAno);

    private sealed record GestaoLida(int PrimeiroAno, List<EleitoLido> Prefeitos, List<GovernadorLido> Governadores, bool ComPagamento);

    private sealed record GestoesLidas(List<GestaoLida> Gestoes);

    private sealed record FichaLida(List<MandatoLido> Mandatos, bool Parlamentar);
}
