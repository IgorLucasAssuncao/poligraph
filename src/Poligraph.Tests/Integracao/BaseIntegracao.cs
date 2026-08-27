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
    private const string Imagem = "postgres:17-alpine";

    // 🔴 Construído DENTRO do try, ⛔ não como campo.
    //
    // ⚠️ O `PostgreSqlBuilder` valida a configuração já no construtor. Com um
    // `DOCKER_HOST` malformado ele lança `TypeInitializationException` — e como isso
    // acontecia num inicializador de campo, o estouro vinha do construtor da CLASSE DE
    // TESTE, antes de qualquer `try`. Resultado: os 86 testes ficavam **vermelhos** em
    // vez de pulados, justo o oposto do que esta classe promete.
    private PostgreSqlContainer? _postgres;

    protected PoligraphDb Db { get; private set; } = null!;
    protected string ConnectionString { get; private set; } = "";
    protected bool DockerDisponivel { get; private set; }

    public async Task InitializeAsync()
    {
        try
        {
            // ⭐ A imagem vai no construtor: o sem-parâmetro está obsoleto.
            _postgres = new PostgreSqlBuilder(Imagem)
                .WithDatabase("poligraph_teste")
                .Build();

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
        if (_postgres is not null) await _postgres.DisposeAsync();
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
