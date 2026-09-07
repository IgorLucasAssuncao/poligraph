using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Base dos testes de integração: Postgres REAL, compartilhado pela suíte inteira.
///
/// ⛔ Não usamos o provider InMemory do EF. Ele não tem CHECK, não tem FK e não tem tipo —
/// passaria em tudo que este projeto precisa validar, dando confiança falsa.
///
/// ⚠️ Exige Docker. Sem Docker os testes são PULADOS, não falham: um teste vermelho por
/// falta de ambiente treina a pessoa a ignorar vermelho.
/// </summary>
[Collection(FixturePostgres.Colecao)]
public abstract class BaseIntegracao(FixturePostgres postgres) : IAsyncLifetime
{
    protected PoligraphDb Db { get; private set; } = null!;

    protected string ConnectionString => postgres.ConnectionString;

    public async Task InitializeAsync()
    {
        if (!postgres.DockerDisponivel) return;

        await postgres.LimparAsync();
        Db = postgres.CriarContexto();
    }

    public async Task DisposeAsync()
    {
        if (Db is not null) await Db.DisposeAsync();
    }

    protected PoligraphDb CriarContexto() => postgres.CriarContexto();

    /// <summary>Pula o teste quando não há Docker, em vez de falhar.</summary>
    protected void ExigeDocker() =>
        Skip.IfNot(postgres.DockerDisponivel, "Docker não está disponível — teste de integração pulado.");
}
