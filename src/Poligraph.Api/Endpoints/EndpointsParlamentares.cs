using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsParlamentares
{
    public static IEndpointRouteBuilder MapearParlamentares(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/parlamentares").WithTags("Parlamentares");

        grupo.MapGet("/", ListarAsync)
             .Produces<PaginaDeParlamentaresDto>();

        grupo.MapGet("/{id:long}", ObterFichaAsync)
             .Produces<FichaParlamentarDto>()
             .Produces(StatusCodes.Status404NotFound);

        grupo.MapGet("/{id:long}/gastos", ObterGastosAsync)
             .Produces<GastoDeCotaDto>();

        grupo.MapGet("/{id:long}/votos", ListarVotosAsync)
             .Produces<PaginaDto<VotoNaFichaDto>>()
             .Produces(StatusCodes.Status404NotFound);

        grupo.MapGet("/{id:long}/emendas", ObterEmendasAsync)
             .Produces<EmendasDoParlamentarDto>();

        grupo.MapGet("/{id:long}/emendas/lista", ListarEmendasAsync)
             .Produces<PaginaDto<EmendaNaListaDto>>();

        grupo.MapGet("/{id:long}/gastos/lancamentos", ListarLancamentosAsync)
             .Produces<PaginaDto<LancamentoDaCotaDto>>();

        grupo.MapGet("/{id:long}/emendas/favorecidos", ListarFavorecidosAsync)
             .Produces<PaginaDto<FavorecidoDaEmendaDto>>();

        grupo.MapGet("/{id:long}/emendas/convenios", ListarConveniosAsync)
             .Produces<PaginaDto<ConvenioDaEmendaDto>>();

        grupo.MapGet("/{id:long}/financiamento", ObterFinanciamentoAsync)
             .Produces<FinanciamentoDeCampanhaDto>();

        grupo.MapGet("/{id:long}/patrimonio", ObterPatrimonioAsync)
             .Produces<PatrimonioDoParlamentarDto>()
             .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>RF-34 — busca por nome, partido e UF, em páginas. <c>pagina</c> começa em 1.</summary>
    private static async Task<IResult> ListarAsync(
        ServicoParlamentares servico,
        CancellationToken ct,
        string? nome = null,
        string? partido = null,
        string? uf = null,
        TipoCasa? casa = null,
        bool anteriores = false,
        TipoOrdemDaLista ordem = TipoOrdemDaLista.NOME,
        int pagina = 1,
        int tamanho = ServicoParlamentares.TamanhoPadrao) =>
        Results.Ok(await servico.ListarAsync(nome, partido, uf, casa, anteriores, ordem, pagina, tamanho, ct));

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    private static async Task<IResult> ObterFichaAsync(
        long id, ServicoParlamentares servico, CancellationToken ct, short? legislatura = null) =>
        await servico.ObterFichaAsync(id, legislatura, ct) is { } ficha
            ? Results.Ok(ficha)
            : Results.NotFound();

    private static async Task<IResult> ObterGastosAsync(
        long id, ServicoGastosDeCota servico, CancellationToken ct, int? ano = null) =>
        Results.Ok(await servico.ObterAsync(id, ano, ct));

    /// <summary>Os votos de uma legislatura da pessoa, do mais recente, em páginas. Sem legislatura, a última em que votou.</summary>
    private static async Task<IResult> ListarVotosAsync(
        long id, ServicoParlamentares servico, CancellationToken ct,
        int pagina = 1, int tamanho = ServicoParlamentares.VotosPorPagina, short? legislatura = null) =>
        await servico.ListarVotosAsync(id, pagina, tamanho, legislatura, ct) is { } votos
            ? Results.Ok(votos)
            : Results.NotFound();

    private static async Task<IResult> ObterEmendasAsync(
        long id, ServicoEmendas servico, CancellationToken ct, int? ano = null) =>
        Results.Ok(await servico.ObterAsync(id, ano, ct));

    /// <summary>As emendas do ano, uma a uma, com o link de cada uma no Portal.</summary>
    private static async Task<IResult> ListarEmendasAsync(
        long id, ServicoEmendas servico, CancellationToken ct,
        int? ano = null, int pagina = 1, int tamanho = ServicoEmendas.ItensPorPagina) =>
        Results.Ok(await servico.ListarEmendasAsync(id, ano, pagina, tamanho, ct));

    /// <summary>Os lançamentos da cota no ano, com o documento fiscal de cada um.</summary>
    private static async Task<IResult> ListarLancamentosAsync(
        long id, ServicoGastosDeCota servico, CancellationToken ct,
        int? ano = null, int pagina = 1, int tamanho = ServicoGastosDeCota.LancamentosPorPagina) =>
        Results.Ok(await servico.ListarLancamentosAsync(id, ano, pagina, tamanho, ct));

    /// <summary>Quem recebeu as emendas do ano, em páginas. A primeira é a da ficha.</summary>
    private static async Task<IResult> ListarFavorecidosAsync(
        long id, ServicoEmendas servico, CancellationToken ct,
        int? ano = null, int pagina = 1, int tamanho = ServicoEmendas.ItensPorPagina) =>
        Results.Ok(await servico.ListarFavorecidosAsync(id, ano, pagina, tamanho, ct));

    /// <summary>Os convênios das emendas do ano, em páginas. A primeira é a da ficha.</summary>
    private static async Task<IResult> ListarConveniosAsync(
        long id, ServicoEmendas servico, CancellationToken ct,
        int? ano = null, int pagina = 1, int tamanho = ServicoEmendas.ItensPorPagina) =>
        Results.Ok(await servico.ListarConveniosAsync(id, ano, pagina, tamanho, ct));

    private static async Task<IResult> ObterFinanciamentoAsync(
        long id, ServicoFinanciamento servico, CancellationToken ct, int? eleicao = null) =>
        Results.Ok(await servico.ObterAsync(id, eleicao, ct));

    /// <summary>PP3 — o patrimônio declarado ao TSE, por candidatura e tipo de bem.</summary>
    private static async Task<IResult> ObterPatrimonioAsync(long id, ServicoParlamentares servico, CancellationToken ct) =>
        await servico.PatrimonioAsync(id, ct) is { } patrimonio ? Results.Ok(patrimonio) : Results.NotFound();
}
