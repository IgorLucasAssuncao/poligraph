using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsReconciliacao
{
    public static IEndpointRouteBuilder MapearReconciliacao(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/emendas/reconciliacao", ListarAsync)
           .WithTags("Reconciliacao")
           .Produces<IReadOnlyList<ReconciliacaoDto>>();

        return app;
    }

    /// <summary>Quanto o total de emendas da base fecha com o Portal, ano a ano, e o motivo do que fica fora.</summary>
    private static async Task<IResult> ListarAsync(int? de, int? ate, ServicoReconciliacao servico, CancellationToken ct) =>
        Results.Ok(await servico.ListarAsync(de, ate, ct));
}
