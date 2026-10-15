using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsGrafo
{
    public static IEndpointRouteBuilder MapearGrafo(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/grafo").WithTags("Grafo");

        grupo.MapGet("/", ObterAsync)
             .Produces<GrafoDto>();

        return app;
    }

    /// <summary>RF-33 — o grafo de uma casa numa legislatura; sem legislatura, a corrente.</summary>
    private static async Task<IResult> ObterAsync(
        ServicoGrafo servico, CancellationToken ct,
        TipoCasa casa = TipoCasa.CAMARA, Legislatura? legislatura = null) =>
        Results.Ok(await servico.ObterAsync(casa, legislatura, ct));
}
