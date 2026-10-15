using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>As gestões presidenciais que cobrem um período, para os atalhos do seletor de período.</summary>
/// <remarks>
/// <para>Orçamento, cartões, compras e viagens oferecem as mesmas gestões: comparar gestões medidas do mesmo jeito é o que mostra que a página não é sobre uma delas.</para>
/// </remarks>
public static class GestoesDoPeriodo
{
    /// <summary>As gestões que cobrem o período, mais de uma quando ele atravessa uma posse.</summary>
    public static async Task<IReadOnlyList<GestaoDto>> ListarAsync(PoligraphDb db, int primeiroAno, int ultimoAno, CancellationToken ct)
    {
        var gestoes = await db.Gestoes.AsNoTracking()
            .Where(g => g.PrimeiroAno <= ultimoAno && g.UltimoAno >= primeiroAno)
            .OrderBy(g => g.PrimeiroAno)
            .ToListAsync(ct);

        return [.. gestoes.Select(g => new GestaoDto(
            g.Eleicao, g.PrimeiroAno, g.UltimoAno,
            new PessoaDaGestaoDto(g.PresidenteNome, g.PresidenteNomeDeUrna, g.PresidentePartido),
            new PessoaDaGestaoDto(g.ViceNome, g.ViceNomeDeUrna, g.VicePartido),
            g.Coligacao))];
    }
}
