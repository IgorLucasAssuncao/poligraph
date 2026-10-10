namespace Poligraph.Api.Dtos;

/// <summary>
/// O cartão de compras centralizadas (CPCC) no período: o cartão do governo federal usado em compras
/// centralizadas, como passagens. Fica ao lado do cartão corporativo e não se soma a ele.
/// </summary>
/// <remarks>
/// <para><see cref="MesesSemArquivo"/> são os meses do período, até o último com dado, que o Portal não publicou (<c>AAAA-MM</c>).</para>
/// </remarks>
public record ComprasCentralizadasDto(
    decimal Total,
    int Transacoes,
    IReadOnlyList<CompraCentralizadaDoOrgaoDto> PorOrgao,
    IReadOnlyList<string> MesesSemArquivo,
    IReadOnlyList<CompraCentralizadaNoAnoDto> PorAno);

/// <summary>Um ano do CPCC no período, e quantos meses dele o Portal publicou.</summary>
public record CompraCentralizadaNoAnoDto(int Ano, decimal Valor, int Meses);

/// <summary>Um órgão superior no período.</summary>
public record CompraCentralizadaDoOrgaoDto(string Orgao, decimal Valor, int Transacoes);
