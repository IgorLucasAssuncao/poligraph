using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsPanorama
{
    public static IEndpointRouteBuilder MapearPanorama(this IEndpointRouteBuilder app)
    {
        // 🔴 CT3 — `.Produces<T>()` ⛔ não é enfeite: sem ele o OpenAPI publica a rota
        //    com zero esquema de resposta.
        app.MapGet("/api/panorama", ObterAsync)
           .WithTags("Panorama")
           .Produces<PanoramaDto>();

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>RF-33 — os números da base, para a página inicial.</summary>
    private static async Task<IResult> ObterAsync(
        ServicoPanorama servico, CancellationToken ct) =>
        Results.Ok(await servico.ObterAsync(ct));
}
