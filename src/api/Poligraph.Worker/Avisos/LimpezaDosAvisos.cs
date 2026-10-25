using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Worker;

/// <summary>
/// Apaga os avisos enviados, os eventos processados e os avisos de seguido encerrado que ninguém
/// fechou, com mais de 90 dias (Pendência 89).
/// </summary>
/// <remarks>
/// <para>DECISÃO: 90 dias é três vezes a janela de 30 que o avisador olha. Uma chave mais velha que isso não volta a ser calculada, então apagá-la não faz ninguém receber o mesmo aviso de novo; e o histórico de sobre quem a pessoa foi avisada, que é dado sensível, não fica para sempre.</para>
/// </remarks>
public class LimpezaDosAvisos(PoligraphDb db, ILogger<LimpezaDosAvisos> log)
{
    private readonly PoligraphDb _db = db;
    private readonly ILogger<LimpezaDosAvisos> _log = log;

    public const string Nome = "limpar-avisos";

    /// <summary>Todo dia, às 4h UTC, fora do horário das rotinas da ETL.</summary>
    public const string Frequencia = "0 4 * * *";

    public static readonly TimeSpan Guarda = TimeSpan.FromDays(90);

    public async Task LimparAsync(CancellationToken ct)
    {
        var limite = DateTimeOffset.UtcNow - Guarda;
        var avisos = await _db.AvisosEnviados.Where(a => a.EnviadoEm < limite).ExecuteDeleteAsync(ct);
        var eventos = await _db.Eventos.Where(e => e.ProcessadoEm != null && e.ProcessadoEm < limite).ExecuteDeleteAsync(ct);
        var encerrados = await _db.SeguidosEncerrados.Where(e => e.EncerradoEm < limite).ExecuteDeleteAsync(ct);

        if (_log.IsEnabled(LogLevel.Information))
        {
            _log.LogInformation(
                "Limpeza: {Avisos} aviso(s), {Eventos} evento(s) e {Encerrados} aviso(s) de seguido encerrado com mais de 90 dias.",
                avisos, eventos, encerrados);
        }
    }
}
