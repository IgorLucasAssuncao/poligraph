namespace Poligraph.Data;

/// <summary>
/// Encargos especiais num ano, por subfunção: dívida e transferências obrigatórias.
/// </summary>
/// <remarks>
/// <para>
/// A função 28 não é área de serviço e junta o que não se lê junto: rolar a dívida (841 e
/// 842), pagar juros e amortização (843 e 844), repassar a estados e municípios (845 e
/// 847). Somada, é 60% da dotação de 2023 a 2025 e esconde todo o resto. A subfunção
/// separa as três.
/// </para>
/// </remarks>
public class EncargoEspecialModel
{
    public short Ano { get; set; }

    public required string CodigoSubfuncao { get; set; }

    public required string Subfuncao { get; set; }

    public decimal DotacaoAtualizada { get; set; }

    public decimal Empenhado { get; set; }

    /// <summary>Pago no próprio ano.</summary>
    public decimal Pago { get; set; }

    /// <summary>Pago no ano por despesa empenhada em anos anteriores.</summary>
    public decimal RestosAPagarPagos { get; set; }

    /// <summary>O arquivo do Portal de onde veio a linha (Pendência 72), para o modo auditoria.</summary>
    public long? CargaId { get; set; }
}
