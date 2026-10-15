using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Poligraph.Data;

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();

builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes
        .UseNpgsql(npgsql => npgsql.MigrationsAssembly(Migracoes.Assembly))
        .UseSnakeCaseNamingConvention());

var host = builder.Build();

using var escopo = host.Services.CreateScope();
var db = escopo.ServiceProvider.GetRequiredService<PoligraphDb>();
var log = escopo.ServiceProvider.GetRequiredService<ILogger<Program>>();

log.LogInformation("Aplicando migrations...");
await db.Database.MigrateAsync();
log.LogInformation("Migrations aplicadas.");

var curadoria = await CarregadorDePerguntas.CarregarAsync(db);
if (log.IsEnabled(LogLevel.Information))
{
    log.LogInformation("{Curadoria}", curadoria);
}

var perguntas = await db.Perguntas.CountAsync(p => p.Ativa);
var pessoas = await db.Pessoas.CountAsync();
if (log.IsEnabled(LogLevel.Information))
{
    log.LogInformation("Banco: {Pessoas} parlamentares, {Perguntas} perguntas ativas.", pessoas, perguntas);
}

if (pessoas == 0)
{
    log.LogWarning(
        "Nenhum parlamentar no banco. Rode o ETL para popular: no painel do Aspire, "
        + "inicie `etl-ingerir` e depois `etl-analisar`.");
}
