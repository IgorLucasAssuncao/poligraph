using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Api.Endpoints;

public static class EndpointsGrafo
{
    public static IEndpointRouteBuilder MapearGrafo(this IEndpointRouteBuilder app)
    {
        // A etiqueta era "GrafoDto" — nome de DTO vazando para a documentação da API.
        var grupo = app.MapGroup("/api/grafo").WithTags("Grafo");

        grupo.MapGet("/", ObterAsync)
             .Produces<GrafoDto>();

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>RF-33 — o grafo da execução mais recente da casa.</summary>
    private static async Task<IResult> ObterAsync(
        ServicoGrafo servico, CancellationToken ct, TipoCasa casa = TipoCasa.CAMARA) =>
        Results.Ok(await servico.ObterAsync(casa, ct));
}
