using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Tests.Fixtures;
using Poligraph.Worker;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Quem está em exercício pela lista oficial (decisão do autor, 2026-10-18): só esses podem ser
/// seguidos, e quem deixa o mandato sai da lista de seguidos, com aviso no site.
/// </summary>
public class TestesEmExercicio(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task SemListaCarregada_ValeARegraDoVoto()
    {
        ExigeDocker();
        await CenarioDeNovidades.SemearAsync(Db);

        Assert.Null(await EmExercicioNaBase.IdsAsync(Db, CancellationToken.None));
    }

    [SkippableFact]
    public async Task ListaCurta_ContaComoNaoCarregada()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        await CarregarListaAsync(idPessoa, deputados: 100);

        Assert.Null(await EmExercicioNaBase.IdsAsync(Db, CancellationToken.None));
    }

    [SkippableFact]
    public async Task ComLista_SoSegueQuemEstaNela_MesmoQueTenhaVotado()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        await CarregarListaAsync(emExercicio: null);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
        var ficha = await cliente.GetFromJsonAsync<FichaLida>($"/api/parlamentares/{idPessoa}");
        Assert.False(ficha!.EmExercicio);
    }

    [SkippableFact]
    public async Task ComLista_QuemEstaNelaPodeSerSeguido()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        await CarregarListaAsync(idPessoa);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();

        var ficha = await cliente.GetFromJsonAsync<FichaLida>($"/api/parlamentares/{idPessoa}");
        Assert.True(ficha!.EmExercicio);
    }

    /// <summary>Quem deixou o mandato sai da lista de seguidos, com o registro para o aviso e sem as chaves de aviso dele.</summary>
    [SkippableFact]
    public async Task Encerrador_TiraQuemSaiu_GuardaOAviso_EApagaAsChaves()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();
        var idUsuario = await Db.Usuarios.Select(u => u.Id).SingleAsync();
        Db.AvisosEnviados.AddRange(
            new AvisoEnviadoModel { UsuarioId = idUsuario, Chave = $"A2:novidade-1:{idPessoa}" },
            new AvisoEnviadoModel { UsuarioId = idUsuario, Chave = "A4:2026-09" });
        await Db.SaveChangesAsync();
        await CarregarListaAsync(emExercicio: null);

        await using var db = CriarContexto();
        await using (var transacao = await db.Database.BeginTransactionAsync())
        {
            Assert.Equal(1, await new EncerradorDeSeguidos(db, NullLogger<EncerradorDeSeguidos>.Instance).EncerrarAsync(CancellationToken.None));
            await transacao.CommitAsync();
        }

        await using var depois = CriarContexto();
        Assert.False(await depois.Segue.AnyAsync());
        Assert.Equal(idPessoa, (await depois.SeguidosEncerrados.SingleAsync()).PessoaId);
        Assert.Equal(["A4:2026-09"], await depois.AvisosEnviados.Select(a => a.Chave).ToListAsync());

        var encerrados = await cliente.GetFromJsonAsync<EncerradosLidos>("/api/seguidos/encerrados");
        Assert.Equal(idPessoa, Assert.Single(encerrados!.Parlamentares).IdPessoa);

        (await cliente.DeleteAsync("/api/seguidos/encerrados")).EnsureSuccessStatusCode();
        await using var dispensado = CriarContexto();
        Assert.False(await dispensado.SeguidosEncerrados.AnyAsync());
    }

    /// <summary>Com a lista oficial curta (a fonte falhou), ninguém sai da lista de seguidos.</summary>
    [SkippableFact]
    public async Task Encerrador_ComListaCurta_NaoTiraNinguem()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();
        await CarregarListaAsync(emExercicio: null, deputados: 10);

        await using var db = CriarContexto();
        await using var transacao = await db.Database.BeginTransactionAsync();
        Assert.Equal(0, await new EncerradorDeSeguidos(db, NullLogger<EncerradorDeSeguidos>.Instance).EncerrarAsync(CancellationToken.None));
        await transacao.CommitAsync();

        Assert.True(await CriarContexto().Segue.AnyAsync());
    }

    /// <summary>
    /// A lista oficial: pessoas de preenchimento até o mínimo de cada casa, mais quem o teste pede.
    /// </summary>
    private async Task CarregarListaAsync(long? emExercicio, int deputados = EmExercicioNaBase.MinimoDaCamara)
    {
        var total = deputados + EmExercicioNaBase.MinimoDoSenado;
        await Db.Database.ExecuteSqlAsync(
            $"INSERT INTO pessoas (nome_civil, nome_exibicao) SELECT 'Preenchimento ' || g, 'Preenchimento ' || g FROM generate_series(1, {total}) g");
        var ids = await Db.Pessoas.Where(p => p.NomeCivil.StartsWith("Preenchimento ")).Select(p => p.Id).OrderBy(id => id).ToListAsync();
        var carga = new CargaModel { Fonte = TipoFonteDeCarga.CAMARA, Url = "deputados", Sha256 = new string('f', 64), Bytes = 1, Comando = "teste" };
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();

        Db.EmExercicio.AddRange(ids.Select((id, i) => new EmExercicioModel
        {
            PessoaId = id, Casa = i < deputados ? TipoCasa.CAMARA : TipoCasa.SENADO, Legislatura = 57, CargaId = carga.Id,
        }));
        if (emExercicio is { } pessoa)
        {
            Db.EmExercicio.Add(new EmExercicioModel { PessoaId = pessoa, Casa = TipoCasa.CAMARA, Legislatura = 57, CargaId = carga.Id });
        }
        await Db.SaveChangesAsync();
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

    private record FichaLida(long IdPessoa, bool EmExercicio);

    private record EncerradoLido(long IdPessoa, string Nome);

    private record EncerradosLidos(short? NovaLegislatura, List<EncerradoLido> Parlamentares);
}
