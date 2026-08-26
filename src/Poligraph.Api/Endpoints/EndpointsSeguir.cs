using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Api.Endpoints;

public record ParlamentarSeguido(long PessoaId, string Nome, string Partido, string Uf);

/// <summary>
/// 🔴 Estes endpoints escrevem na tabela `segue`, que é REGISTRO DE CONVICÇÃO POLÍTICA
/// — dado sensível pela LGPD art. 5º, II.
///
/// Toda alteração aqui merece atenção extra: consentimento específico (RNF-12b) e o
/// endpoint de exclusão (art. 18) dependem do que esta tabela guarda.
/// </summary>
public static class EndpointsSeguir
{
    public static IEndpointRouteBuilder MapearSeguir(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/seguidos")
            .WithTags("Seguir")
            .RequireAuthorization();

        grupo.MapGet("/", ListarAsync);
        grupo.MapPut("/{pessoaId:long}", SeguirAsync);
        grupo.MapDelete("/{pessoaId:long}", DeixarDeSeguirAsync);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    private static async Task<IResult> ListarAsync(
        ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var id = EndpointsAutenticacao.IdDoUsuario(principal);

        var seguidos = await db.Segue.AsNoTracking()
            .Where(s => s.UsuarioId == id)
            .Select(s => new
            {
                s.PessoaId,
                s.Pessoa!.NomeExibicao,
                Ultimo = s.Pessoa.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        return Results.Ok(seguidos.Select(s => new ParlamentarSeguido(
            s.PessoaId, s.NomeExibicao,
            s.Ultimo?.PartidoNoVoto ?? "", s.Ultimo?.UfNoVoto ?? "")));
    }

    /// <summary>⭐ PUT e não POST: seguir duas vezes tem de ser o mesmo que seguir uma.</summary>
    private static async Task<IResult> SeguirAsync(
        long pessoaId, ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        if (!await db.Pessoas.AnyAsync(p => p.Id == pessoaId, ct))
            return Results.NotFound();

        var usuarioId = EndpointsAutenticacao.IdDoUsuario(principal);

        if (await db.Segue.AnyAsync(s => s.UsuarioId == usuarioId && s.PessoaId == pessoaId, ct))
            return Results.NoContent();   // idempotente

        db.Segue.Add(new Segue { UsuarioId = usuarioId, PessoaId = pessoaId });
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static async Task<IResult> DeixarDeSeguirAsync(
        long pessoaId, ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var usuarioId = EndpointsAutenticacao.IdDoUsuario(principal);

        await db.Segue
            .Where(s => s.UsuarioId == usuarioId && s.PessoaId == pessoaId)
            .ExecuteDeleteAsync(ct);

        return Results.NoContent();
    }
}
