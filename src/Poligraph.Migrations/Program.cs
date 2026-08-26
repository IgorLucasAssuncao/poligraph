using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Poligraph.Api.Data;
using Poligraph.Migrations;

// ═══════════════════════════════════════════════════════════════════
// Aplicador de migrations. Existe separado da API por dois motivos:
//
//  1. Local: o Aspire garante a ordem com .WaitForCompletion(migracoes)
//  2. 🔴 Produção: o deploy zero-downtime do Coolify sobe DOIS containers
//     ao mesmo tempo. Migrate() dentro da API teria corrida. Aqui roda um
//     executor só.
// ═══════════════════════════════════════════════════════════════════

var builder = Host.CreateApplicationBuilder(args);

builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes.UseSnakeCaseNamingConvention());

var host = builder.Build();

using var escopo = host.Services.CreateScope();
var db = escopo.ServiceProvider.GetRequiredService<PoligraphDb>();

Console.WriteLine("Aplicando migrations...");
await db.Database.MigrateAsync();
Console.WriteLine("Migrations aplicadas.");

// ⛔ Dados de teste NUNCA em produção. E nunca via HasData(), que entraria
//    dentro da migration e semearia produção junto.
if (!builder.Environment.IsProduction())
{
    Console.WriteLine($"Ambiente {builder.Environment.EnvironmentName}: semeando dados de teste...");
    await SemeadorDesenvolvimento.SemearAsync(db);
    Console.WriteLine("Seed concluído.");
}
