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
    configureDbContextOptions: opcoes => opcoes
        // 🔴 PL49 — as migrations moram NESTE projeto, ⛔ não no da API. O contexto vem
        //    de `Poligraph.Api`, e sem esta linha o EF procuraria migration lá e ⛔ não
        //    acharia nenhuma: `MigrateAsync` ⛔ não daria erro, criaria um banco VAZIO.
        .UseNpgsql(npgsql => npgsql.MigrationsAssembly(FabricaDesignTime.Assembly))
        .UseSnakeCaseNamingConvention());

var host = builder.Build();

using var escopo = host.Services.CreateScope();
var db = escopo.ServiceProvider.GetRequiredService<PoligraphDb>();

Console.WriteLine("Aplicando migrations...");
await db.Database.MigrateAsync();
Console.WriteLine("Migrations aplicadas.");

// 🔴 A curadoria de perguntas roda em TODO ambiente — é conteúdo do produto.
//
// ⚠️ Aqui existia também um semeador de 12 parlamentares fictícios, que rodava fora de
//    produção. Saiu quando o ETL passou a funcionar: o banco local é preenchido com a
//    Câmara de verdade, e ficção convivendo com 551 deputados reais só criava risco de
//    alguém tomar um pelo outro numa demonstração. Dado de teste foi para
//    `Poligraph.Tests/Fixtures/DadosDeTeste.cs`, que é onde ele pertence.
//
// ⚠️ E continua fora de `HasData()`: a curadoria muda quando avança, e conteúdo que
//    muda dentro de migration exigiria uma migration por revisão.
Console.WriteLine(await CarregadorDePerguntas.CarregarAsync(db));

var perguntas = await db.Perguntas.CountAsync(p => p.Ativa);
var pessoas = await db.Pessoas.CountAsync();
Console.WriteLine($"Banco: {pessoas} parlamentares, {perguntas} perguntas ativas.");

if (pessoas == 0)
{
    // ⭐ Diz o próximo passo, em vez de deixar a API subir com listas vazias e o
    //    desenvolvedor procurando o que houve.
    Console.WriteLine(
        "⚠️  Nenhum parlamentar no banco. Rode o ETL para popular: "
        + "no painel do Aspire, inicie `etl-ingerir` e depois `etl-analisar`.");
}
