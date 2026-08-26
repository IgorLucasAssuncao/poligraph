using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Poligraph.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddOpenApi();

// 🔴 UseSnakeCaseNamingConvention não é estilo: o ETL Python lê estas mesmas tabelas.
// Removê-lo quebra o ETL sem erro de compilação.
builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes.UseSnakeCaseNamingConvention());

var app = builder.Build();

app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapearAfinidade();

app.Run();

/// <summary>
/// Marcador para o `WebApplicationFactory` dos testes de integração.
/// ⚠️ Não use `Program`: o projeto de migrations também tem um, no namespace global,
/// e a referência dupla no projeto de testes torna o nome ambíguo.
/// </summary>
public sealed class MarcadorApi;
