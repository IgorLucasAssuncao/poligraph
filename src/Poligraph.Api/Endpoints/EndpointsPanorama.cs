using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsPanorama
{
    public static IEndpointRouteBuilder MapearPanorama(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/panorama", ObterAsync)
           .WithTags("Panorama")
           .Produces<PanoramaDto>()
           .Produces(StatusCodes.Status404NotFound);

        app.MapGet("/api/legislaturas", ListarLegislaturasAsync)
           .WithTags("Panorama")
           .Produces<IReadOnlyList<LegislaturaDto>>();

        return app;
    }

    /// <summary>RF-33 — os números da base de uma legislatura; sem ela, a corrente.</summary>
    private static async Task<IResult> ObterAsync(
        ServicoPanorama servico, CancellationToken ct, Legislatura? legislatura = null) =>
        await servico.ExisteAsync(legislatura, ct)
            ? Results.Ok(await servico.ObterAsync(legislatura, ct))
            : Results.NotFound();

    /// <summary>As legislaturas da base, para o seletor do site.</summary>
    private static async Task<IResult> ListarLegislaturasAsync(
        ServicoPanorama servico, CancellationToken ct) =>
        Results.Ok(await servico.LegislaturasAsync(ct));
}
