using System.Text.RegularExpressions;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static partial class EndpointsEntidades
{
    public static IEndpointRouteBuilder MapearEntidades(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/entidades", ListarAsync).WithTags("Entidades").Produces<PaginaDto<EntidadeNaListaDto>>();
        app.MapGet("/api/entidades/{cnpj}", ObterAsync)
           .WithTags("Entidades")
           .Produces<EntidadeDto>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/entidades/{cnpj}/parlamentares", ListarParlamentaresAsync)
           .WithTags("Entidades")
           .Produces<PaginaDto<ParlamentarQueMandouDto>>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/entidades/{cnpj}/convenios", ListarConveniosAsync)
           .WithTags("Entidades")
           .Produces<PaginaDto<ConvenioDaEntidadeDto>>()
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/busca", BuscarAsync).WithTags("Busca").Produces<BuscaDto>();

        return app;
    }

    /// <summary>Quem recebeu emenda, do maior ao menor, com filtro por grupo e por nome ou CNPJ.</summary>
    private static async Task<IResult> ListarAsync(
        ServicoEntidades servico, CancellationToken ct,
        string? busca = null, GrupoDeEntidade? grupo = null, int pagina = 1) =>
        Results.Ok(await servico.ListarAsync(busca, grupo, pagina, ct));

    /// <summary>A página de uma entidade. CNPJ fora do formato ou que não recebeu emenda: 404.</summary>
    private static async Task<IResult> ObterAsync(Cnpj cnpj, ServicoEntidades servico, CancellationToken ct) =>
        await servico.ObterAsync(cnpj, ct) is { } entidade
            ? Results.Ok(entidade)
            : Results.NotFound();

    private static async Task<IResult> ListarParlamentaresAsync(
        Cnpj cnpj, ServicoEntidades servico, CancellationToken ct, int pagina = 1) =>
        await servico.ListarParlamentaresAsync(cnpj, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();

    private static async Task<IResult> ListarConveniosAsync(
        Cnpj cnpj, ServicoEntidades servico, CancellationToken ct, int pagina = 1) =>
        await servico.ListarConveniosAsync(cnpj, pagina, ct) is { } lista
            ? Results.Ok(lista)
            : Results.NotFound();

    /// <summary>A busca do cabeçalho: parlamentares, cidades e entidades de uma vez.</summary>
    private static async Task<IResult> BuscarAsync(ServicoBusca servico, CancellationToken ct, string? q = null) =>
        Results.Ok(await servico.BuscarAsync(q, ct));
}
