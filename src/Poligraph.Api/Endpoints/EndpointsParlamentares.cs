using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsParlamentares
{
    public static IEndpointRouteBuilder MapearParlamentares(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/parlamentares").WithTags("Parlamentares");

        grupo.MapGet("/", ListarAsync)
             .Produces<IReadOnlyList<ParlamentarNaListaDto>>();

        grupo.MapGet("/{id:long}", ObterFichaAsync)
             .Produces<FichaParlamentarDto>()
             .Produces(StatusCodes.Status404NotFound);

        grupo.MapGet("/{id:long}/gastos", ObterGastosAsync)
             .Produces<GastoDeCotaDto>();

        grupo.MapGet("/{id:long}/emendas", ObterEmendasAsync)
             .Produces<EmendasDoParlamentarDto>();

        grupo.MapGet("/{id:long}/financiamento", ObterFinanciamentoAsync)
             .Produces<FinanciamentoDeCampanhaDto>();

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>RF-34 — busca por nome, partido e UF.</summary>
    private static async Task<IResult> ListarAsync(
        ServicoParlamentares servico,
        CancellationToken ct,
        string? nome = null,
        string? partido = null,
        string? uf = null) =>
        Results.Ok(await servico.ListarAsync(nome, partido, uf, ct));

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    private static async Task<IResult> ObterFichaAsync(
        long id, ServicoParlamentares servico, CancellationToken ct) =>
        await servico.ObterFichaAsync(id, ct) is { } ficha
            ? Results.Ok(ficha)
            : Results.NotFound();

    private static async Task<IResult> ObterGastosAsync(
        long id, ServicoGastosDeCota servico, CancellationToken ct, int? ano = null) =>
        Results.Ok(await servico.ObterAsync(id, ano, ct));

    private static async Task<IResult> ObterEmendasAsync(
        long id, ServicoEmendas servico, CancellationToken ct, int? ano = null) =>
        Results.Ok(await servico.ObterAsync(id, ano, ct));

    private static async Task<IResult> ObterFinanciamentoAsync(
        long id, ServicoFinanciamento servico, CancellationToken ct, int? eleicao = null) =>
        Results.Ok(await servico.ObterAsync(id, eleicao, ct));
}
