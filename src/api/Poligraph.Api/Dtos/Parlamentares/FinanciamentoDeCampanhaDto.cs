using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// O financiamento da campanha que elegeu o parlamentar.
///
/// <para>
/// <b>Fundo Especial e Fundo Partidário ficam SEPARADOS.</b> O primeiro é o "fundão"
/// (FEFC, 2017), eleitoral; o segundo custeia o partido o ano inteiro. Somá-los é
/// defensável, mas é uma afirmação — e quem a fizer que a assine.
/// </para>
/// <para>
/// <see cref="MaioresDoadores"/> conta todo o dinheiro, e o desenho de onde veio e para onde foi fecha com o total por
/// ela. A aba da campanha mostra os dois cortes que não se repetem: <see cref="RepassesDosFundos"/>, quem entregou o
/// dinheiro dos fundos, e <see cref="DoacoesForaDosFundos"/>, o resto. Lado a lado, a Direção Nacional dos doadores
/// parecia ser um dos fundos, ou dinheiro além deles (2026-10-24).
/// </para>
/// </summary>
public record FinanciamentoDeCampanhaDto(
    int AnoEleicao,
    decimal Total,
    decimal FundoEspecial,
    decimal FundoPartidario,
    IReadOnlyList<ReceitaPorFonteDto> PorFonte,
    IReadOnlyList<DoadorDoParlamentarDto> MaioresDoadores,
    IReadOnlyList<RepasseDosFundosDto> RepassesDosFundos,
    IReadOnlyList<DoadorDoParlamentarDto> DoacoesForaDosFundos);
