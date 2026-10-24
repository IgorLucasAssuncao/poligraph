using Microsoft.AspNetCore.HostFiltering;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Poligraph.Api.Services.Saude;

namespace Poligraph.Api.Configuracao;

/// <summary>
/// As checagens de saúde da API além das do Aspire. O banco já vem do <c>AddNpgsqlDbContext</c>, que registra a
/// checagem <c>PoligraphDb</c> sozinho; aqui entram o worker e a rotina da ETL, só no <c>/health/componentes</c>.
/// </summary>
public static class ConfiguracaoDeSaude
{
    /// <summary>O nome que o health check do container usa para chamar a API de dentro dela.</summary>
    public const string HostDoContainer = "localhost";

    /// <remarks>
    /// <para>ATENÇÃO: em produção, <c>AllowedHosts</c> só aceita o domínio do site, e o health check do container chama
    /// <c>http://localhost:8080/health</c>: sem o <c>localhost</c> na lista, a resposta seria 400 antes de chegar à rota.
    /// O nginx repassa o <c>Host</c> de quem acessou o site, então ninguém de fora chega com <c>localhost</c>.</para>
    /// <para>A lista é trocada inteira, e não acrescida: o ASP.NET a preenche com um array, num PostConfigure dele.</para>
    /// </remarks>
    public static IServiceCollection AdicionarSaude(this IServiceCollection servicos)
    {
        servicos.TryAddSingleton(TimeProvider.System);

        servicos.AddHealthChecks()
            .AddCheck<SaudeDoWorker>("worker", tags: [Extensions.TagDeComponente])
            .AddCheck<SaudeDaRotina>("rotina-da-etl", tags: [Extensions.TagDeComponente]);

        servicos.PostConfigure<HostFilteringOptions>(opcoes =>
        {
            if (opcoes.AllowedHosts.Count > 0 && !opcoes.AllowedHosts.Contains("*") && !opcoes.AllowedHosts.Contains(HostDoContainer))
            {
                opcoes.AllowedHosts = [.. opcoes.AllowedHosts, HostDoContainer];
            }
        });

        return servicos;
    }
}
