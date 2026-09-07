using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;


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

        grupo.MapGet("/", ListarAsync)
             .Produces<IReadOnlyList<ParlamentarSeguidoDto>>();
        grupo.MapPut("/{pessoaId:long}", SeguirAsync);
        grupo.MapDelete("/{pessoaId:long}", DeixarDeSeguirAsync);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    private static async Task<IResult> ListarAsync(
        ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var id = SessaoDoUsuario.IdDoUsuario(principal);

        var seguidos = await db.Segue.AsNoTracking()
            .Where(s => s.UsuarioId == id)
            .Select(s => new
            {
                s.PessoaId,
                s.Pessoa!.NomeExibicao,
                Ultimo = s.Pessoa.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.Votacao!.Casa, v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        return Results.Ok(seguidos.Select(s => new ParlamentarSeguidoDto(
            s.PessoaId, s.NomeExibicao, s.Ultimo?.Casa,
            s.Ultimo?.PartidoNoVoto ?? "", s.Ultimo?.UfNoVoto ?? "")));
    }

    /// <summary>⭐ PUT e não POST: seguir duas vezes tem de ser o mesmo que seguir uma.</summary>
    private static async Task<IResult> SeguirAsync(
        long pessoaId, ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        if (!await db.Pessoas.AnyAsync(p => p.Id == pessoaId, ct))
            return Results.NotFound();

        var usuarioId = SessaoDoUsuario.IdDoUsuario(principal);

        if (await db.Segue.AnyAsync(s => s.UsuarioId == usuarioId && s.PessoaId == pessoaId, ct))
            return Results.NoContent();   // idempotente

        db.Segue.Add(new SegueModel { UsuarioId = usuarioId, PessoaId = pessoaId });
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    /// <summary>
    /// 🔴 Exclusão FÍSICA, e de propósito.
    ///
    /// ⚠️ `segue` é **registro de convicção política** — dado sensível pela LGPD
    /// art. 5º, II. "Deixar de seguir" com exclusão lógica manteria no banco a
    /// informação de que a pessoa seguiu aquele parlamentar, que é exatamente o que ela
    /// pediu para desfazer. Ver a nota em `ExcluirContaAsync`.
    /// </summary>
    private static async Task<IResult> DeixarDeSeguirAsync(
        long pessoaId, ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var usuarioId = SessaoDoUsuario.IdDoUsuario(principal);

        await db.Segue
            .Where(s => s.UsuarioId == usuarioId && s.PessoaId == pessoaId)
            .ExecuteDeleteAsync(ct);

        return Results.NoContent();
    }
}
