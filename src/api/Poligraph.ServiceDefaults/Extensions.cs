using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.ServiceDiscovery;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace Microsoft.Extensions.Hosting;

/// <summary>
/// Adds common Aspire services: service discovery, resilience, health checks, and OpenTelemetry.
/// This project should be referenced by each service project in your solution.
/// To learn more about using this project, see https://aka.ms/aspire/service-defaults
/// </summary>
public static class Extensions
{
    private const string HealthEndpointPath = "/health";
    private const string AlivenessEndpointPath = "/alive";
    private const string ComponentesEndpointPath = "/health/componentes";
    private static readonly JsonSerializerOptions _opcoesDoJson = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
    };

    /// <summary>A checagem que só diz que o processo responde: a do <c>/alive</c>.</summary>
    public const string TagDeVida = "live";

    /// <summary>
    /// A checagem de outro serviço (o worker, a rotina da ETL): sai do <c>/health</c> e fica só no
    /// <c>/health/componentes</c>, para o worker parado não marcar a API como fora do ar.
    /// </summary>
    public const string TagDeComponente = "componentes";

    public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.ConfigureOpenTelemetry();

        builder.AddDefaultHealthChecks();

        builder.Services.AddServiceDiscovery();

        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            http.AddStandardResilienceHandler();

            http.AddServiceDiscovery();
        });

        return builder;
    }

    public static TBuilder ConfigureOpenTelemetry<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .WithTracing(tracing =>
            {
                tracing.AddSource(builder.Environment.ApplicationName)
                    .AddAspNetCoreInstrumentation(tracing =>
                        tracing.Filter = context =>
                            !context.Request.Path.StartsWithSegments(HealthEndpointPath)
                            && !context.Request.Path.StartsWithSegments(AlivenessEndpointPath)
                    )
                    .AddHttpClientInstrumentation();
            });

        builder.AddOpenTelemetryExporters();

        return builder;
    }

    private static TBuilder AddOpenTelemetryExporters<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        var useOtlpExporter = !string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);

        if (useOtlpExporter)
        {
            builder.Services.AddOpenTelemetry().UseOtlpExporter();
        }

        return builder;
    }

    public static TBuilder AddDefaultHealthChecks<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), [TagDeVida]);

        return builder;
    }

    /// <summary>
    /// As três rotas de saúde: <c>/alive</c> (o processo responde), <c>/health</c> (a API e o banco, a que o
    /// Docker e o Coolify consultam) e <c>/health/componentes</c> (tudo, com o estado de cada checagem em JSON).
    /// </summary>
    /// <remarks>
    /// <para>DECISÃO (2026-10-24): mapeadas em todo ambiente, e não só no desenvolvimento como no modelo do Aspire.
    /// O nginx do site só repassa <c>/api/</c>, então elas não chegam à internet; quem as chama é o health check do
    /// container, de dentro dele, e quem está no servidor.</para>
    /// <para>O JSON dá o nome, o estado e a descrição de cada checagem, nunca a exceção: a mensagem de erro do
    /// banco pode trazer o endereço e o usuário da conexão.</para>
    /// </remarks>
    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        app.MapHealthChecks(HealthEndpointPath, new HealthCheckOptions
        {
            Predicate = r => !r.Tags.Contains(TagDeComponente)
        });

        app.MapHealthChecks(AlivenessEndpointPath, new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains(TagDeVida)
        });

        app.MapHealthChecks(ComponentesEndpointPath, new HealthCheckOptions
        {
            ResponseWriter = EscreverComponentesAsync
        });

        return app;
    }


    private static Task EscreverComponentesAsync(HttpContext contexto, HealthReport relatorio)
    {
        contexto.Response.ContentType = "application/json; charset=utf-8";
        var corpo = new
        {
            Status = relatorio.Status.ToString(),
            DuracaoMs = Math.Round(relatorio.TotalDuration.TotalMilliseconds),
            Checagens = relatorio.Entries.Select(e => new
            {
                Nome = e.Key,
                Status = e.Value.Status.ToString(),
                Descricao = e.Value.Description,
                DuracaoMs = Math.Round(e.Value.Duration.TotalMilliseconds)
            })
        };
        return contexto.Response.WriteAsync(JsonSerializer.Serialize(corpo, _opcoesDoJson));
    }
}
