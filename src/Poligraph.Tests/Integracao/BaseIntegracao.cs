using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Testcontainers.PostgreSql;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Base dos testes de integração: Postgres REAL num container.
///
/// ⛔ Não usamos o provider InMemory do EF. Ele não tem CHECK, não tem FK e não tem tipo —
/// passaria em tudo que este projeto precisa validar, dando confiança falsa.
///
/// ⚠️ Exige Docker rodando. Sem Docker os testes são PULADOS, não falham: o CI tem Docker,
/// a máquina do desenvolvedor pode não ter, e um teste vermelho por falta de ambiente
/// treina a pessoa a ignorar vermelho.
/// </summary>
public abstract class BaseIntegracao : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("poligraph_teste")
        .Build();

    protected PoligraphDb Db { get; private set; } = null!;
    protected string ConnectionString { get; private set; } = "";
    protected bool DockerDisponivel { get; private set; }

    public async Task InitializeAsync()
    {
        try
        {
            await _postgres.StartAsync();
            DockerDisponivel = true;
        }
        catch (Exception)
        {
            DockerDisponivel = false;
            return;
        }

        ConnectionString = _postgres.GetConnectionString();
        Db = CriarContexto();

        // ⭐ Roda a migration DE VERDADE. Se um CHECK sumir na tradução para EF,
        //    os testes de schema acusam aqui.
        await Db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (Db is not null) await Db.DisposeAsync();
        if (DockerDisponivel) await _postgres.DisposeAsync();
    }

    protected PoligraphDb CriarContexto() =>
        new(new DbContextOptionsBuilder<PoligraphDb>()
            .UseNpgsql(ConnectionString)
            .UseSnakeCaseNamingConvention()   // 🔴 igual à produção, senão o teste mente
            .Options);

    /// <summary>Pula o teste quando não há Docker, em vez de falhar.</summary>
    protected void ExigeDocker() =>
        Skip.IfNot(DockerDisponivel, "Docker não está disponível — teste de integração pulado.");
}
