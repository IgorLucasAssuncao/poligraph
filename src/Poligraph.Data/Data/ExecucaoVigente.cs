using Microsoft.EntityFrameworkCore;

namespace Poligraph.Data;

/// <summary>
/// Qual execução do grafo vale para uma casa numa legislatura: a concluída mais recente
/// daquele par, e nenhuma outra.
/// </summary>
/// <remarks>
/// <para>PL54. A consulta existia repetida em cinco serviços, e duas cópias esqueciam um
/// dos filtros. Sem a casa, a ficha de deputado lia o grafo do Senado quando ele rodava por
/// último e mostrava zero parecidos. Sem a legislatura, analisar uma legislatura antiga
/// trocaria o grafo da página inicial.</para>
/// </remarks>
public static class ExecucaoVigente
{
    /// <summary>
    /// O id da execução, ou <c>null</c> quando a casa não tem grafo naquela legislatura:
    /// antes do primeiro ETL analítico, ou quando a legislatura não tinha dado suficiente.
    /// </summary>
    public static async Task<long?> IdAsync(
        PoligraphDb db, TipoCasa casa, short legislatura, CancellationToken ct) =>
        await DaCasa(db, casa, legislatura)
            .Select(execucao => (long?)execucao.Id)
            .FirstOrDefaultAsync(ct);

    /// <summary>A execução inteira, para quem precisa do <c>k</c> junto do id.</summary>
    public static Task<ExecucaoModel?> ObterAsync(
        PoligraphDb db, TipoCasa casa, short legislatura, CancellationToken ct) =>
        DaCasa(db, casa, legislatura).FirstOrDefaultAsync(ct);

    private static IQueryable<ExecucaoModel> DaCasa(PoligraphDb db, TipoCasa casa, short legislatura) =>
        db.Execucoes.AsNoTracking()
            .Where(execucao => execucao.Casa == casa
                            && execucao.Legislatura == legislatura
                            && execucao.Status == TipoStatusDaExecucao.CONCLUIDA)
            .OrderByDescending(execucao => execucao.Id);
}
