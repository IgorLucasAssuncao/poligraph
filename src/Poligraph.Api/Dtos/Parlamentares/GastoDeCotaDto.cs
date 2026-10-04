using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record GastoDeCotaDto(
    int AnoDaDespesa,
    decimal Total,
    int Lancamentos,
    IReadOnlyList<GastoPorCategoriaDto> PorCategoria,
    IReadOnlyList<FornecedorDoParlamentarDto> MaioresFornecedores);
