using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <param name="VizinhosPorNo">
/// Quantas ligações cada parlamentar mantém: as mais fortes dele, gravadas pelo ETL em
/// <c>execucoes.k</c>. Vai junto para a tela explicar o desenho com o número que o
/// desenhou.
/// </param>
public record GrafoDto(
    long ExecucaoId,
    TipoCasa Casa,
    short Legislatura,
    short VizinhosPorNo,
    IReadOnlyList<NoDoGrafoDto> Nos,
    IReadOnlyList<ArestaDoGrafoDto> Arestas);
