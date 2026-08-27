using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Api.Endpoints;

/// <summary>
/// ⚠️ **Duas posições, de propósito** (PL43). `EixoX`/`EixoY` vêm do layout de molas e
/// ⛔ não têm interpretação. `Componente1`/`Componente2` vêm do SVD e ⭐ têm: são a
/// direção em que os deputados mais se diferenciam. A tela escolhe qual desenhar.
/// </summary>
public record NoDoGrafo(
    long Id, string Nome, string Partido, string Uf,
    short? Comunidade, float? EixoX, float? EixoY, int NVotacoes,
    float? Componente1, float? Componente2);

public record ArestaDoGrafo(long De, long Para, float Peso);

public record Grafo(
    long ExecucaoId,
    string Casa,
    short Legislatura,
    IReadOnlyList<NoDoGrafo> Nos,
    IReadOnlyList<ArestaDoGrafo> Arestas);

public static class EndpointsGrafo
{
    public static IEndpointRouteBuilder MapearGrafo(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/grafo").WithTags("Grafo");

        grupo.MapGet("/", ObterAsync);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// RF-33 — o grafo da execução mais recente.
    ///
    /// ⚠️ Devolve TUDO de uma vez, e isso é decisão consciente: 644 nós e ~6.400
    /// arestas cabem em poucos MB, e o layout *force-directed* precisa do grafo
    /// inteiro para posicionar. Paginar aqui quebraria a visualização.
    /// </summary>
    private static async Task<IResult> ObterAsync(
        PoligraphDb db, CancellationToken ct, string casa = "CAMARA")
    {
        var execucao = await db.Execucoes.AsNoTracking()
            .Where(e => e.Casa == casa && e.Status == "CONCLUIDA")
            .OrderByDescending(e => e.Id)
            .Select(e => new { e.Id, e.Casa, e.Legislatura })
            .FirstOrDefaultAsync(ct);

        // ⭐ Primeiro dia, antes de o ETL analítico rodar: grafo vazio, não erro.
        if (execucao is null)
            return Results.Ok(new Grafo(0, casa, 0, [], []));

        var nos = await NosAsync(db, execucao.Id, ct);
        var arestas = await ArestasAsync(db, execucao.Id, ct);

        return Results.Ok(new Grafo(
            execucao.Id, execucao.Casa, execucao.Legislatura, nos, arestas));
    }

    private static async Task<List<NoDoGrafo>> NosAsync(
        PoligraphDb db, long execucaoId, CancellationToken ct)
    {
        var metricas = await db.NosMetrica.AsNoTracking()
            .Where(n => n.ExecucaoId == execucaoId)
            .ToListAsync(ct);

        var ids = metricas.Select(m => m.PessoaId).ToList();

        var pessoas = await db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                Ultimo = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(p => p.Id, ct);

        return [.. metricas.Select(m =>
        {
            var pessoa = pessoas.GetValueOrDefault(m.PessoaId);
            return new NoDoGrafo(
                m.PessoaId,
                pessoa?.NomeExibicao ?? "",
                pessoa?.Ultimo?.PartidoNoVoto ?? "",
                pessoa?.Ultimo?.UfNoVoto ?? "",
                m.Comunidade, m.EixoX, m.EixoY, m.NVotacoes,
                m.Componente1, m.Componente2);
        })];
    }

    /// <summary>
    /// ⚠️ Só arestas de `SIMILARIDADE_VOTO`.
    ///
    /// Os três tipos são CAMADAS de naturezas diferentes — comissão comum mede
    /// convivência, coautoria mede colaboração. Misturá-las num grafo só produziria
    /// um desenho sem interpretação.
    /// </summary>
    private static async Task<List<ArestaDoGrafo>> ArestasAsync(
        PoligraphDb db, long execucaoId, CancellationToken ct) =>
        await db.ArestasGrafo.AsNoTracking()
            .Where(a => a.ExecucaoId == execucaoId && a.Tipo == "SIMILARIDADE_VOTO")
            .Select(a => new ArestaDoGrafo(a.PessoaA, a.PessoaB, a.Peso))
            .ToListAsync(ct);
}
