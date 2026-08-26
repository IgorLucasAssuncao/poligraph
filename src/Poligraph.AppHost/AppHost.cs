var builder = DistributedApplication.CreateBuilder(args);

// ─── infraestrutura ────────────────────────────────────────────────
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume();          // ⭐ o banco sobrevive ao restart

var bancoPoligraph = postgres.AddDatabase("poligraph");

// ─── migrations: roda ANTES da API e precisa TERMINAR ──────────────
// 🔴 DOTNET_ENVIRONMENT, não ASPNETCORE_ENVIRONMENT.
//
// O projeto de migrations é console, e `Host.CreateApplicationBuilder` lê
// DOTNET_ENVIRONMENT. O Aspire injeta ASPNETCORE_ENVIRONMENT, que só vale para
// projetos web — então sem esta linha o ambiente vira "Production" por padrão e o
// seed de desenvolvimento é PULADO EM SILÊNCIO. Sem erro. Só sem dado.
var migracoes = builder.AddProject<Projects.Poligraph_Migrations>("migracoes")
    .WithReference(bancoPoligraph)
    .WithEnvironment("DOTNET_ENVIRONMENT", builder.Environment.EnvironmentName)
    .WaitFor(postgres);

// ─── API ───────────────────────────────────────────────────────────
var api = builder.AddProject<Projects.Poligraph_Api>("api")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)   // 🔴 não sobe antes de o schema existir
    .WithExternalHttpEndpoints();

// ─── front ─────────────────────────────────────────────────────────
// ⚠️ O Vite precisa saber para onde mandar /api. Em produção quem roteia é o nginx,
//    na mesma origem; em desenvolvimento é o proxy do próprio Vite, que lê esta
//    variável. Sem ela o proxy apontaria para uma porta fixa que o Aspire não usa.
builder.AddNpmApp("web", "../web", "dev")
    .WithReference(api)
    .WaitFor(api)
    .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(env: "PORT", port: 5173)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
