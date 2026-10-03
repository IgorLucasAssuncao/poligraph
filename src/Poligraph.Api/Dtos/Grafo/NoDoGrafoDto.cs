using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// **Duas posições, de propósito** (Pendência 43). `EixoX`/`EixoY` vêm do layout de molas e
/// não têm interpretação. `Componente1`/`Componente2` vêm do SVD e têm: são a
/// direção em que os deputados mais se diferenciam. A tela escolhe qual desenhar.
/// </summary>
public record NoDoGrafoDto(
    long Id, string Nome, string Partido, string Uf,
    short? Comunidade, float? EixoX, float? EixoY, int NVotacoes,
    float? Componente1, float? Componente2, string? UrlFoto,
    /// <summary>
    /// Vai junto para a LEGENDA ser derivada, não escrita à mão.
    ///
    /// <para>
    /// O sinal do eixo é arbitrário: a semente do layout é fixa, mas uma reexecução com
    /// dado novo pode espelhar a figura. Uma legenda que afirme "à esquerda ficam os
    /// governistas" ficaria errada em silêncio no dia em que isso acontecesse — e
    /// silêncio é justamente o modo de falha que este projeto persegue.
    /// </para>
    ///
    /// <para> Nulo no Senado, que não publica orientação de bancada.</para>
    /// </summary>
    float? Governismo);
