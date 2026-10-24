using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using Poligraph.Api.Textos;
using Poligraph.Data;

namespace Poligraph.Api.Services.Saude;

/// <summary>
/// Se o worker dos avisos está de pé: o Hangfire grava a batida de cada servidor em <c>hangfire.server</c>,
/// e a API lê a mais recente no mesmo banco.
/// </summary>
/// <remarks>
/// <para>O worker não tem porta, então a API é quem diz por ele. Batida mais velha que o limite, ou a fila que
/// nem existe, é Degraded e não Unhealthy: o site funciona sem os avisos.</para>
/// </remarks>
public sealed class SaudeDoWorker(PoligraphDb db, TimeProvider relogio) : IHealthCheck
{
    private readonly PoligraphDb _db = db;
    private readonly TimeProvider _relogio = relogio;

    /// <summary>O Hangfire bate a cada 30 s; dois minutos sem batida é worker parado ou reiniciando.</summary>
    public static readonly TimeSpan LimiteSemBatida = TimeSpan.FromMinutes(2);

    private const string TabelaQueNaoExiste = "42P01";

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        DateTimeOffset? ultimaBatida;
        try
        {
            ultimaBatida = await _db.Database
                .SqlQueryRaw<DateTimeOffset?>("select max(lastheartbeat) as \"Value\" from hangfire.server")
                .SingleAsync(cancellationToken);
        }
        catch (PostgresException erro) when (erro.SqlState == TabelaQueNaoExiste)
        {
            return HealthCheckResult.Degraded(MensagensDaApi.SaudeWorkerSemFila);
        }

        if (ultimaBatida is null)
        {
            return HealthCheckResult.Degraded(MensagensDaApi.SaudeWorkerSemServidor);
        }

        var semBatida = _relogio.GetUtcNow() - ultimaBatida.Value;
        return semBatida <= LimiteSemBatida
            ? HealthCheckResult.Healthy(MensagensDaApi.SaudeWorkerDePe)
            : HealthCheckResult.Degraded(MensagensDaApi.SaudeWorkerParado(semBatida));
    }
}
