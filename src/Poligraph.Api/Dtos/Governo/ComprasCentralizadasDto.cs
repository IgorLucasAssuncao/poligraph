namespace Poligraph.Api.Dtos;

/// <summary>
/// O cartão de compras centralizadas (CPCC) no período: o cartão do governo federal usado em compras
/// centralizadas, como passagens. Fica ao lado do cartão corporativo e não se soma a ele.
/// </summary>
public record ComprasCentralizadasDto(decimal Total, int Transacoes, IReadOnlyList<CompraCentralizadaDoOrgaoDto> PorOrgao);

/// <summary>Um órgão superior no período.</summary>
public record CompraCentralizadaDoOrgaoDto(string Orgao, decimal Valor, int Transacoes);
