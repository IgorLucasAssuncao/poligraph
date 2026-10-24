namespace Poligraph.Api.Dtos;

/// <summary>
/// Quem entregou à campanha dinheiro dos dois fundos públicos, e quanto de cada um: em geral as direções do partido,
/// às vezes outra campanha. A soma das linhas fecha com <see cref="FinanciamentoDeCampanhaDto.FundoEspecial"/> e
/// <see cref="FinanciamentoDeCampanhaDto.FundoPartidario"/>.
/// </summary>
public record RepasseDosFundosDto(string Nome, decimal FundoEspecial, decimal FundoPartidario);
