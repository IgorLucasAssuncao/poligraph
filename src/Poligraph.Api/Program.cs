using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Configuracao;
using Poligraph.Api.Endpoints;
using Poligraph.Data;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddOpenApi();

// 🔴 UseSnakeCaseNamingConvention não é estilo: o ETL Python lê estas mesmas tabelas.
// Removê-lo quebra o ETL sem erro de compilação.
builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes.UseSnakeCaseNamingConvention());

builder.AdicionarAutenticacao();
builder.Services.AdicionarServicos();

var app = builder.Build();

app.MapDefaultEndpoints();
app.MapearDocumentacao();

app.UseAuthentication();
app.UseAuthorization();

app.MapearParlamentares()
   .MapearPanorama()
   .MapearAfinidade()
   .MapearAutenticacao()
   .MapearSeguir()
   .MapearGrafo()
   .MapearNoticias()
   .MapearAvaliacao();

app.AvisarSeOLoginEstaDesligado();

app.Run();
