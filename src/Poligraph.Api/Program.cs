using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Configuracao;
using Poligraph.Api.Endpoints;
using Poligraph.Data;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddOpenApi();

builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => TempoDoRequest.ConfigurarBanco(opcoes));

builder.AdicionarAutenticacao();
builder.Services.AdicionarServicos();

var app = builder.Build();

app.UseTempoDoRequest();
app.UseResponseCompression();

app.MapDefaultEndpoints();
app.MapearDocumentacao();

app.UseAuthentication();
app.UseAuthorization();
app.UseCacheNoNavegador();

app.MapearParlamentares()
   .MapearPanorama()
   .MapearGoverno()
   .MapearMetodologia()
   .MapearAcesso()
   .MapearMapa()
   .MapearEntidades()
   .MapearPoliticos()
   .MapearAfinidade()
   .MapearAutenticacao()
   .MapearSeguir()
   .MapearAvisos()
   .MapearGrafo()
   .MapearAvaliacao()
   .MapearProcedencia()
   .MapearReconciliacao();

app.AvisarSeOLoginEstaDesligado();

app.Run();
