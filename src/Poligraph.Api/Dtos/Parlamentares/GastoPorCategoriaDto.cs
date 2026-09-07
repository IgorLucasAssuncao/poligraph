using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// ⚠️ Agregado, ⛔ não a lista de 200 mil linhas. A ficha responde "quanto e em quê",
/// e o documento fiscal fica a um clique na Câmara.
/// </summary>
public record GastoPorCategoriaDto(string Categoria, decimal Total, int Lancamentos);
