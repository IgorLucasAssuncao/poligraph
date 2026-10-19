using Microsoft.EntityFrameworkCore;

namespace Poligraph.Data;

/// <summary>
/// Quem está em exercício pela lista oficial de cada casa (tabela <c>em_exercicio</c>), para o
/// botão de seguir, a API e o worker que tira da lista de seguidos quem deixou o mandato.
/// </summary>
/// <remarks>
/// <para>DECISÃO do autor (2026-10-18): a lista oficial decide, e não "votou na legislatura corrente". Pelo voto, um reeleito que ainda não votou na legislatura nova pareceria fora do mandato.</para>
/// <para>RISCO: lista curta tiraria gente demais da lista de seguidos. Abaixo do mínimo de cada casa (o mesmo canário da ETL, <c>em_exercicio.MINIMO_POR_CASA</c>), a lista conta como não carregada: <see cref="IdsAsync"/> devolve nulo, e quem chama volta à regra do voto.</para>
/// </remarks>
public static class EmExercicioNaBase
{
    /// <summary>A Câmara tem 513 cadeiras; menos de 500 na lista é carga cortada.</summary>
    public const int MinimoDaCamara = 500;

    /// <summary>O Senado tem 81 cadeiras; menos de 78 na lista é carga cortada.</summary>
    public const int MinimoDoSenado = 78;

    /// <summary>Os ids das pessoas em exercício, ou <c>null</c> quando a lista ainda não foi carregada nas duas casas.</summary>
    public static async Task<HashSet<long>?> IdsAsync(PoligraphDb db, CancellationToken ct)
    {
        var linhas = await db.EmExercicio.AsNoTracking().Select(e => new { e.PessoaId, e.Casa }).ToListAsync(ct);
        var camara = linhas.Count(l => l.Casa == TipoCasa.CAMARA);
        var senado = linhas.Count(l => l.Casa == TipoCasa.SENADO);

        return camara >= MinimoDaCamara && senado >= MinimoDoSenado ? [.. linhas.Select(l => l.PessoaId)] : null;
    }
}
