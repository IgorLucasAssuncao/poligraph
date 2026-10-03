using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsMapa
{
    public static IEndpointRouteBuilder MapearMapa(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/mapa/emendas", ObterBrasilAsync).WithTags("Mapa").Produces<MapaDoBrasilDto>();
        app.MapGet("/api/mapa/emendas/{uf}", ObterEstadoAsync).WithTags("Mapa").Produces<MapaDoEstadoDto>();
        app.MapGet("/api/municipios", BuscarAsync).WithTags("Mapa").Produces<IReadOnlyList<MunicipioDto>>();
        app.MapGet("/api/municipios/{codigoIbge}/emendas", ObterMunicipioAsync)
           .WithTags("Mapa")
           .Produces<EmendasDoMunicipioDto>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/municipios/{codigoIbge}/emendas/parlamentares", ListarParlamentaresAsync)
           .WithTags("Mapa")
           .Produces<PaginaDto<ParlamentarQueMandouDto>>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/municipios/{codigoIbge}/emendas/convenios", ListarConveniosAsync)
           .WithTags("Mapa")
           .Produces<ConveniosDaCidadeDto>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/municipios/{codigoIbge}/emendas/favorecidos", ListarFavorecidosAsync)
           .WithTags("Mapa")
           .Produces<PaginaDto<FavorecidoDaEmendaDto>>()
           .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>O dinheiro de emenda por UF, pela sede de quem recebeu.</summary>
    private static async Task<IResult> ObterBrasilAsync(
        ServicoMapaDeEmendas servico, CancellationToken ct, int? de = null, int? ate = null) =>
        Results.Ok(await servico.ObterBrasilAsync(de, ate, ct));

    /// <summary>O dinheiro de emenda por município de uma UF.</summary>
    private static async Task<IResult> ObterEstadoAsync(
        string uf, ServicoMapaDeEmendas servico, CancellationToken ct, int? de = null, int? ate = null) =>
        Results.Ok(await servico.ObterEstadoAsync(uf, de, ate, ct));

    /// <summary>A busca "sua cidade". A escolha vira o código IBGE.</summary>
    private static async Task<IResult> BuscarAsync(
        ServicoMapaDeEmendas servico, CancellationToken ct, string? busca = null) =>
        Results.Ok(await servico.BuscarAsync(busca, ct));

    /// <summary>Quem mandou dinheiro de emenda para a cidade, e quem o recebeu lá.</summary>
    private static async Task<IResult> ObterMunicipioAsync(
        string codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, int? de = null, int? ate = null) =>
        await servico.ObterMunicipioAsync(codigoIbge, de, ate, ct) is { } municipio
            ? Results.Ok(municipio)
            : Results.NotFound();

    /// <summary>Os deputados e senadores que mandaram dinheiro para a cidade, em páginas.</summary>
    private static async Task<IResult> ListarParlamentaresAsync(
        string codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, int? de = null, int? ate = null, int pagina = 1) =>
        await servico.ListarParlamentaresAsync(codigoIbge, de, ate, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();

    /// <summary>Quem recebeu na cidade, em páginas.</summary>
    private static async Task<IResult> ListarFavorecidosAsync(
        string codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, int? de = null, int? ate = null, int pagina = 1) =>
        await servico.ListarFavorecidosAsync(codigoIbge, de, ate, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();

    /// <summary>Os convênios da cidade, em páginas: o que foi combinado e o que ainda falta liberar.</summary>
    private static async Task<IResult> ListarConveniosAsync(
        string codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, int? de = null, int? ate = null, int pagina = 1) =>
        await servico.ListarConveniosAsync(codigoIbge, de, ate, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();
}
