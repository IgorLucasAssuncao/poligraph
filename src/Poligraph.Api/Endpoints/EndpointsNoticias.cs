using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsNoticias
{
    /// <summary>
    /// RF-40 — abaixo disto a associação existe no banco mas NÃO vai à tela.
    /// Notícia errada na página de quem a pessoa segue é falha visível.
    /// </summary>
    public const float ConfiancaMinima = 0.70f;

    private const int TamanhoPadrao = 10;
    private const int TamanhoMaximo = 50;

    public static IEndpointRouteBuilder MapearNoticias(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/parlamentares/{id:long}/noticias", ObterAsync)
           .Produces<PaginaDto<NoticiaNaFichaDto>>()
           .Produces(StatusCodes.Status404NotFound)
            .WithTags("Notícias");

        return app;
    }

    /// <summary>
    /// RF-35 — notícias recentes do parlamentar, em páginas.
    ///
    /// Lista vazia é resposta legítima e comum: parlamentar de baixo perfil pode
    /// passar semanas sem notícia. O front mostra estado vazio honesto (RF-47), não erro.
    /// </summary>
    private static async Task<IResult> ObterAsync(
        long id, PoligraphDb db, CancellationToken ct,
        int pagina = 1, int tamanho = TamanhoPadrao)
    {
        if (!await db.Pessoas.AnyAsync(p => p.Id == id, ct))
            return Results.NotFound();

        pagina = Math.Max(pagina, 1);
        tamanho = Math.Clamp(tamanho, 1, TamanhoMaximo);

        var doParlamentar = db.NoticiaPessoas.AsNoTracking()
            .Where(np => np.PessoaId == id && np.Confianca >= ConfiancaMinima);

        var noticias = await doParlamentar
            .OrderByDescending(np => np.Noticia!.PublicadaEm)
            .ThenByDescending(np => np.NoticiaId)
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .Select(np => new NoticiaNaFichaDto(
                np.Noticia!.Id,
                np.Noticia.Url,
                np.Noticia.Titulo,
                np.Noticia.Veiculo,
                np.Noticia.PublicadaEm,
                np.Noticia.Trecho))
            .ToListAsync(ct);

        return Results.Ok(new PaginaDto<NoticiaNaFichaDto>(
            noticias, pagina, tamanho, await doParlamentar.CountAsync(ct)));
    }
}
