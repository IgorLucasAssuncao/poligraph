namespace Poligraph.Data;

/// <summary>
/// A receita da União num ano, por categoria econômica e origem, como o Portal publica.
/// </summary>
/// <remarks>
/// <para>
/// Operação de crédito é receita de capital, e não arrecadação: é a emissão de títulos
/// da dívida. A tabela guarda as duas como vêm, e quem as separa é a API.
/// </para>
/// </remarks>
public class ReceitaPorOrigemModel
{
    public short Ano { get; set; }

    /// <summary>"Receitas Correntes", "Receitas de Capital" e as intra-orçamentárias.</summary>
    public required string Categoria { get; set; }

    /// <summary>"Contribuições", "Impostos, Taxas e Contribuições de Melhoria", "Operações de Crédito"...</summary>
    public required string Origem { get; set; }

    public decimal Prevista { get; set; }

    public decimal Realizada { get; set; }

    public DateOnly GeradoEm { get; set; }

    /// <summary>O arquivo do Portal de onde veio a linha (Pendência 72), para o modo auditoria.</summary>
    public long? CargaId { get; set; }
}
