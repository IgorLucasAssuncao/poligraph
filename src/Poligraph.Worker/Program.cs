using Microsoft.EntityFrameworkCore;
using Hangfire;
using Hangfire.PostgreSql;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Worker;

if (args is [ChavesVapid.Comando, ..])
{
    ChavesVapid.Imprimir(Console.Out);
    return;
}

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();

builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes.UseSnakeCaseNamingConvention());

builder.Services.AddOptions<OpcoesDosAvisos>()
    .Bind(builder.Configuration.GetSection(OpcoesDosAvisos.Secao))
    .Validate(o => o.Completas, TextosDoWorker.FaltaChave)
    .ValidateOnStart();

builder.Services.AddScoped<ServicoNovidades>();
builder.Services.AddScoped<AvisadorDoUsuario>();
builder.Services.AddScoped<DistribuidorDeAvisos>();
builder.Services.AddScoped<LimpezaDosAvisos>();
builder.Services.AddHttpClient<EnviadorDePush>();

var conexao = builder.Configuration.GetConnectionString("poligraph")
    ?? throw new InvalidOperationException(TextosDoWorker.FaltaBanco);

builder.Services.AddHangfire(configuracao => configuracao
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(
        opcoes => opcoes.UseNpgsqlConnection(conexao),
        new PostgreSqlStorageOptions { SchemaName = TextosDoWorker.EsquemaDoHangfire, PrepareSchemaIfNecessary = true }));

builder.Services.AddHangfireServer(opcoes =>
{
    opcoes.ServerName = $"{Environment.MachineName}-{Environment.ProcessId}";
    opcoes.WorkerCount = 4;
});

var host = builder.Build();

var recorrentes = host.Services.GetRequiredService<IRecurringJobManager>();
recorrentes.AddOrUpdate<DistribuidorDeAvisos>(
    DistribuidorDeAvisos.Nome, d => d.DistribuirAsync(CancellationToken.None), DistribuidorDeAvisos.Frequencia);
recorrentes.AddOrUpdate<LimpezaDosAvisos>(
    LimpezaDosAvisos.Nome, l => l.LimparAsync(CancellationToken.None), LimpezaDosAvisos.Frequencia);

await host.RunAsync();
