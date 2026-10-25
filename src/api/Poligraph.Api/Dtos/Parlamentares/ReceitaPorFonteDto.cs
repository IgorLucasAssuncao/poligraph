using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record ReceitaPorFonteDto(string Fonte, decimal Total, int Lancamentos);
