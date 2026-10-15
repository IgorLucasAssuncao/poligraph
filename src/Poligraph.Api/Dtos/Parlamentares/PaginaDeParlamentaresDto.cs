namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma página da lista de parlamentares, com o total e as opções dos filtros.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Partidos"/> e <see cref="Ufs"/> saem da lista inteira da legislatura, e não da
/// página: montados a partir do que a tela carregou, os filtros perdiam opções — e
/// escolher um partido esvaziava a lista de estados.
/// </para>
/// </remarks>
public record PaginaDeParlamentaresDto(
    IReadOnlyList<ParlamentarNaListaDto> Itens,
    int Pagina,
    int Tamanho,
    int Total,
    IReadOnlyList<string> Partidos,
    IReadOnlyList<string> Ufs,
    /// <summary>A legislatura corrente: quem tem outra em <c>Legislatura</c> já saiu.</summary>
    short? LegislaturaCorrente);
