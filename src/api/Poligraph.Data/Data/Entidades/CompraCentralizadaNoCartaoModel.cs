namespace Poligraph.Data;

/// <summary>
/// O que um órgão superior gastou no Cartão de Pagamento de Compras Centralizadas (CPCC) num mês.
/// </summary>
/// <remarks>
/// <para>Fonte: <c>download-de-dados/cpcc/AAAAMM</c>. É o cartão do governo federal usado em compras centralizadas, como passagens; fica ao lado do cartão corporativo e não se soma a ele.</para>
/// <para>RISCO: o arquivo traz o CPF do favorecido pessoa física sem máscara. Só o órgão, o mês e o valor são lidos.</para>
/// </remarks>
public class CompraCentralizadaNoCartaoModel
{
    public short Ano { get; set; }

    public short Mes { get; set; }

    public required string OrgaoSuperior { get; set; }

    public decimal Valor { get; set; }

    public int Transacoes { get; set; }

    public long? CargaId { get; set; }
}
