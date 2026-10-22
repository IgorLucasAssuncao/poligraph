using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Endpoints;

public static class EndpointsPoliticos
{
    public static IEndpointRouteBuilder MapearPoliticos(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/politicos", ListarAsync).WithTags("Politicos").Produces<PaginaDto<PoliticoNaListaDto>>();

        return app;
    }

    /// <summary>Os eleitos do TSE, com filtro por nome, nível, cargo, UF e município (código do IBGE).</summary>
    private static async Task<IResult> ListarAsync(
        ServicoPoliticos servico, CancellationToken ct,
        string? busca = null, TipoNivel? nivel = null, TipoCargo? cargo = null, Uf? uf = null, CodigoIbge? municipio = null,
        int pagina = 1) =>
        Results.Ok(await servico.ListarAsync(new FiltroDePoliticos(busca, nivel, cargo, uf, municipio), pagina, ct));
}
