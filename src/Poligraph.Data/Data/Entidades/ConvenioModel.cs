namespace Poligraph.Data;

/// <summary>
/// Um convênio financiado por emenda.
/// </summary>
/// <remarks>
/// <para>
/// O valor é o do convênio inteiro, e um convênio pode receber várias emendas: um deles,
/// de R$ 80 mi, aparece em 23. Por isso o convênio é entidade própria, e a ligação com a
/// emenda fica em <see cref="EmendaConvenioModel"/>. Somar o valor por emenda contaria o
/// mesmo dinheiro uma vez para cada uma.
/// </para>
/// </remarks>
public class ConvenioModel
{
    public required string Numero { get; set; }

    public required string Convenente { get; set; }

    public string? Objeto { get; set; }

    public DateOnly DataPublicacao { get; set; }

    public decimal Valor { get; set; }

    /// <summary>
    /// O CNPJ de quem assinou, do arquivo completo de convênios do Portal — o de emendas só
    /// traz o nome. É a chave forte que liga o convênio à página da entidade.
    /// </summary>
    /// <remarks>
    /// <para>Nulo até a carga <c>convenios</c> rodar, e para o convenente que não é pessoa jurídica.</para>
    /// </remarks>
    public string? CnpjConvenente { get; set; }

    /// <summary>"EM EXECUÇÃO", "CONCLUÍDO", "PRESTAÇÃO DE CONTAS EM ANÁLISE"… como o Portal publica.</summary>
    public string? Situacao { get; set; }

    /// <summary>Quanto do convênio o governo já transferiu. O valor é o combinado; o liberado, o que saiu.</summary>
    public decimal? ValorLiberado { get; set; }

    /// <summary>O arquivo de convênios do Portal que gravou a linha por último.</summary>
    public long? CargaId { get; set; }

    /// <summary>O arquivo de convênios do Portal de onde vieram o CNPJ do convenente, a situação e o valor liberado. A linha tem duas fontes: o resto vem do arquivo de emendas (<see cref="CargaId"/>).</summary>
    public long? ComplementoCargaId { get; set; }
}
