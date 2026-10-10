using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsGoverno
{
    public static IEndpointRouteBuilder MapearGoverno(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/governo", ObterAsync)
           .WithTags("Governo")
           .Produces<GovernoDto>()
           .Produces(StatusCodes.Status404NotFound);

        app.MapGet("/api/governo/compras", ObterComprasAsync)
           .WithTags("Governo")
           .Produces<ComprasDoGovernoDto>()
           .Produces(StatusCodes.Status404NotFound);

        app.MapGet("/api/governo/viagens", ObterViagensAsync)
           .WithTags("Governo")
           .Produces<ViagensDoGovernoDto>()
           .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>O perfil do governo federal num período. Sem período, todos os anos; <c>ano</c> é atalho para um ano só.</summary>
    private static async Task<IResult> ObterAsync(
        ServicoGoverno servico, CancellationToken ct, Periodo<AnoDoOrcamento> periodoDoOrcamento) =>
        await servico.ObterAsync(periodoDoOrcamento, ct) is { } governo
            ? Results.Ok(governo)
            : Results.NotFound();

    /// <summary>Os contratos publicados pelo Executivo federal num período. Sem período, todos os anos.</summary>
    private static async Task<IResult> ObterComprasAsync(
        ServicoComprasDoGoverno servico, CancellationToken ct, Periodo<AnoDoOrcamento> periodoDaPublicacao) =>
        await servico.ObterAsync(periodoDaPublicacao, ct) is { } compras
            ? Results.Ok(compras)
            : Results.NotFound();

    /// <summary>As viagens a serviço do Executivo federal num período. Sem período, todos os anos.</summary>
    private static async Task<IResult> ObterViagensAsync(
        ServicoViagensDoGoverno servico, CancellationToken ct, Periodo<AnoDoOrcamento> periodoDaViagem) =>
        await servico.ObterAsync(periodoDaViagem, ct) is { } viagens
            ? Results.Ok(viagens)
            : Results.NotFound();
}
