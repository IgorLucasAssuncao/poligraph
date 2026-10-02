namespace Poligraph.Api.Dtos;

/// <summary>Uma empresa, entidade ou órgão público que recebeu dinheiro de emenda.</summary>
/// <remarks>
/// <para>
/// <see cref="Cnpj"/> é a chave da página da entidade, e só vem para quem tem uma: pessoa
/// jurídica de CNPJ válido, fora do empresário individual — o CNPJ dele é de uma pessoa.
/// Unidade gestora (código de 6 dígitos) e o resto vêm sem, e a tela não faz link.
/// </para>
/// <para>
/// <see cref="TambemNaCota"/> (PL74) é o que a cota do MESMO parlamentar pagou ao MESMO CNPJ,
/// nos anos de despesa do mandato que apresentou a emenda. Fato, sem adjetivo (RNF-16):
/// os maiores pares são companhias aéreas e de energia, que recebem de quase todo gabinete.
/// Nulo quando a cota não pagou nada a ele, ou quando não há CNPJ público.
/// </para>
/// </remarks>
public record FavorecidoDaEmendaDto(
    string Nome,
    string? NaturezaJuridica,
    string? Uf,
    string? Municipio,
    decimal Recebido,
    string? Cnpj = null,
    decimal? TambemNaCota = null)
{
    /// <summary>O CNPJ que pode sair: 14 dígitos e natureza que não seja de empresário individual.</summary>
    public static string? CnpjPublico(string? documento, string? natureza) =>
        documento is { Length: 14 } && documento.All(char.IsAsciiDigit)
            && natureza?.Contains("Individual", StringComparison.OrdinalIgnoreCase) != true
            ? documento
            : null;
}
