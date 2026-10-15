namespace Poligraph.Api.Dtos;

/// <summary>
/// Um lançamento da cota parlamentar, com o link do documento fiscal quando a casa o publica.
/// </summary>
/// <remarks>
/// <para><see cref="UrlDocumento"/> existe em 66% dos lançamentos (564.829 de 848.955, medido em 2026-09-25). O Senado não publica o documento.</para>
/// </remarks>
public record LancamentoDaCotaDto(
    DateOnly? Data,
    int Mes,
    string Categoria,
    string? Fornecedor,
    decimal Valor,
    string? UrlDocumento);
