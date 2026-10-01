namespace Poligraph.Api.Dtos;

/// <summary>Quanto das emendas do ano foi pago num mês. <see cref="Mes"/> é o primeiro dia.</summary>
public record PagamentoPorMesDto(DateOnly Mes, decimal Valor);
