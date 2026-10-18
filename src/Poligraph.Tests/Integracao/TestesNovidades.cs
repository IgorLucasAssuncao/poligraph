using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Tests.Fixtures;

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
        Db.Cargas.Add(CenarioDeNovidades.Carga());
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
        var (idPessoa, partidoAntes) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();

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
        Assert.Equal((CenarioDeNovidades.MesFechado.Year, CenarioDeNovidades.MesFechado.Month), (cota.AnoDaDespesa, cota.Mes));
        Assert.Equal(150m, cota.Total);
        Assert.Equal(("DIVULGAÇÃO", 100m), (cota.MaiorCategoria, cota.MaiorCategoriaValor));

        var emenda = Assert.Single(lidas.EmendasPagas);
        Assert.Equal(CenarioDeNovidades.MesFechado, emenda.Mes);
        Assert.Equal(800m, emenda.Pago);
        Assert.Equal(("CONSTRUTORA EXEMPLO LTDA", "LINDOESTE (PR)"), (emenda.MaiorDestino, emenda.LugarDoMaiorDestino));
    }

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

    private record SemanaLida(long IdPessoa, int Votou, int? Ausente);

    private record ContraLido(string VotacaoId, string Bancada, string Orientacao, string Voto);

    private record TrocaLida(string PartidoAnterior, string PartidoNovo, DateOnly PrimeiroVoto);

    private record CotaLida(int AnoDaDespesa, int Mes, decimal Total, string MaiorCategoria, decimal MaiorCategoriaValor);

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
