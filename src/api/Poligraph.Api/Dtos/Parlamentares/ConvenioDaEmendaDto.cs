namespace Poligraph.Api.Dtos;

/// <summary>
/// Um convênio, com o valor do convênio inteiro.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Valor"/> não é a parte do parlamentar: o convênio pode receber emendas de
/// vários autores, e <see cref="EmendasQueFinanciam"/> diz quantas. Somar os valores
/// desta lista não dá o que o parlamentar destinou.
/// </para>
/// </remarks>
public record ConvenioDaEmendaDto(
    string Numero,
    string Convenente,
    string? Objeto,
    DateOnly DataPublicacao,
    decimal Valor,
    int EmendasQueFinanciam,
    string UrlFonte);
