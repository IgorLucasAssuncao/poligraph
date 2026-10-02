var builder = DistributedApplication.CreateBuilder(args);

// ─── infraestrutura ────────────────────────────────────────────────
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume();   // o banco sobrevive ao restart

var bancoPoligraph = postgres.AddDatabase("poligraph");

// PL77: a chave do HMAC do CPF. Secreta: vem dos user-secrets do AppHost
// (Parameters:chave-cpf), nunca de arquivo versionado. Perdê-la é perder a
// conciliação: os hashes novos não casariam com os do banco.
var chaveCpf = builder.AddParameter("chave-cpf", secret: true);

// ─── migrations: roda ANTES da API e precisa TERMINAR ──────────────
// DOTNET_ENVIRONMENT, não ASPNETCORE_ENVIRONMENT.
// O projeto de migrations é console, e `Host.CreateApplicationBuilder` lê
// DOTNET_ENVIRONMENT. O Aspire injeta ASPNETCORE_ENVIRONMENT, que só vale para
// projetos web — então sem esta linha o ambiente vira "Production" por padrão e o
// seed de desenvolvimento é PULADO EM SILÊNCIO. Sem erro. Só sem dado.
var migracoes = builder.AddProject<Projects.Poligraph_Data>("migracoes")
    .WithReference(bancoPoligraph)
    .WithEnvironment("DOTNET_ENVIRONMENT", builder.Environment.EnvironmentName)
    .WaitFor(postgres);

// ─── API ───────────────────────────────────────────────────────────
var api = builder.AddProject<Projects.Poligraph_Api>("api")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)   // não sobe antes de o schema existir
    .WithExternalHttpEndpoints();

// ─── front ─────────────────────────────────────────────────────────
// O Vite precisa saber para onde mandar /api. Em produção quem roteia é o nginx,
// na mesma origem; em desenvolvimento é o proxy do próprio Vite, que lê esta
// variável. Sem ela o proxy apontaria para uma porta fixa que o Aspire não usa.
builder.AddNpmApp("web", "../web", "dev")
    .WithReference(api)
    .WaitFor(api)
    .WithEnvironment("VITE_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(env: "PORT", port: 5173)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

// ─── ETL Python ────────────────────────────────────────────────────
// Não é serviço: roda, faz o trabalho e morre. São dois comandos distintos, então
// são dois recursos — e cada um vira um botão próprio no painel do Aspire.
// `WithExplicitStart()` é o ponto todo. Sem ele o `dotnet run` dispararia a
// ingestão a cada subida: dezenas de MB de CSV baixados da Câmara e minutos de
// espera antes de o ambiente ficar usável. Com ele o ambiente sobe completo e o
// ETL fica pronto, esperando você mandar rodar.
// Roda pelo Dockerfile de produção, não por Python do host: o que você executa aqui
// é a mesma imagem que o VPS executa, e ninguém precisa de venv para subir o
// projeto.
var etlIngerir = builder.AddDockerfile("etl-ingerir", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)   // o Python nunca cria tabela — ver CLAUDE.md
    .WithExplicitStart()
    .WithArgs("ingerir", "--anos", "2025")
    // O cache sobrevive ao container: reingerir não rebaixa os CSVs.
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf);

// Todas as legislaturas que estiverem na base, uma execução por legislatura. A que tiver
// menos votações que o mínimo fica sem grafo, e a tela não a oferece (achado #35).
builder.AddDockerfile("etl-analisar", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("analisar", "--casa", "CAMARA", "--todas")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    // Analisar sem ter ingerido monta uma matriz vazia e não avisa direito.
    .WithParentRelationship(etlIngerir);

// ─── As legislaturas anteriores ────────────────────────────────────
// A série da Câmara começa em 2001; o Senado responde nos mesmos anos. São centenas de MB
// de CSV, por isso botões próprios, separados da carga do ano corrente. Depois deles,
// `etl-analisar` e `etl-analisar-senado` desenham o grafo de cada legislatura.
string[] anosAnteriores = [.. Enumerable.Range(2001, 22).Select(ano => ano.ToString())];

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

// ─── O dinheiro do mandato ─────────────────────────────────────────
// **Ramo separado, e é uma distinção de método, não de arrumação.** Nada daqui
// entra em cálculo de afinidade: o título do TCC fala de voto, e o voto vem do ramo
// acima. Estes três povoam o **perfil** do parlamentar.
// A ORDEM entre eles importa em um ponto: `fundo` casa por hash de CPF, e sem `cpf`
// executado antes o de-para sai vazio e **toda** receita do TSE é descartada — 396 MB
// lidos para gravar zero. O comando barra isso com erro claro, mas o painel não
// tem como impedir o clique fora de ordem. Daí o parentesco: eles aparecem aninhados
// sob `etl-cpf`, que é o pré-requisito real.
var etlCpf = builder.AddDockerfile("etl-cpf", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("cpf")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    // Sem pessoas ingeridas não há a quem buscar CPF.
    .WithParentRelationship(etlIngerir);

// PL77: refaz todo hash de CPF com a chave atual (troca de algoritmo ou rotação da
// chave). Recarrega cpf, cota, campanha e patrimônio nos anos que já estão no banco.
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
    // Ano da ELEIÇÃO, não do exercício: 2022 elegeu a legislatura 57.
    .WithArgs("fundo", "--eleicao", "2022")
    // O volume é o que evita rebaixar 396 MB a cada execução.
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlCpf);

// Emendas, favorecidos e convênios saem do download público do Portal da
// Transparência, que não pede a chave pessoal da API de dados.
builder.AddDockerfile("etl-emendas", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("emendas", "--anos", "2023", "2024", "2025", "2026")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

// A cidade da sede de quem recebeu emenda, por CNPJ → TOM → IBGE, para o mapa. Roda
// depois de `etl-emendas`: procura só os CNPJs que já estão em emendas_favorecidos.
// O cadastro da Receita tem ~6 GB por mês; o volume de cache evita rebaixá-lo.
builder.AddDockerfile("etl-municipios", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("municipios")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

// O CNPJ de quem assinou cada convênio de emenda (arquivo completo de convênios do
// Portal), para a página da entidade mostrar o que foi combinado. Depois de `etl-emendas`.
builder.AddDockerfile("etl-convenios", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("convenios")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

// Bens declarados ao TSE (2018 e 2022), por tipo, e as redes sociais: Câmara para
// deputados, TSE para senadores. As duas ligam pelo cpf_hash — rode depois de `cpf`.
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

// Contexto da legislatura, não dado de parlamentar: quem governa (TSE), o orçamento,
// o pago de cada ano e a arrecadação (Portal). Não depende de nada ingerido antes.
builder.AddDockerfile("etl-governo", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("governo", "--anos", "2023", "2024", "2025", "2026")
    .WithVolume("poligraph-etl-cache", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CACHE", "/etl/.cache")
    .WithEnvironment("POLIGRAPH_CHAVE_CPF", chaveCpf)
    .WithParentRelationship(etlIngerir);

// PL66 — a conferência depois da carga: só lê, e falha se uma regra der ERRO. É o
// botão para apertar depois de qualquer ETL de voto (achado #37).
builder.AddDockerfile("etl-conferir", "../..", "docker/Dockerfile.etl")
    .WithReference(bancoPoligraph)
    .WaitForCompletion(migracoes)
    .WithExplicitStart()
    .WithArgs("conferir")
    .WithParentRelationship(etlIngerir);

builder.Build().Run();
