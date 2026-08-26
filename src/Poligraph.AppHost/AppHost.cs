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

// ─── ETL Python ────────────────────────────────────────────────────
// ⚠️ Não é serviço: roda, faz o trabalho e morre. São dois comandos distintos, então
//    são dois recursos — e cada um vira um botão próprio no painel do Aspire.
//
// 🔴 `WithExplicitStart()` é o ponto todo. Sem ele o `dotnet run` dispararia a
//    ingestão a cada subida: dezenas de MB de CSV baixados da Câmara e minutos de
//    espera antes de o ambiente ficar usável. Com ele o ambiente sobe completo e o
//    ETL fica pronto, esperando você mandar rodar.
//
// ⭐ Roda pelo Dockerfile de produção, não por Python do host: o que você executa aqui
//    é a mesma imagem que o VPS executa, e ninguém precisa de venv para subir o
//    projeto.
var etlIngerir = builder.AddDockerfile("etl-ingerir", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)   // 🔴 o Python nunca cria tabela — ver CLAUDE.md
    .WithExplicitStart()
    .WithArgs("ingerir", "--anos", "2025")
    // ⭐ O cache sobrevive ao container: reingerir não rebaixa os CSVs.
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache");

builder.AddDockerfile("etl-analisar", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("analisar", "--legislatura", "57")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    // ⚠️ Analisar sem ter ingerido monta uma matriz vazia e não avisa direito.
    .WithParentRelationship(etlIngerir);

builder.Build().Run();
