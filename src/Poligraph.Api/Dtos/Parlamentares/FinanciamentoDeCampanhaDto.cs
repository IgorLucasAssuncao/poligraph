using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// O financiamento da campanha que elegeu o parlamentar.
///
/// <para>
/// 🔴 <b>Fundo Especial e Fundo Partidário ficam SEPARADOS.</b> O primeiro é o "fundão"
/// (FEFC, 2017), eleitoral; o segundo custeia o partido o ano inteiro. Somá-los é
/// defensável, mas é uma afirmação — e quem a fizer que a assine.
/// </para>
/// </summary>
public record FinanciamentoDeCampanhaDto(
    int AnoEleicao,
    decimal Total,
    decimal FundoEspecial,
    decimal FundoPartidario,
    IReadOnlyList<ReceitaPorFonteDto> PorFonte,
    IReadOnlyList<DoadorDoParlamentarDto> MaioresDoadores);
