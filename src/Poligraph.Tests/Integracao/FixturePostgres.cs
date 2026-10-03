using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Testcontainers.PostgreSql;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// UM Postgres para toda a suíte de integração.
///
/// <para>
/// Antes disto a base era <c>IAsyncLifetime</c> direto, e o xUnit instancia a classe
/// de teste <b>uma vez por método</b> — subia um container e aplicava a migration
/// inteira <b>a cada teste</b>. Eram 126 containers e 126 migrations, o que o runner do
/// GitHub não aguentava.
/// </para>
///
/// <para>
/// O isolamento continua por teste: o <see cref="LimparAsync"/> trunca tudo antes de
/// cada um. É o mesmo desenho do lado Python (<c>conftest.py</c>), de propósito.
/// </para>
/// </summary>
public class FixturePostgres : IAsyncLifetime
{
    /// <summary>Nome da coleção xUnit — quem herda de <c>BaseIntegracao</c> entra nela.</summary>
    public const string Colecao = "Integracao";

    private const string Imagem = "postgres:17-alpine";

    private PostgreSqlContainer? _postgres;
    private string _limpeza = "";

    public bool DockerDisponivel { get; private set; }

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        try
        {
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

        await using var db = CriarContexto();

        await db.Database.MigrateAsync();

        _limpeza = MontarLimpeza(db);
    }

    public async Task DisposeAsync()
    {
        if (_postgres is not null)
        {
            await _postgres.DisposeAsync();
        }
    }

    public PoligraphDb CriarContexto() =>
        new(new DbContextOptionsBuilder<PoligraphDb>()
            .UseNpgsql(ConnectionString,
                       npgsql => npgsql.MigrationsAssembly(Migracoes.Assembly))
            .UseSnakeCaseNamingConvention()
            .Options);

    /// <summary>Devolve o banco ao estado pós-migration, sem recriar nada.</summary>
    public async Task LimparAsync()
    {
        await using var db = CriarContexto();
        await db.Database.ExecuteSqlRawAsync(_limpeza);
    }

    /// <summary>
    /// A lista de tabelas sai do MODELO do EF, não de uma lista escrita à mão — que
    /// silenciosamente deixaria de limpar toda tabela nova.
    /// </summary>
    private static string MontarLimpeza(PoligraphDb db)
    {
        var tabelas = db.Model.GetEntityTypes()
            .Select(e => e.GetTableName())
            .Where(nome => !string.IsNullOrEmpty(nome))
            .Distinct()
            .Select(nome => $"\"{nome}\"");

        return $"TRUNCATE {string.Join(", ", tabelas)} RESTART IDENTITY CASCADE";
    }
}

[CollectionDefinition(FixturePostgres.Colecao)]
public class ColecaoIntegracao : ICollectionFixture<FixturePostgres>;
