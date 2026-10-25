using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Poligraph.Api.Textos;
using Poligraph.Data;

namespace Poligraph.Api.Services.Saude;

/// <summary>
/// Se a carga da ETL está em dia: a rotina que passa por todas as etapas, inclusive o <c>conferir</c>, grava uma
/// linha em <c>eventos</c>, e a semanal roda toda segunda.
/// </summary>
/// <remarks>
/// <para>Degraded quando a última rotina passa do limite ou nenhuma terminou ainda: o site continua de pé, com o
/// dado da carga anterior. Carga feita à mão não grava evento e não conta.</para>
/// </remarks>
public sealed class SaudeDaRotina(PoligraphDb db, TimeProvider relogio) : IHealthCheck
{
    private readonly PoligraphDb _db = db;
    private readonly TimeProvider _relogio = relogio;

    /// <summary>Uma semana entre as semanais, mais um dia de folga para a que demora ou espera a mensal.</summary>
    public static readonly TimeSpan LimiteSemRotina = TimeSpan.FromDays(8);

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var ultima = await _db.Eventos.AsNoTracking()
            .OrderByDescending(e => e.CriadoEm)
            .Select(e => (DateTimeOffset?)e.CriadoEm)
            .FirstOrDefaultAsync(cancellationToken);

        if (ultima is null)
        {
            return HealthCheckResult.Degraded(MensagensDaApi.SaudeRotinaNenhuma);
        }

        var desde = _relogio.GetUtcNow() - ultima.Value;
        return desde <= LimiteSemRotina
            ? HealthCheckResult.Healthy(MensagensDaApi.SaudeRotinaEmDia(desde))
            : HealthCheckResult.Degraded(MensagensDaApi.SaudeRotinaAtrasada(desde));
    }
}
