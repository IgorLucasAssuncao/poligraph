using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

/// <summary>
/// Estes endpoints escrevem na tabela `segue`, que é REGISTRO DE CONVICÇÃO POLÍTICA
/// — dado sensível pela LGPD art. 5º, II.
///
/// Toda alteração aqui merece atenção extra: consentimento específico (RNF-12b) e o
/// endpoint de exclusão (art. 18) dependem do que esta tabela guarda.
/// </summary>
public static class EndpointsSeguir
{
    /// <summary>Quantas notícias o feed da página inicial traz.</summary>
    public const int NoticiasNoFeed = 30;

    public static IEndpointRouteBuilder MapearSeguir(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/seguidos")
            .WithTags("Seguir")
            .RequireAuthorization();

        grupo.MapGet("/", ListarAsync)
             .Produces<IReadOnlyList<ParlamentarSeguidoDto>>();
        grupo.MapGet("/noticias", NoticiasAsync)
             .Produces<IReadOnlyList<NoticiaDeSeguidoDto>>();
        grupo.MapPut("/{pessoaId:long}", SeguirAsync);
        grupo.MapDelete("/{pessoaId:long}", DeixarDeSeguirAsync);

        return app;
    }

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

    /// <summary>
    /// O feed da página inicial: as notícias mais recentes de quem o usuário segue, numa
    /// consulta só.
    /// </summary>
    /// <remarks>
    /// <para>A tela pedia as notícias de cada seguido, uma requisição por pessoa, e juntava no navegador. Com 30 seguidos eram 31 requisições a cada abertura da página inicial.</para>
    /// <para>O limiar de confiança é o mesmo da ficha (RF-40): a menção abaixo dele é gravada e não exibida.</para>
    /// <para>Uma notícia que cita dois seguidos aparece uma vez para cada um: o "porque você segue" é diferente nas duas.</para>
    /// </remarks>
    private static async Task<IResult> NoticiasAsync(
        ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var id = SessaoDoUsuario.IdDoUsuario(principal);

        var noticias = await db.NoticiaPessoas.AsNoTracking()
            .Where(np => np.Confianca >= EndpointsNoticias.ConfiancaMinima
                      && db.Segue.Any(s => s.UsuarioId == id && s.PessoaId == np.PessoaId))
            .OrderByDescending(np => np.Noticia!.PublicadaEm)
            .ThenByDescending(np => np.NoticiaId)
            .Take(NoticiasNoFeed)
            .Select(np => new NoticiaDeSeguidoDto(
                np.PessoaId,
                np.Pessoa!.NomeExibicao,
                np.Pessoa.UrlFoto,
                new NoticiaNaFichaDto(
                    np.Noticia!.Id, np.Noticia.Url, np.Noticia.Titulo,
                    np.Noticia.Veiculo, np.Noticia.PublicadaEm, np.Noticia.Trecho)))
            .ToListAsync(ct);

        return Results.Ok(noticias);
    }

    /// <summary> PUT e não POST: seguir duas vezes tem de ser o mesmo que seguir uma.</summary>
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
    /// Exclusão FÍSICA, e de propósito.
    ///
    /// `segue` é **registro de convicção política** — dado sensível pela LGPD
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
