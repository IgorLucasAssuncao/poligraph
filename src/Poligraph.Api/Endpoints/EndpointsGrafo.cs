using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Endpoints;


public static class EndpointsGrafo
{
    public static IEndpointRouteBuilder MapearGrafo(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/grafo").WithTags("GrafoDto");

        grupo.MapGet("/", ObterAsync)
             .Produces<GrafoDto>();

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
        PoligraphDb db, CancellationToken ct, Casa casa = Casa.CAMARA)
    {
        var execucao = await db.Execucoes.AsNoTracking()
            .Where(e => e.Casa == casa && e.Status == StatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => new { e.Id, e.Casa, e.Legislatura })
            .FirstOrDefaultAsync(ct);

        // ⭐ Primeiro dia, antes de o ETL analítico rodar: grafo vazio, não erro.
        if (execucao is null)
            return Results.Ok(new GrafoDto(0, casa, 0, [], []));

        var nos = await NosAsync(db, execucao.Id, ct);
        var arestas = await ArestasAsync(db, execucao.Id, ct);

        return Results.Ok(new GrafoDto(
            execucao.Id, execucao.Casa, execucao.Legislatura, nos, arestas));
    }

    private static async Task<List<NoDoGrafoDto>> NosAsync(
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
                p.UrlFoto,
                Ultimo = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(p => p.Id, ct);

        return [.. metricas.Select(m =>
        {
            var pessoa = pessoas.GetValueOrDefault(m.PessoaId);
            return new NoDoGrafoDto(
                m.PessoaId,
                pessoa?.NomeExibicao ?? "",
                pessoa?.Ultimo?.PartidoNoVoto ?? "",
                pessoa?.Ultimo?.UfNoVoto ?? "",
                m.Comunidade, m.EixoX, m.EixoY, m.NVotacoes,
                m.Componente1, m.Componente2, pessoa?.UrlFoto, m.Governismo);
        })];
    }

    /// <summary>
    /// ⚠️ Só arestas de `SIMILARIDADE_VOTO`.
    ///
    /// Os três tipos são CAMADAS de naturezas diferentes — comissão comum mede
    /// convivência, coautoria mede colaboração. Misturá-las num grafo só produziria
    /// um desenho sem interpretação.
    /// </summary>
    private static async Task<List<ArestaDoGrafoDto>> ArestasAsync(
        PoligraphDb db, long execucaoId, CancellationToken ct)
    {
        // ⚠️ A base e o cosseno vivem em `similaridades`, não em `arestas_grafo`. A
        //    junção acontece no banco: `similaridades` tem 185.908 linhas por métrica
        //    nesta execução, e trazê-las para a memória para casar aqui seria ler
        //    370 mil linhas a cada abertura da tela.
        var arestas =
            from a in db.ArestasGrafo.AsNoTracking()
            where a.ExecucaoId == execucaoId && a.Tipo == TipoDeAresta.SIMILARIDADE_VOTO

            join concordancia in db.Similaridades.AsNoTracking()
                    .Where(s => s.Metrica == Metrica.CONCORDANCIA)
                on new { a.ExecucaoId, a.PessoaA, a.PessoaB }
                equals new { concordancia.ExecucaoId, concordancia.PessoaA, concordancia.PessoaB }
                into porConcordancia
            from base_ in porConcordancia.DefaultIfEmpty()

            join cosseno in db.Similaridades.AsNoTracking()
                    .Where(s => s.Metrica == Metrica.COSSENO)
                on new { a.ExecucaoId, a.PessoaA, a.PessoaB }
                equals new { cosseno.ExecucaoId, cosseno.PessoaA, cosseno.PessoaB }
                into porCosseno
            from outra in porCosseno.DefaultIfEmpty()

            select new ArestaDoGrafoDto(
                a.PessoaA, a.PessoaB, a.Peso,
                // ⭐ `DefaultIfEmpty` porque o par sem linha de similaridade é bug, e o
                //    zero aparece na tela como "0 votações" em vez de derrubar a
                //    requisição inteira.
                base_ == null ? 0 : base_.NVotacoesComuns,
                outra == null ? null : outra.Valor);

        return await arestas.ToListAsync(ct);
    }
}
