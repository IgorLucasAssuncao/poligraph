using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Worker;

namespace Poligraph.Tests;

/// <summary>
/// Avisos no navegador (Pendência 89): a inscrição pela API, o consentimento próprio, a limpeza ao
/// deixar de seguir e o worker que distribui os eventos e avisa sem repetir.
/// </summary>
public class TestesAvisos(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string ChavePublicaDeTeste = "chave-publica-de-teste";

    [SkippableFact]
    public async Task Inscrever_SemConsentimento_Retorna428_ENaoGrava()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1", Navegador());

        Assert.Equal(HttpStatusCode.PreconditionRequired, resposta.StatusCode);
        await using var db = CriarContexto();
        Assert.False(await db.InscricoesNoNavegador.AnyAsync());
    }

    [SkippableFact]
    public async Task Inscrever_ComAceite_GravaInscricaoEConsentimentoProprio()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", Navegador());

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        await using var db = CriarContexto();
        Assert.Single(await db.InscricoesNoNavegador.ToListAsync());
        var consentimento = Assert.Single(await db.Consentimentos.ToListAsync());
        Assert.Equal(TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR, consentimento.Finalidade);
    }

    [SkippableFact]
    public async Task Inscrever_ComEnderecoQueNaoEHttps_Retorna400()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var resposta = await cliente.PutAsJsonAsync(
            "/api/avisos/navegador?versao=v1&aceite=true", Navegador() with { Endereco = "http://inseguro.exemplo/x" });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    /// <summary>Quem acabou de se inscrever não recebe de uma vez o que já vê no "O que mudou".</summary>
    [SkippableFact]
    public async Task Inscrever_MarcaComoVistoOQueJaExiste()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        await SeguirAsync(cliente, idPessoa);

        (await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", Navegador())).EnsureSuccessStatusCode();

        var chaves = await ChavesAsync();
        Assert.Contains($"A2:novidade-1:{idPessoa}", chaves);
        Assert.Contains($"A4:{CenarioDeNovidades.MesFechado:yyyy-MM}", chaves);
        Assert.Contains($"A5:{CenarioDeNovidades.MesFechado:yyyy-MM}", chaves);
    }

    /// <summary>Com os avisos já ligados, seguir alguém novo não traz o passado dele: os fatos dele viram avisados; o resumo do mês, não.</summary>
    [SkippableFact]
    public async Task SeguirComAvisosLigados_NaoAvisaOPassadoDoParlamentar()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        (await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", Navegador())).EnsureSuccessStatusCode();
        Assert.Empty(await ChavesAsync());

        await SeguirAsync(cliente, idPessoa);

        var chaves = await ChavesAsync();
        Assert.Contains($"A2:novidade-1:{idPessoa}", chaves);
        Assert.DoesNotContain(chaves, c => c.StartsWith("A4:", StringComparison.Ordinal) || c.StartsWith("A5:", StringComparison.Ordinal));
    }

    [Fact]
    public void ChaveDoParlamentar_NaoConfundeIdsParecidos()
    {
        Assert.True(ChavesDosAvisos.DoParlamentar("A2:2265603-43:7", 7));
        Assert.False(ChavesDosAvisos.DoParlamentar("A2:2265603-43:17", 7));
        Assert.True(ChavesDosAvisos.DoParlamentar("A3:7:2030-01-09", 7));
        Assert.False(ChavesDosAvisos.DoParlamentar("A3:17:2030-01-09", 7));
        Assert.False(ChavesDosAvisos.DoParlamentar("A4:2026-09", 7));
    }

    /// <summary>Deixar de seguir não pode deixar rastro de que seguia: saem as chaves do parlamentar, fica o resumo do mês.</summary>
    [SkippableFact]
    public async Task DeixarDeSeguir_ApagaAsChavesDoParlamentar()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        await SeguirAsync(cliente, idPessoa);
        (await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", Navegador())).EnsureSuccessStatusCode();

        (await cliente.DeleteAsync($"/api/seguidos/{idPessoa}")).EnsureSuccessStatusCode();

        var chaves = await ChavesAsync();
        Assert.DoesNotContain(chaves, c => c.StartsWith("A2:", StringComparison.Ordinal) || c.StartsWith("A3:", StringComparison.Ordinal));
        Assert.Contains($"A4:{CenarioDeNovidades.MesFechado:yyyy-MM}", chaves);
    }

    [SkippableFact]
    public async Task RevogarAvisos_ApagaNavegadoresEHistorico_EGuardaARevogacao()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        await SeguirAsync(cliente, idPessoa);
        (await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", Navegador())).EnsureSuccessStatusCode();

        (await cliente.DeleteAsync("/api/avisos/consentimento")).EnsureSuccessStatusCode();

        await using var db = CriarContexto();
        Assert.False(await db.InscricoesNoNavegador.AnyAsync());
        Assert.False(await db.AvisosEnviados.AnyAsync());
        var avisos = await db.Consentimentos.SingleAsync(c => c.Finalidade == TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR);
        Assert.NotNull(avisos.RevogadoEm);
        Assert.True(await db.Segue.AnyAsync());
    }

    [SkippableFact]
    public async Task ExcluirConta_LevaNavegadoresEAvisos()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        await SeguirAsync(cliente, idPessoa);
        (await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", Navegador())).EnsureSuccessStatusCode();

        (await cliente.DeleteAsync("/api/auth/conta")).EnsureSuccessStatusCode();

        await using var db = CriarContexto();
        Assert.False(await db.InscricoesNoNavegador.AnyAsync());
        Assert.False(await db.AvisosEnviados.AnyAsync());
    }

    [SkippableFact]
    public async Task Estado_DizSeEsteNavegadorRecebe()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);
        var navegador = Navegador();
        (await cliente.PutAsJsonAsync("/api/avisos/navegador?versao=v1&aceite=true", navegador)).EnsureSuccessStatusCode();

        var estado = await cliente.GetFromJsonAsync<EstadoLido>($"/api/avisos?endereco={Uri.EscapeDataString(navegador.Endereco)}");
        var outro = await cliente.GetFromJsonAsync<EstadoLido>("/api/avisos?endereco=https%3A%2F%2Foutro");

        Assert.Equal(new EstadoLido(true, 1, true), estado);
        Assert.False(outro!.EsteNavegador);
    }

    [SkippableFact]
    public async Task Chave_DevolveAPublicaConfigurada()
    {
        ExigeDocker();
        using var cliente = CriarCliente();
        await EntrarAsync(cliente);

        var chave = await cliente.GetFromJsonAsync<ChaveLida>("/api/avisos/chave");

        Assert.Equal(ChavePublicaDeTeste, chave!.ChavePublica);
    }

    /// <summary>Rotina que terminou bem vira um job por pessoa inscrita, e o evento não é distribuído duas vezes.</summary>
    [SkippableFact]
    public async Task Distribuidor_UmJobPorPessoa_EUmaVezSo()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();
        Db.Eventos.Add(new EventoModel { Tipo = TipoDeEvento.ROTINA_SEMANAL });
        await Db.SaveChangesAsync();
        var jobs = new FilaFalsa();

        await Distribuidor(jobs).DistribuirAsync(CancellationToken.None);
        await Distribuidor(jobs).DistribuirAsync(CancellationToken.None);

        Assert.Equal([idUsuario], jobs.Usuarios);
        await using var db = CriarContexto();
        Assert.NotNull((await db.Eventos.SingleAsync()).ProcessadoEm);
    }

    [SkippableFact]
    public async Task Distribuidor_SemEvento_NaoAbreJob()
    {
        ExigeDocker();
        await PessoaInscritaAsync();
        var jobs = new FilaFalsa();

        await Distribuidor(jobs).DistribuirAsync(CancellationToken.None);

        Assert.Empty(jobs.Usuarios);
    }

    /// <summary>A novidade nova vira um aviso; rodar de novo não repete.</summary>
    [SkippableFact]
    public async Task Avisador_AvisaUmaVez()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();
        var push = new PushFalso(HttpStatusCode.Created);

        await Avisador(push).AvisarAsync(idUsuario, CancellationToken.None);
        await Avisador(push).AvisarAsync(idUsuario, CancellationToken.None);

        Assert.Equal(1, push.Envios);
        var chaves = await ChavesAsync();
        Assert.Contains(chaves, c => c.StartsWith("A2:novidade-1:", StringComparison.Ordinal));
        Assert.Contains($"A4:{CenarioDeNovidades.MesFechado:yyyy-MM}", chaves);
    }

    /// <summary>Duas cópias do worker na mesma pessoa ao mesmo tempo: só uma avisa.</summary>
    [SkippableFact]
    public async Task Avisador_DuasCopiasAoMesmoTempo_AvisaUmaVez()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();
        var push = new PushFalso(HttpStatusCode.Created);

        await Task.WhenAll(
            Avisador(push).AvisarAsync(idUsuario, CancellationToken.None),
            Avisador(push).AvisarAsync(idUsuario, CancellationToken.None));

        Assert.Equal(1, push.Envios);
    }

    [SkippableFact]
    public async Task Avisador_NavegadorQueNaoExisteMais_SaiDaLista()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();

        await Avisador(new PushFalso(HttpStatusCode.Gone)).AvisarAsync(idUsuario, CancellationToken.None);

        await using var db = CriarContexto();
        Assert.False(await db.InscricoesNoNavegador.AnyAsync());
    }

    /// <summary>Falha do fabricante desfaz a reserva das chaves: a nova tentativa do Hangfire ainda avisa.</summary>
    [SkippableFact]
    public async Task Avisador_FalhaNoFabricante_DesfazAReserva()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();

        await Assert.ThrowsAnyAsync<Exception>(() =>
            Avisador(new PushFalso(HttpStatusCode.BadRequest)).AvisarAsync(idUsuario, CancellationToken.None));

        Assert.Empty(await ChavesAsync());
        var push = new PushFalso(HttpStatusCode.Created);
        await Avisador(push).AvisarAsync(idUsuario, CancellationToken.None);
        Assert.Equal(1, push.Envios);
    }

    [SkippableFact]
    public async Task Avisador_SemConsentimento_NaoAvisa()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();
        await Db.Consentimentos.Where(c => c.Finalidade == TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.RevogadoEm, DateTimeOffset.UtcNow));
        var push = new PushFalso(HttpStatusCode.Created);

        await Avisador(push).AvisarAsync(idUsuario, CancellationToken.None);

        Assert.Equal(0, push.Envios);
    }

    [SkippableFact]
    public async Task Limpeza_ApagaOQuePassouDe90Dias()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();
        Db.AvisosEnviados.AddRange(
            new AvisoEnviadoModel { UsuarioId = idUsuario, Chave = "A4:2020-01", EnviadoEm = DateTimeOffset.UtcNow.AddDays(-91) },
            new AvisoEnviadoModel { UsuarioId = idUsuario, Chave = "A4:2020-02", EnviadoEm = DateTimeOffset.UtcNow.AddDays(-10) });
        await Db.SaveChangesAsync();

        await new LimpezaDosAvisos(CriarContexto(), NullLogger<LimpezaDosAvisos>.Instance).LimparAsync(CancellationToken.None);

        Assert.Equal(["A4:2020-02"], await ChavesAsync());
    }

    [SkippableFact]
    public async Task ChaveForaDoFormato_OBancoRecusa()
    {
        ExigeDocker();
        var idUsuario = await PessoaInscritaAsync();
        Db.AvisosEnviados.Add(new AvisoEnviadoModel { UsuarioId = idUsuario, Chave = "Fulano votou contra" });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    /// <summary>Usuário que segue o deputado do cenário, com consentimento e um navegador, sem nada avisado ainda.</summary>
    private async Task<long> PessoaInscritaAsync()
    {
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        var usuario = new UsuarioModel { GoogleSub = "sub-avisos", Email = "avisos@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();
        var navegador = Navegador();
        Db.Segue.Add(new SegueModel { UsuarioId = usuario.Id, PessoaId = idPessoa });
        Db.Consentimentos.Add(new ConsentimentoModel { UsuarioId = usuario.Id, Finalidade = TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR, Versao = "v1" });
        Db.InscricoesNoNavegador.Add(new InscricaoNoNavegadorModel
        {
            UsuarioId = usuario.Id, Endereco = navegador.Endereco, P256dh = navegador.P256dh, Auth = navegador.Auth,
        });
        await Db.SaveChangesAsync();
        return usuario.Id;
    }

    private DistribuidorDeAvisos Distribuidor(IBackgroundJobClient jobs)
    {
        var db = CriarContexto();
        return new(db, jobs, new EncerradorDeSeguidos(db, NullLogger<EncerradorDeSeguidos>.Instance), NullLogger<DistribuidorDeAvisos>.Instance);
    }

    private AvisadorDoUsuario Avisador(PushFalso push)
    {
        var db = CriarContexto();
        var (publica, privada) = ChavesVapid.Gerar();
        var opcoes = Options.Create(new OpcoesDosAvisos { ChavePublica = publica, ChavePrivada = privada });
        return new AvisadorDoUsuario(db, new ServicoNovidades(db), new EnviadorDePush(new HttpClient(push), opcoes),
            NullLogger<AvisadorDoUsuario>.Instance);
    }

    private async Task<List<string>> ChavesAsync()
    {
        await using var db = CriarContexto();
        return await db.AvisosEnviados.Select(a => a.Chave).OrderBy(c => c).ToListAsync();
    }

    /// <summary>Uma inscrição com chaves P-256 de verdade: a biblioteca cifra o aviso com elas.</summary>
    private static NavegadorEnviado Navegador()
    {
        using var navegador = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var ponto = navegador.ExportParameters(false).Q;
        byte[] publica = [0x04, .. ponto.X!, .. ponto.Y!];
        return new NavegadorEnviado(
            $"https://push.exemplo/envio/{Guid.NewGuid():N}",
            Base64Url.EncodeToString(publica),
            Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(16)));
    }

    private HttpClient CriarCliente()
    {
        var fabrica = new FabricaApi(ConnectionString)
            .WithWebHostBuilder(b =>
            {
                b.UseSetting(Poligraph.Api.Endpoints.EndpointsAvisos.ChavePublicaNaConfiguracao, ChavePublicaDeTeste);
                b.ConfigureServices(s =>
                {
                    s.RemoveAll<IValidadorGoogle>();
                    s.AddScoped<IValidadorGoogle>(_ => new ValidadorFalso());
                });
            });

        return fabrica.CreateClient(new() { HandleCookies = true });
    }

    private static async Task EntrarAsync(HttpClient cliente) =>
        (await cliente.PostAsJsonAsync("/api/auth/google", new { idToken = "token-valido" })).EnsureSuccessStatusCode();

    private static async Task SeguirAsync(HttpClient cliente, long idPessoa) =>
        (await cliente.PutAsync($"/api/seguidos/{idPessoa}?versao=v1&aceite=true", null)).EnsureSuccessStatusCode();

    private record NavegadorEnviado(string Endereco, string P256dh, string Auth);

    private record EstadoLido(bool Consentimento, int Navegadores, bool EsteNavegador);

    private record ChaveLida(string? ChavePublica);

    /// <summary>O serviço de push do fabricante, respondendo sempre o mesmo status.</summary>
    private sealed class PushFalso(HttpStatusCode status) : HttpMessageHandler
    {
        private int _envios;

        public int Envios => _envios;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (status == HttpStatusCode.Created)
            {
                Interlocked.Increment(ref _envios);
            }
            return Task.FromResult(new HttpResponseMessage(status));
        }
    }

    /// <summary>A fila do Hangfire, guardando para quem cada job foi aberto.</summary>
    private sealed class FilaFalsa : IBackgroundJobClient
    {
        public List<long> Usuarios { get; } = [];

        public string Create(Job job, IState state)
        {
            Usuarios.Add((long)job.Args[0]);
            return Usuarios.Count.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        public bool ChangeState(string jobId, IState state, string expectedState) => true;
    }
}
