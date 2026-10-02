using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Configuracao;
using Poligraph.Api.Endpoints;
using Poligraph.Data;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddOpenApi();

builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes.UseSnakeCaseNamingConvention());

builder.AdicionarAutenticacao();
builder.Services.AdicionarServicos();

var app = builder.Build();

app.UseResponseCompression();

app.MapDefaultEndpoints();
app.MapearDocumentacao();

app.UseAuthentication();
app.UseAuthorization();

app.MapearParlamentares()
   .MapearPanorama()
   .MapearGoverno()
   .MapearMetodologia()
   .MapearAcesso()
   .MapearMapa()
   .MapearEntidades()
   .MapearAfinidade()
   .MapearAutenticacao()
   .MapearSeguir()
   .MapearGrafo()
   .MapearAvaliacao();

app.AvisarSeOLoginEstaDesligado();

app.Run();
