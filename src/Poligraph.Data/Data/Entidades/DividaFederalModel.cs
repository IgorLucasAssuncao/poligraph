namespace Poligraph.Data;

/// <summary>
/// O que o governo federal pagou da dívida num ano, separado em juros, amortização e refinanciamento.
/// </summary>
/// <remarks>
/// <para>
/// Sai do mesmo arquivo anual do orçamento que <see cref="OrcamentoPorFuncaoModel"/>, pelo grupo de despesa: o 2 é juros e
/// encargos, o 6 é amortização e refinanciamento. Os elementos 76 e 77 do grupo 6 são o refinanciamento, a rolagem: título
/// novo que paga o velho, sem dinheiro de imposto.
/// </para>
/// <para>MEDIDO (2026-10-24): em 2025, R$ 354,3 bi de juros, R$ 353,6 bi de amortização e R$ 1,41 tri de refinanciamento.</para>
/// </remarks>
public class DividaFederalModel
{
    public short Ano { get; set; }

    /// <summary>Pago no ano no grupo 2: juros, deságios e encargos da dívida mobiliária e da contratual.</summary>
    public decimal JurosPagos { get; set; }

    /// <summary>Pago no ano no grupo 6, fora o refinanciamento: o principal resgatado.</summary>
    public decimal AmortizacaoPaga { get; set; }

    /// <summary>Pago no ano nos elementos 76 e 77: o principal refinanciado, a rolagem.</summary>
    public decimal RefinanciamentoPago { get; set; }

    /// <summary>A data de geração do arquivo do Portal; no ano em andamento, até onde ele vai.</summary>
    public DateOnly GeradoEm { get; set; }

    /// <summary>O arquivo do Portal de onde veio a linha, para o modo auditoria.</summary>
    public long? CargaId { get; set; }
}
