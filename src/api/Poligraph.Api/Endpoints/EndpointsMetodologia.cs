using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsMetodologia
{
    public static IEndpointRouteBuilder MapearMetodologia(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/metodologia", ObterAsync)
           .WithTags("Metodologia")
           .Produces<MetodologiaDto>();

        return app;
    }

    /// <summary>Os parâmetros do método, para a página "Como calculamos".</summary>
    private static async Task<IResult> ObterAsync(ServicoMetodologia servico, CancellationToken ct) =>
        Results.Ok(await servico.ObterAsync(ct));
}
