namespace Poligraph.Data;

/// <summary>
/// As contas anuais de uma prefeitura, da Declaração de Contas Anuais (DCA) que o município entrega ao Tesouro pelo Siconfi (Pendência 90, fase 5).
/// </summary>
/// <remarks>
/// <para>Receita do Anexo I-C (receitas exceto intraorçamentárias); despesa do Anexo I-D (correntes mais capital).</para>
/// <para>RISCO: a DCA é declarada pelo próprio município. Município que não entregou o ano não tem linha, e a tela diz "sem declaração", nunca R$ 0.</para>
/// </remarks>
public class ContasDoMunicipioModel
{
    public required string CodigoIbge { get; set; }
    public short Ano { get; set; }

    /// <summary>Receitas brutas realizadas.</summary>
    public decimal ReceitaBruta { get; set; }

    /// <summary>Deduções da receita (FUNDEB e outras): a receita do município é a bruta menos estas.</summary>
    public decimal Deducoes { get; set; }

    public decimal DespesaEmpenhada { get; set; }
    public decimal DespesaPaga { get; set; }
    public long? CargaId { get; set; }
}
