using Hangfire;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Worker;

/// <summary>
/// O job recorrente (Pendência 89): pega os eventos pendentes da ETL e abre um job de aviso por
/// pessoa inscrita. Roda a cada 10 minutos e quase sempre termina sem achar nada.
/// </summary>
/// <remarks>
/// <para>DECISÃO: um job por pessoa, e não um envio em lote. Com várias cópias do worker, as pessoas se dividem entre elas; uma pessoa cujo navegador falha é tentada de novo sozinha, sem repetir as outras.</para>
/// <para><c>FOR UPDATE SKIP LOCKED</c>: se duas cópias rodarem ao mesmo tempo, a segunda pula os eventos que a primeira travou. O Hangfire já impede duas execuções do mesmo recorrente; a trava no banco é a segunda garantia, e é a que vale se alguém disparar o job à mão.</para>
/// </remarks>
public class DistribuidorDeAvisos(PoligraphDb db, IBackgroundJobClient jobs, ILogger<DistribuidorDeAvisos> log)
{
    private readonly PoligraphDb _db = db;
    private readonly IBackgroundJobClient _jobs = jobs;
    private readonly ILogger<DistribuidorDeAvisos> _log = log;

    /// <summary>O nome do job recorrente no Hangfire.</summary>
    public const string Nome = "distribuir-avisos";

    /// <summary>A cada 10 minutos: a consulta é um índice parcial, e o aviso sai pouco depois da rotina.</summary>
    public const string Frequencia = "*/10 * * * *";

    [DisableConcurrentExecution(timeoutInSeconds: 600)]
    public async Task DistribuirAsync(CancellationToken ct)
    {
        await using var transacao = await _db.Database.BeginTransactionAsync(ct);
        var pendentes = await _db.Eventos
            .FromSql($"SELECT * FROM eventos WHERE processado_em IS NULL ORDER BY id FOR UPDATE SKIP LOCKED")
            .ToListAsync(ct);
        if (pendentes.Count == 0)
        {
            await transacao.CommitAsync(ct);
            return;
        }

        var usuarios = await _db.InscricoesNoNavegador
            .Select(i => i.UsuarioId)
            .Distinct()
            .Where(id => _db.Segue.Any(s => s.UsuarioId == id)
                && _db.Consentimentos.Any(c => c.UsuarioId == id
                    && c.Finalidade == TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR && c.RevogadoEm == null))
            .ToListAsync(ct);

        foreach (var idUsuario in usuarios)
        {
            _jobs.Enqueue<AvisadorDoUsuario>(a => a.AvisarAsync(idUsuario, CancellationToken.None));
        }

        var agora = DateTimeOffset.UtcNow;
        pendentes.ForEach(e => e.ProcessadoEm = agora);
        await _db.SaveChangesAsync(ct);
        await transacao.CommitAsync(ct);

        if (_log.IsEnabled(LogLevel.Information))
        {
            _log.LogInformation(
                "Eventos {Eventos} distribuídos: {Usuarios} pessoa(s) com navegador inscrito.",
                string.Join(", ", pendentes.Select(e => $"{e.Id} ({e.Tipo})")), usuarios.Count);
        }
    }
}
