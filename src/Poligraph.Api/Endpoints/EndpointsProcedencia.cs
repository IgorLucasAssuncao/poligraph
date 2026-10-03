using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Api.Endpoints;

public static class EndpointsProcedencia
{
    public static IEndpointRouteBuilder MapearProcedencia(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/procedencia/{contexto}", ObterAsync)
           .WithTags("Procedencia")
           .Produces<ProcedenciaDto>()
           .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>
    /// De onde veio um número e como foi contado, para o modo análise (Pendência 73). Contextos:
    /// votos, cota, emendas, campanha, patrimonio (com <c>pessoa</c>), painel (com <c>casa</c>), pagamentos
    /// (com <c>de</c> e <c>ate</c>) e entidade (com <c>cnpj</c>).
    /// </summary>
    private static async Task<IResult> ObterAsync(
        string contexto, long? pessoa, short? legislatura, int? ano, TipoCasa? casa, int? de, int? ate, string? cnpj,
        ServicoProcedencia servico, CancellationToken ct) =>
        await servico.ObterAsync(contexto, pessoa, legislatura, ano, casa, de, ate, cnpj, ct) is { } procedencia
            ? Results.Ok(procedencia)
            : Results.Problem(
                $"Contexto desconhecido ou sem o parâmetro dele. Contextos: {string.Join(", ", ServicoProcedencia.Contextos)}.",
                statusCode: StatusCodes.Status404NotFound);
}
