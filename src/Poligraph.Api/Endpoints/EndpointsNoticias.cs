using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Api.Endpoints;

public record NoticiaNaFichaDto(
    long Id, string Url, string Titulo, string Veiculo,
    DateTimeOffset PublicadaEm, string? Trecho);

public static class EndpointsNoticias
{
    /// <summary>
    /// 🔴 RF-40 — abaixo disto a associação existe no banco mas NÃO vai à tela.
    /// Notícia errada na página de quem a pessoa segue é falha visível.
    /// </summary>
    public const float ConfiancaMinima = 0.70f;

    private const int LimitePadrao = 10;

    public static IEndpointRouteBuilder MapearNoticias(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/parlamentares/{id:long}/noticias", ObterAsync)
           .Produces<IReadOnlyList<NoticiaNaFichaDto>>()
           .Produces(StatusCodes.Status404NotFound)
            .WithTags("Notícias");

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// RF-35 — notícias recentes do parlamentar.
    ///
    /// ⚠️ Lista vazia é resposta legítima e comum: parlamentar de baixo perfil pode
    /// passar semanas sem notícia. O front mostra estado vazio honesto (RF-47), não erro.
    /// </summary>
    private static async Task<IResult> ObterAsync(
        long id, PoligraphDb db, CancellationToken ct, int limite = LimitePadrao)
    {
        if (!await db.Pessoas.AnyAsync(p => p.Id == id, ct))
            return Results.NotFound();

        var noticias = await db.NoticiaPessoas.AsNoTracking()
            .Where(np => np.PessoaId == id && np.Confianca >= ConfiancaMinima)
            .OrderByDescending(np => np.Noticia!.PublicadaEm)
            .Take(Math.Clamp(limite, 1, 50))
            .Select(np => new NoticiaNaFichaDto(
                np.Noticia!.Id,
                np.Noticia.Url,
                np.Noticia.Titulo,
                np.Noticia.Veiculo,
                np.Noticia.PublicadaEm,
                np.Noticia.Trecho))
            .ToListAsync(ct);

        return Results.Ok(noticias);
    }
}
