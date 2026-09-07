namespace Poligraph.Data;

public class ExecucaoModel
{
    public long Id { get; set; }
    public TipoCasa Casa { get; set; }
    public short Legislatura { get; set; }

    /// <summary>k do kNN — 10 por decisão medida.</summary>
    public short K { get; set; }

    public required string VersaoCarga { get; set; }
    public DateTimeOffset IniciadaEm { get; set; }
    public DateTimeOffset? ConcluidaEm { get; set; }
    public TipoStatusDaExecucao Status { get; set; }
}
