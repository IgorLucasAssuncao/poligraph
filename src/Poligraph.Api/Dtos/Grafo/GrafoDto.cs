using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <param name="VizinhosPorNo">
/// Quantas ligações cada parlamentar mantém: as mais fortes dele, gravadas pelo ETL em
/// <c>execucoes.k</c>. Vai junto para a tela explicar o desenho com o número que o
/// desenhou.
/// </param>
/// <param name="VotacoesDePlenario">
/// As votações de plenário da casa na legislatura, e quantas delas foram secretas. A tela
/// explica o desenho do Senado com elas: a matriz só usa as abertas.
/// </param>
/// <param name="LegislaturasComGrafo">
/// As legislaturas em que a casa tem grafo, da mais recente para a mais antiga. A que não
/// teve dado suficiente fica de fora, e a tela não a oferece.
/// </param>
public record GrafoDto(
    long ExecucaoId,
    TipoCasa Casa,
    short Legislatura,
    short VizinhosPorNo,
    IReadOnlyList<NoDoGrafoDto> Nos,
    IReadOnlyList<ArestaDoGrafoDto> Arestas,
    IReadOnlyList<short> LegislaturasComGrafo,
    int VotacoesDePlenario,
    int SecretasDePlenario);
