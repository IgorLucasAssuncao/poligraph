using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// "O que mudou" (Pendência 63): os cinco avisos, cada um na janela do dado. As votações do teste
/// ficam em 2030 para a semana ser só delas; o mês fechado é o anterior ao de hoje.
/// </summary>
public class TestesNovidades(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/seguidos/novidades";

    [SkippableFact]
    public async Task SemConta_Retorna401()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync(Rota);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task SemSeguir_ListasVazias_ComADataDaCarga()
    {
        ExigeDocker();
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        Db.Cargas.Add(Carga());
        await Db.SaveChangesAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var lidas = (await cliente.GetFromJsonAsync<NovidadesLidas>(Rota))!;

        Assert.Empty(lidas.VotosNaSemana);
        Assert.Empty(lidas.GastosNaCota);
        Assert.Equal("Câmara dos Deputados", Assert.Single(lidas.Atualizacoes).Orgao);
    }

    /// <summary>
    /// Os cinco de uma vez, para quem a pessoa segue: votou na semana, votou contra a
    /// federação do próprio partido, trocou de partido, gastou na cota do mês fechado e
    /// teve emenda paga na competência fechada.
    /// </summary>
    [SkippableFact]
    public async Task OsCincoAvisos_NaJanelaDoDado()
    {
        ExigeDocker();
        var (pessoaId, partidoAntes) = await SemearAsync();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        (await cliente.PutAsync($"/api/seguidos/{pessoaId}", null)).EnsureSuccessStatusCode();

        var lidas = (await cliente.GetFromJsonAsync<NovidadesLidas>(Rota))!;

        Assert.Equal(new DateOnly(2030, 1, 4), lidas.Semana.De);
        Assert.Equal(new DateOnly(2030, 1, 10), lidas.Semana.Ate);

        var semana = Assert.Single(lidas.VotosNaSemana);
        Assert.Equal(2, semana.Votou);
        Assert.Null(semana.Ausente);

        var contra = Assert.Single(lidas.ContraOPartido);
        Assert.Equal("novidade-1", contra.VotacaoId);
        Assert.Equal("Fdr PT-PCdoB-PV", contra.Bancada);
        Assert.Equal(("Sim", "Não"), (contra.Voto, contra.Orientacao));

        if (partidoAntes != "PT")
        {
            var troca = Assert.Single(lidas.TrocasDePartido);
            Assert.Equal((partidoAntes, "PT"), (troca.PartidoAnterior, troca.PartidoNovo));
            Assert.Equal(new DateOnly(2030, 1, 9), troca.PrimeiroVoto);
        }

        var cota = Assert.Single(lidas.GastosNaCota);
        Assert.Equal((MesFechado.Year, MesFechado.Month), (cota.Ano, cota.Mes));
        Assert.Equal(150m, cota.Total);
        Assert.Equal(("DIVULGAÇÃO", 100m), (cota.MaiorCategoria, cota.MaiorCategoriaValor));

        var emenda = Assert.Single(lidas.EmendasPagas);
        Assert.Equal(MesFechado, emenda.Mes);
        Assert.Equal(800m, emenda.Pago);
        Assert.Equal(("CONSTRUTORA EXEMPLO LTDA", "LINDOESTE (PR)"), (emenda.MaiorDestino, emenda.LugarDoMaiorDestino));
    }

    private static DateOnly MesFechado
    {
        get
        {
            var hoje = DateTimeOffset.UtcNow;
            return new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(-1);
        }
    }

    private static DateOnly MesAberto => MesFechado.AddMonths(1);

    private async Task<(long PessoaId, string PartidoAntes)> SemearAsync()
    {
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);
        var corrente = await Db.Votacoes.MaxAsync(v => v.Legislatura);
        var pessoaId = await Db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Legislatura == corrente && v.Votacao.Casa == TipoCasa.CAMARA)
            .OrderBy(v => v.PessoaId).Select(v => v.PessoaId).FirstAsync();
        var partidoAntes = await Db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == pessoaId).OrderByDescending(v => v.Votacao!.Data)
            .Select(v => v.PartidoNoVoto).FirstAsync();

        Db.Votacoes.AddRange(
            Votacao("novidade-1", new DateOnly(2030, 1, 10), corrente),
            Votacao("novidade-2", new DateOnly(2030, 1, 9), corrente));
        await Db.SaveChangesAsync();

        Db.Votos.AddRange(
            new VotoModel { VotacaoId = "novidade-1", PessoaId = pessoaId, Valor = 1, PartidoNoVoto = "PT", UfNoVoto = "SP" },
            new VotoModel { VotacaoId = "novidade-2", PessoaId = pessoaId, Valor = -1, PartidoNoVoto = "PT", UfNoVoto = "SP" });
        Db.Orientacoes.AddRange(
            new OrientacaoModel { VotacaoId = "novidade-1", Bancada = "Fdr PT-PCdoB-PV", Orientacao = "Não" },
            new OrientacaoModel { VotacaoId = "novidade-1", Bancada = "Governo", Orientacao = "Sim" },
            new OrientacaoModel { VotacaoId = "novidade-2", Bancada = "Fdr PT-PCdoB-PV", Orientacao = "Não" });

        Db.Despesas.AddRange(
            Despesa(pessoaId, MesFechado, "DIVULGAÇÃO", 100m),
            Despesa(pessoaId, MesFechado, "COMBUSTÍVEL", 50m),
            Despesa(pessoaId, MesAberto, "DIVULGAÇÃO", 999m));

        const string codigo = "202512340001";
        Db.Emendas.AddRange(
            Emenda(pessoaId, codigo, "LINDOESTE - PR"),
            Emenda(pessoaId, codigo, "CASCAVEL - PR"));
        Db.EmendasFavorecidos.AddRange(
            Favorecido(codigo, MesFechado, "BANCO DO BRASIL SA", 500m, intermediario: true),
            Favorecido(codigo, MesFechado, "CONSTRUTORA EXEMPLO LTDA", 300m, intermediario: false),
            Favorecido(codigo, MesAberto, "CONSTRUTORA EXEMPLO LTDA", 999m, intermediario: false));
        await Db.SaveChangesAsync();

        return (pessoaId, partidoAntes);
    }

    private static VotacaoModel Votacao(string id, DateOnly data, short legislatura) => new()
    {
        Id = id, Casa = TipoCasa.CAMARA, Legislatura = legislatura, Data = data, Descricao = "Aprovado o Projeto",
        Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
    };

    private static DespesaModel Despesa(long pessoaId, DateOnly mes, string categoria, decimal valor) => new()
    {
        PessoaId = pessoaId, Ano = (short)mes.Year, Mes = (short)mes.Month, Categoria = categoria, ValorLiquido = valor
    };

    private static EmendaModel Emenda(long pessoaId, string codigo, string localidade) => new()
    {
        PessoaId = pessoaId, CodigoAutor = "1234", NomeAutor = "FULANO", CodigoEmenda = codigo, Ano = 2025,
        Localidade = localidade, CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000",
        ValorEmpenhado = 1000m, ValorPago = 500m
    };

    private static EmendaFavorecidoModel Favorecido(string codigo, DateOnly mes, string nome, decimal valor, bool intermediario) => new()
    {
        CodigoEmenda = codigo, Competencia = mes, Tipo = TipoFavorecido.PESSOA_JURIDICA,
        Documento = intermediario ? "00000000000191" : "12345678000190", Nome = nome,
        Uf = "PR", Municipio = "LINDOESTE", Valor = valor, Intermediario = intermediario
    };

    private static CargaModel Carga() => new()
    {
        Fonte = TipoFonteDeCarga.CAMARA, Url = "https://exemplo/votacoes-2030.csv",
        Sha256 = new string('c', 64), Bytes = 1, Comando = "teste"
    };

    private HttpClient CriarCliente()
    {
        var fabrica = new FabricaApi(ConnectionString)
            .WithWebHostBuilder(b => b.ConfigureServices(s =>
            {
                s.RemoveAll<IValidadorGoogle>();
                s.AddScoped<IValidadorGoogle>(_ => new ValidadorFalso());
            }));

        return fabrica.CreateClient(new() { HandleCookies = true });
    }

    private static async Task EntrarAsync(HttpClient cliente) =>
        (await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" })).EnsureSuccessStatusCode();

    private record PeriodoLido(DateOnly De, DateOnly Ate);

    private record AtualizacaoLida(string Fonte, string Orgao, DateTimeOffset UltimaCarga);

    private record SemanaLida(long PessoaId, int Votou, int? Ausente);

    private record ContraLido(string VotacaoId, string Bancada, string Orientacao, string Voto);

    private record TrocaLida(string PartidoAnterior, string PartidoNovo, DateOnly PrimeiroVoto);

    private record CotaLida(int Ano, int Mes, decimal Total, string MaiorCategoria, decimal MaiorCategoriaValor);

    private record EmendaLida(DateOnly Mes, decimal Pago, string? MaiorDestino, string? LugarDoMaiorDestino);

    private record NovidadesLidas(
        PeriodoLido Semana,
        List<AtualizacaoLida> Atualizacoes,
        List<SemanaLida> VotosNaSemana,
        List<ContraLido> ContraOPartido,
        List<TrocaLida> TrocasDePartido,
        List<CotaLida> GastosNaCota,
        List<EmendaLida> EmendasPagas);
}
