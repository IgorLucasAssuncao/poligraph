var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume();

var bancoPoligraph = postgres.AddDatabase("poligraph");

var chaveCpf = builder.AddParameter("chave-cpf", secret: true);
var avisosChavePublica = builder.AddParameter("avisos-chave-publica");
var avisosChavePrivada = builder.AddParameter("avisos-chave-privada", secret: true);

var migracoes = builder.AddProject<Projects.Poligraph_Data>("migracoes")
    .WithReference(bancoPoligraph)
    .WithEnvironment("DOTNET_ENVIRONMENT", builder.Environment.EnvironmentName)
    .WaitFor(postgres);

var api = builder.AddProject<Projects.Poligraph_Api>("api")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithEnvironment("Avisos__ChavePublica", avisosChavePublica)
    .WithExternalHttpEndpoints();

builder.AddProject<Projects.Poligraph_Worker>("worker")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithEnvironment("Avisos__ChavePublica", avisosChavePublica)
    .WithEnvironment("Avisos__ChavePrivada", avisosChavePrivada);

builder.AddNpmApp("web", "../web", "dev")
    .WithReference(api)
    .WaitFor(api)
    .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(env: "PORT", port: 5173)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

var etlIngerir = builder.AddDockerfile("etl-ingerir", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("ingerir", "--anos", "2025")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf);

builder.AddDockerfile("etl-analisar", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("analisar", "--casa", "CAMARA", "--todas")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

string[] anosAnteriores = [.. Enumerable.Range(2001, 22).Select(ano => ano.ToString(System.Globalization.CultureInfo.InvariantCulture))];

builder.AddDockerfile("etl-historico-camara", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs(["ingerir", "--anos", .. anosAnteriores])
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

var etlSenado = builder.AddDockerfile("etl-senado", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs(["senado", "--anos", .. anosAnteriores, "2023", "2024", "2025", "2026"])
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf);

builder.AddDockerfile("etl-analisar-senado", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("analisar", "--casa", "SENADO", "--todas")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlSenado);

var etlCpf = builder.AddDockerfile("etl-cpf", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("cpf")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-rechavear-cpf", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("rechavear-cpf")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlCpf);

builder.AddDockerfile("etl-cota", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("cota", "--anos", "2025")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-fundo", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("fundo", "--eleicao", "2022")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlCpf);

builder.AddDockerfile("etl-emendas", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("emendas", "--anos", "2023", "2024", "2025", "2026")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-municipios", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("municipios")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-convenios", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("convenios")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-patrimonio", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("patrimonio")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-redes", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("redes")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-governo", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("governo", "--anos", "2023", "2024", "2025", "2026")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-conferir", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("conferir")
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-amostra", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("amostra")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithParentRelationship(etlIngerir);

builder.AddDockerfile("etl-palavras-chave", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("palavras-chave")
    .WithParentRelationship(etlIngerir);

foreach (var frequencia in new[] { "semanal", "mensal" })
{
    builder.AddDockerfile($"etl-rotina-{frequencia}", "../..", "docker/Dockerfile.etl")
        .WithReference(bancoPoligraph)
        .WaitForCompletion(migracoes)
        .WithExplicitStart()
        .WithArgs("rotina", "--frequencia", frequencia)
        .WithVolume("poligraph-etl-cache", "/etl/.cache")
        .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
        .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
        .WithParentRelationship(etlIngerir);
}

builder.Build().Run();
