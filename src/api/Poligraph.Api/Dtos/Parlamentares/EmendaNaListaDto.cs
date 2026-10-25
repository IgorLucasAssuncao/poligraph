namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma emenda do parlamentar, somadas as linhas dela, com o link da emenda no Portal.
/// </summary>
/// <remarks>
/// <para><see cref="Localidades"/> passa de 1 quando a emenda se reparte entre destinos: 55 emendas de 2023 a 2026.</para>
/// </remarks>
public record EmendaNaListaDto(
    string CodigoEmenda,
    string? Tipo,
    string? Localidade,
    int Localidades,
    string? Funcao,
    decimal Empenhado,
    decimal Pago,
    string UrlFonte);
