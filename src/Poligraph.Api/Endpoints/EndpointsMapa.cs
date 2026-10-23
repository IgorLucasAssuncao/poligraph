using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsMapa
{
    public static IEndpointRouteBuilder MapearMapa(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/mapa/emendas", ObterBrasilAsync).WithTags("Mapa").Produces<MapaDoBrasilDto>();
        app.MapGet("/api/mapa/emendas/caminhos", ObterCaminhosAsync).WithTags("Mapa").Produces<CaminhosDasEmendasDto>();
        app.MapGet("/api/mapa/emendas/{uf}", ObterEstadoAsync).WithTags("Mapa").Produces<MapaDoEstadoDto>();
        app.MapGet("/api/municipios", BuscarAsync).WithTags("Mapa").Produces<IReadOnlyList<MunicipioDto>>();
        app.MapGet("/api/municipios/{codigoIbge}/emendas", ObterMunicipioAsync)
           .WithTags("Mapa")
           .Produces<EmendasDoMunicipioDto>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/municipios/{codigoIbge}/gestoes", ObterGestoesAsync)
           .WithTags("Mapa")
           .Produces<GestoesDaCidadeDto>()
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
        ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas) =>
        Results.Ok(await servico.ObterBrasilAsync(periodoDasEmendas, ct));

    /// <summary>O pago em emendas pelos caminhos do dinheiro: tipo, área e quem recebeu. O gráfico de fitas da página de emendas.</summary>
    private static async Task<IResult> ObterCaminhosAsync(
        ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas) =>
        Results.Ok(await servico.ObterCaminhosAsync(periodoDasEmendas, ct));

    /// <summary>O dinheiro de emenda por município de uma UF.</summary>
    private static async Task<IResult> ObterEstadoAsync(
        Uf uf, ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas) =>
        Results.Ok(await servico.ObterEstadoAsync(uf, periodoDasEmendas, ct));

    /// <summary>A busca "sua cidade". A escolha vira o código IBGE.</summary>
    private static async Task<IResult> BuscarAsync(
        ServicoMapaDeEmendas servico, CancellationToken ct, string? busca = null) =>
        Results.Ok(await servico.BuscarAsync(busca, ct));

    /// <summary>Quem mandou dinheiro de emenda para a cidade, e quem o recebeu lá.</summary>
    private static async Task<IResult> ObterMunicipioAsync(
        CodigoIbge codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas) =>
        await servico.ObterMunicipioAsync(codigoIbge, periodoDasEmendas, ct) is { } municipio
            ? Results.Ok(municipio)
            : Results.NotFound();

    /// <summary>A página da cidade: prefeitos e governadores eleitos por gestão, e o pago em cada uma pelo ano do pagamento.</summary>
    private static async Task<IResult> ObterGestoesAsync(CodigoIbge codigoIbge, ServicoGestoesDaCidade servico, CancellationToken ct) =>
        await servico.ObterAsync(codigoIbge, ct) is { } gestoes ? Results.Ok(gestoes) : Results.NotFound();

    /// <summary>Os deputados e senadores que mandaram dinheiro para a cidade, em páginas.</summary>
    private static async Task<IResult> ListarParlamentaresAsync(
        CodigoIbge codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas, int pagina = 1) =>
        await servico.ListarParlamentaresAsync(codigoIbge, periodoDasEmendas, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();

    /// <summary>Quem recebeu na cidade, em páginas.</summary>
    private static async Task<IResult> ListarFavorecidosAsync(
        CodigoIbge codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas, int pagina = 1) =>
        await servico.ListarFavorecidosAsync(codigoIbge, periodoDasEmendas, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();

    /// <summary>Os convênios da cidade, em páginas: o que foi combinado e o que ainda falta liberar.</summary>
    private static async Task<IResult> ListarConveniosAsync(
        CodigoIbge codigoIbge, ServicoMapaDeEmendas servico, CancellationToken ct, Periodo<AnoDaEmenda> periodoDasEmendas, int pagina = 1) =>
        await servico.ListarConveniosAsync(codigoIbge, periodoDasEmendas, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();
}
