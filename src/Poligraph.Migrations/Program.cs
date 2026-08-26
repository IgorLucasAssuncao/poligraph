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
//
// ⚠️ O log abaixo diz sempre qual ramo foi tomado, e isso não é verbosidade.
//    Esta decisão já falhou em silêncio uma vez: como app de console lê
//    DOTNET_ENVIRONMENT (e não ASPNETCORE_ENVIRONMENT), o ambiente virava
//    "Production" por padrão e o seed era pulado sem que nada indicasse o motivo.
//    O sintoma era a API respondendo 200 com listas vazias.
if (builder.Environment.IsProduction())
{
    Console.WriteLine("Ambiente Production: seed NÃO executado (correto para produção).");
}
else
{
    Console.WriteLine($"Ambiente {builder.Environment.EnvironmentName}: verificando dados de teste...");

    // ⚠️ O semeador diz qual ramo tomou. Pular em silêncio é o que fez o bug do
    //    DOTNET_ENVIRONMENT sobreviver — não repetir o padrão.
    Console.WriteLine(await SemeadorDesenvolvimento.SemearAsync(db));

    var pessoas = await db.Pessoas.CountAsync();
    var perguntas = await db.Perguntas.CountAsync();
    Console.WriteLine($"Banco agora: {pessoas} parlamentares, {perguntas} perguntas.");
}
