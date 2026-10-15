namespace Poligraph.Data;

/// <summary>
/// Um pagamento de emenda a quem o recebeu, somado por mês.
/// </summary>
/// <remarks>
/// <para>
/// Vem de <c>EmendasParlamentares_PorFavorecido.csv</c>, no download único do Portal da
/// Transparência. Liga à emenda pelo código, sem chave estrangeira: uma emenda ocupa
/// várias linhas em <c>emendas</c>, uma por localidade e ação, e o favorecido se refere à
/// emenda inteira. A carga grava os dois na mesma transação, e só aceita favorecido
/// de código que está na própria carga.
/// </para>
/// <para>
/// O Banco do Brasil recebe como intermediário: aparece em Brasília e repassa. Entra com
/// <see cref="Intermediario"/> ligado, para a geografia do dinheiro não o contar como
/// destino.
/// </para>
/// </remarks>
public class EmendaFavorecidoModel
{
    public long Id { get; set; }

    public required string CodigoEmenda { get; set; }

    /// <summary>O mês do pagamento, no primeiro dia.</summary>
    public DateOnly Competencia { get; set; }

    public TipoFavorecido Tipo { get; set; }

    /// <summary>CNPJ ou código da unidade gestora. Nulo para pessoa e sem informação.</summary>
    public string? Documento { get; set; }

    /// <summary>Nulo quando o tipo é pessoa: o nome não sai da fonte.</summary>
    public string? Nome { get; set; }

    public string? NaturezaJuridica { get; set; }

    public string? Uf { get; set; }

    public string? Municipio { get; set; }

    /// <summary>Negativo é estorno, e fica.</summary>
    public decimal Valor { get; set; }

    public bool Intermediario { get; set; }

    /// <summary>A carga de onde a linha saiu (Pendência 72). Nula nas linhas gravadas antes dela.</summary>
    public long? CargaId { get; set; }
}
