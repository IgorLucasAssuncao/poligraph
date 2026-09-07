using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record GrafoDto(
    long ExecucaoId,
    TipoCasa Casa,
    short Legislatura,
    IReadOnlyList<NoDoGrafoDto> Nos,
    IReadOnlyList<ArestaDoGrafoDto> Arestas);
