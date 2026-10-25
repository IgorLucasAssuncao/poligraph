using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O último voto de cada pessoa de uma lista: a casa, o partido e a UF com que ela votou por último.
/// </summary>
/// <remarks>
/// <para>
/// RISCO: pela navegação (<c>p.Votos.OrderByDescending(...).FirstOrDefault()</c>), o EF numera todos os votos da base numa janela
/// e só depois filtra as pessoas. MEDIDO em 2026-10-24, banco local: 2,5 s por ficha nos "mais parecidos", e o mesmo em toda
/// leitura da lista de seguidos. Aqui o filtro das pessoas vem antes do agrupamento.
/// </para>
/// </remarks>
public static class UltimoVoto
{
    /// <summary>Pessoa → último voto. Com <paramref name="legislatura"/>, o último dentro dela. Quem não votou fica de fora.</summary>
    public static async Task<Dictionary<long, (TipoCasa Casa, string Partido, string Uf)>> DasPessoasAsync(
        PoligraphDb db, IReadOnlyCollection<long> ids, short? legislatura, CancellationToken ct)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        var ultimos = await db.Votos.AsNoTracking()
            .Where(v => ids.Contains(v.PessoaId) && (legislatura == null || v.Votacao!.Legislatura == legislatura))
            .GroupBy(v => v.PessoaId)
            .Select(g => g
                .OrderByDescending(v => v.Votacao!.Data)
                .Select(v => new { v.PessoaId, v.Votacao!.Casa, v.PartidoNoVoto, v.UfNoVoto })
                .First())
            .ToListAsync(ct);

        return ultimos.ToDictionary(u => u.PessoaId, u => (u.Casa, u.PartidoNoVoto, u.UfNoVoto));
    }
}
