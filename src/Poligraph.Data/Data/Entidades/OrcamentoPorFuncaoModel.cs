namespace Poligraph.Data;

/// <summary>
/// A execução do orçamento federal num ano, por função (saúde, educação, defesa...).
/// </summary>
/// <remarks>
/// <para>
/// Vem de <c>orcamento-despesa/{ano}</c>, no Portal da Transparência: o único arquivo que
/// traz a dotação ao lado do empenhado e do pago.
/// </para>
/// <para>
/// <see cref="EmpenhadoAcimaDaDotacao"/> é o quanto se empenhou além da dotação publicada,
/// somado por unidade orçamentária e ação, que é onde a dotação é autorizada. Deveria ser
/// zero. Em 2025 soma R$ 228,6 bi, o valor que a lei orçamentária deixou condicionado à
/// regra de ouro: o arquivo publica a dotação sem essa parcela, e o empenho a usou. Onde
/// ele não é desprezível, a razão entre pago e dotação não pode ser mostrada.
/// </para>
/// </remarks>
public class OrcamentoPorFuncaoModel
{
    public short Ano { get; set; }

    public required string CodigoFuncao { get; set; }

    public required string Funcao { get; set; }

    public decimal DotacaoInicial { get; set; }

    public decimal DotacaoAtualizada { get; set; }

    public decimal Empenhado { get; set; }

    /// <summary>Pago no próprio ano. Resto a pagar quitado depois não entra.</summary>
    public decimal Pago { get; set; }

    /// <summary>
    /// Pago no ano por despesa empenhada em anos anteriores. Vem do arquivo mensal de
    /// execução: o de orçamento só traz o pago do próprio exercício.
    /// </summary>
    public decimal RestosAPagarPagos { get; set; }

    public decimal EmpenhadoAcimaDaDotacao { get; set; }

    /// <summary>A data em que o Portal gerou o arquivo. No ano corrente, é até onde vai o dado.</summary>
    public DateOnly GeradoEm { get; set; }
}
