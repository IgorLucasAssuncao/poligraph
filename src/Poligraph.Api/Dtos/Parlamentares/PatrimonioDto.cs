namespace Poligraph.Api.Dtos;

/// <summary>
/// O patrimônio declarado ao TSE em cada candidatura, somado por tipo de bem.
/// </summary>
/// <remarks>
/// <para>
/// RISCO: Só tipo e valor: a descrição de cada bem traz endereço, e não está no banco. É o que o
/// candidato declarou, pelo valor que ele deu ao bem — não uma avaliação de mercado.
/// </para>
/// </remarks>
public record PatrimonioDoParlamentarDto(IReadOnlyList<DeclaracaoDeBensDto> Declaracoes);

/// <summary>Uma candidatura: o total e os tipos, do maior ao menor.</summary>
public record DeclaracaoDeBensDto(int AnoEleicao, decimal Total, int Bens, IReadOnlyList<BemPorTipoDto> PorTipo);

public record BemPorTipoDto(string Tipo, decimal Valor, int Quantidade);
