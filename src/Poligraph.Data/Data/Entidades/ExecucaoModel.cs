namespace Poligraph.Data;

public class ExecucaoModel
{
    public long Id { get; set; }
    public TipoCasa Casa { get; set; }
    public short Legislatura { get; set; }

    /// <summary>k do kNN — 10 por decisão medida.</summary>
    public short K { get; set; }

    /// <summary>
    /// Abaixo disto o par de parlamentares não vira similaridade (RN-02). Gravado pelo ETL
    /// junto da execução, para a metodologia mostrar o valor que o cálculo usou.
    /// </summary>
    /// <remarks>
    /// <para>Nulo nas execuções anteriores a 2026-09-25, quando os parâmetros passaram a ser gravados.</para>
    /// </remarks>
    public short? MinimoVotacoesComuns { get; set; }

    /// <summary>Quanto pesa um ano a mais de distância: 0,86 é a correlação de posição medida entre anos.</summary>
    public double? RazaoRecencia { get; set; }

    /// <summary>Peso do voto em destaque, que é mérito de um trecho.</summary>
    public double? PesoDestaque { get; set; }

    /// <summary>Peso do voto em autoridade, que é voto em pessoa, e não em política.</summary>
    public double? PesoAutoridade { get; set; }

    public required string VersaoCarga { get; set; }
    public DateTimeOffset IniciadaEm { get; set; }
    public DateTimeOffset? ConcluidaEm { get; set; }
    public TipoStatusDaExecucao Status { get; set; }
}
