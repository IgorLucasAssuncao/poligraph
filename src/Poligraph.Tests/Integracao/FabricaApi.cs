using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Poligraph.Api;
using Poligraph.Api.Configuracao;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Sobe a API de verdade, apontando para o Postgres do Testcontainers.
///
/// Substitui o `PoligraphDb` registrado pelo Aspire: em teste não há AppHost, e a
/// connection string vem do container. O resto do pipeline — endpoints, serialização,
/// status codes — é o mesmo de produção.
/// </summary>
public class FabricaApi(string connectionString) : WebApplicationFactory<MarcadorApi>
{
    private readonly string _connectionString = connectionString;

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureHostConfiguration(c => c.AddInMemoryCollection([new("Cache:Aquecer", "false")]));

        builder.ConfigureServices(services =>
        {
            RemoverRegistrosDoDbContext(services);

            services.AddDbContext<PoligraphDb>(opcoes => TempoDoRequest.ConfigurarBanco(opcoes.UseNpgsql(_connectionString)));
        });

        return base.CreateHost(builder);
    }

    /// <summary>Todo cliente de teste fala como o site: manda o cabeçalho que as rotas de escrita exigem.</summary>
    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add(Poligraph.Api.Configuracao.ProtecaoContraCsrf.Cabecalho, Poligraph.Api.Configuracao.ProtecaoContraCsrf.Valor);
    }


    /// <summary>
    /// Não basta remover `DbContextOptions` e `PoligraphDb`.
    ///
    /// O `AddNpgsqlDbContext` do Aspire registra o contexto em POOL — e o pool
    /// (`IDbContextPool`, `IScopedDbContextLease`) é singleton. Se ele sobrevive e o
    /// substituto é escopado, o container falha na validação: *"cannot consume scoped
    /// service from singleton"*. Por isso a varredura é por menção ao tipo, não por
    /// lista de serviços conhecidos.
    /// </summary>
    private static void RemoverRegistrosDoDbContext(IServiceCollection services)
    {
        var descritores = services
            .Where(d => MencionaOContexto(d.ServiceType)
                     || (d.ImplementationType is not null && MencionaOContexto(d.ImplementationType)))
            .ToList();

        foreach (var descritor in descritores)
        {
            services.Remove(descritor);
        }
    }

    private static bool MencionaOContexto(Type tipo)
    {
        if (tipo == typeof(PoligraphDb))
        {
            return true;
        }

        return tipo.IsGenericType
            && tipo.GetGenericArguments().Any(a => a == typeof(PoligraphDb));
    }
}
