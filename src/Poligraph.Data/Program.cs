using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Poligraph.Data;

// Aplicador de migrations. Existe separado da API por dois motivos:
// 1. Local: o Aspire garante a ordem com .WaitForCompletion(migracoes)
// 2. Produção: o deploy zero-downtime do Coolify sobe DOIS containers
// ao mesmo tempo. Migrate() dentro da API teria corrida. Aqui roda um
// executor só.

var builder = Host.CreateApplicationBuilder(args);

// Sem isto o aplicador ficava FORA do OpenTelemetry: era o único processo do
// projeto sem log estruturado, sem trace e sem métrica.
builder.AddServiceDefaults();

builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes
        // PL49 — as migrations moram NESTE projeto, não no da API. O contexto vem
        // de `Poligraph.Api`, e sem esta linha o EF procuraria migration lá e não
        // acharia nenhuma: `MigrateAsync` não daria erro, criaria um banco VAZIO.
        .UseNpgsql(npgsql => npgsql.MigrationsAssembly(Migracoes.Assembly))
        .UseSnakeCaseNamingConvention());

var host = builder.Build();

using var escopo = host.Services.CreateScope();
var db = escopo.ServiceProvider.GetRequiredService<PoligraphDb>();
var log = escopo.ServiceProvider.GetRequiredService<ILogger<Program>>();

log.LogInformation("Aplicando migrations...");
await db.Database.MigrateAsync();
log.LogInformation("Migrations aplicadas.");

// A curadoria de perguntas roda em TODO ambiente — é conteúdo do produto.
// Aqui existia também um semeador de 12 parlamentares fictícios, que rodava fora de
// produção. Saiu quando o ETL passou a funcionar: o banco local é preenchido com a
// Câmara de verdade, e ficção convivendo com 551 deputados reais só criava risco de
// alguém tomar um pelo outro numa demonstração. Dado de teste foi para
// `Poligraph.Tests/Fixtures/DadosDeTeste.cs`, que é onde ele pertence.
// E continua fora de `HasData()`: a curadoria muda quando avança, e conteúdo que
// muda dentro de migration exigiria uma migration por revisão.
log.LogInformation("{Curadoria}", await CarregadorDePerguntas.CarregarAsync(db));

var perguntas = await db.Perguntas.CountAsync(p => p.Ativa);
var pessoas = await db.Pessoas.CountAsync();
log.LogInformation("Banco: {Pessoas} parlamentares, {Perguntas} perguntas ativas.",
    pessoas, perguntas);

if (pessoas == 0)
{
    // Diz o próximo passo, em vez de deixar a API subir com listas vazias e o
    // desenvolvedor procurando o que houve.
    log.LogWarning(
        "Nenhum parlamentar no banco. Rode o ETL para popular: no painel do Aspire, "
        + "inicie `etl-ingerir` e depois `etl-analisar`.");
}
