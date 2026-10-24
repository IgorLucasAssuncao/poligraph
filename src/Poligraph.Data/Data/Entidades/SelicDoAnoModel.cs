namespace Poligraph.Data;

/// <summary>
/// A taxa Selic acumulada num ano, da série 4390 do Banco Central (Selic acumulada no mês).
/// </summary>
/// <remarks>
/// <para>
/// A taxa do ano é a dos meses capitalizada: (1 + mês₁) × (1 + mês₂) × … − 1. No ano em andamento, <see cref="Meses"/>
/// diz até onde ela vai.
/// </para>
/// </remarks>
public class SelicDoAnoModel
{
    public short Ano { get; set; }

    /// <summary>Em porcentagem: 10,5 é 10,5% no ano.</summary>
    public decimal TaxaNoAno { get; set; }

    /// <summary>Quantos meses o Banco Central já publicou no ano.</summary>
    public short Meses { get; set; }

    /// <summary>A consulta à série de onde veio a linha, para o modo auditoria.</summary>
    public long? CargaId { get; set; }
}
