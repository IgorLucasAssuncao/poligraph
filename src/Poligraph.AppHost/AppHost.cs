var builder = DistributedApplication.CreateBuilder(args);

// ─── infraestrutura ────────────────────────────────────────────────
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume();          // ⭐ o banco sobrevive ao restart

var bancoPoligraph = postgres.AddDatabase("poligraph");

// ─── migrations: roda ANTES da API e precisa TERMINAR ──────────────
var migracoes = builder.AddProject<Projects.Poligraph_Migrations>("migracoes")
    .WithReference(bancoPoligraph)
    .WaitFor(postgres);

// ─── API ───────────────────────────────────────────────────────────
builder.AddProject<Projects.Poligraph_Api>("api")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)   // 🔴 não sobe antes de o schema existir
    .WithExternalHttpEndpoints();

builder.Build().Run();
