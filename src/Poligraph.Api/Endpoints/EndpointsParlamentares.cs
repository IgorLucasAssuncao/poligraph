using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsParlamentares
{
    public static IEndpointRouteBuilder MapearParlamentares(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/parlamentares").WithTags("Parlamentares");

        grupo.MapGet("/", ListarAsync)
             .Produces<PaginaDeParlamentaresDto>()
             .Produces(StatusCodes.Status404NotFound);

        grupo.MapGet("/{id}", ObterFichaAsync)
             .Produces<FichaParlamentarDto>()
             .Produces(StatusCodes.Status404NotFound);

        grupo.MapGet("/{id}/gastos", ObterGastosAsync)
             .Produces<GastoDeCotaDto>();

        grupo.MapGet("/{id}/votos", ListarVotosAsync)
             .Produces<PaginaDto<VotoNaFichaDto>>()
             .Produces(StatusCodes.Status404NotFound);

        grupo.MapGet("/{id}/emendas", ObterEmendasAsync)
             .Produces<EmendasDoParlamentarDto>();

        grupo.MapGet("/{id}/emendas/lista", ListarEmendasAsync)
             .Produces<PaginaDto<EmendaNaListaDto>>();

        grupo.MapGet("/{id}/gastos/lancamentos", ListarLancamentosAsync)
             .Produces<PaginaDto<LancamentoDaCotaDto>>();

        grupo.MapGet("/{id}/emendas/favorecidos", ListarFavorecidosAsync)
             .Produces<PaginaDto<FavorecidoDaEmendaDto>>();

        grupo.MapGet("/{id}/emendas/convenios", ListarConveniosAsync)
             .Produces<PaginaDto<ConvenioDaEmendaDto>>();

        grupo.MapGet("/{id}/financiamento", ObterFinanciamentoAsync)
             .Produces<FinanciamentoDeCampanhaDto>();

        grupo.MapGet("/{id}/patrimonio", ObterPatrimonioAsync)
             .Produces<PatrimonioDoParlamentarDto>()
             .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>RF-34 — busca por nome, partido e UF, em páginas. <c>pagina</c> começa em 1. Legislatura fora da base dá 404.</summary>
    private static async Task<IResult> ListarAsync(
        ServicoParlamentares servico,
        ServicoPanorama panorama,
        CancellationToken ct,
        string? nome = null,
        string? partido = null,
        Uf? uf = null,
        TipoCasa? casa = null,
        bool anteriores = false,
        Legislatura? legislatura = null,
        TipoOrdemDaLista ordem = TipoOrdemDaLista.NOME,
        int pagina = 1,
        int tamanho = ServicoParlamentares.TamanhoPadrao) =>
        await panorama.ExisteAsync(legislatura, ct)
            ? Results.Ok(await servico.ListarAsync(nome, partido, uf, casa, anteriores, legislatura, ordem, pagina, tamanho, ct))
            : Results.NotFound();

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    private static async Task<IResult> ObterFichaAsync(
        PessoaId id, ServicoParlamentares servico, CancellationToken ct, Legislatura? legislatura = null) =>
        await servico.ObterFichaAsync(id, legislatura, ct) is { } ficha
            ? Results.Ok(ficha)
            : Results.NotFound();

    private static async Task<IResult> ObterGastosAsync(
        PessoaId id, ServicoGastosDeCota servico, CancellationToken ct, Ano? ano = null, Legislatura? legislatura = null) =>
        Results.Ok(await servico.ObterAsync(id, ano, legislatura, ct));

    /// <summary>Os votos de uma legislatura da pessoa, do mais recente, em páginas. Sem legislatura, a última em que votou. <c>busca</c> filtra por descrição, ementa e matéria.</summary>
    private static async Task<IResult> ListarVotosAsync(
        PessoaId id, ServicoParlamentares servico, CancellationToken ct,
        int pagina = 1, int tamanho = ServicoParlamentares.VotosPorPagina, Legislatura? legislatura = null,
        string? busca = null, bool semRito = false) =>
        await servico.ListarVotosAsync(id, pagina, tamanho, legislatura, busca, semRito, ct) is { } votos
            ? Results.Ok(votos)
            : Results.NotFound();

    private static async Task<IResult> ObterEmendasAsync(
        PessoaId id, ServicoEmendas servico, CancellationToken ct, Ano? ano = null, Legislatura? legislatura = null) =>
        Results.Ok(await servico.ObterAsync(id, ano, legislatura, ct));

    /// <summary>As emendas do ano, uma a uma, com o link de cada uma no Portal.</summary>
    private static async Task<IResult> ListarEmendasAsync(
        PessoaId id, ServicoEmendas servico, CancellationToken ct,
        Ano? ano = null, int pagina = 1, int tamanho = ServicoEmendas.ItensPorPagina) =>
        Results.Ok(await servico.ListarEmendasAsync(id, ano, pagina, tamanho, ct));

    /// <summary>Os lançamentos da cota no ano, com o documento fiscal de cada um.</summary>
    private static async Task<IResult> ListarLancamentosAsync(
        PessoaId id, ServicoGastosDeCota servico, CancellationToken ct,
        Ano? ano = null, int pagina = 1, int tamanho = ServicoGastosDeCota.LancamentosPorPagina) =>
        Results.Ok(await servico.ListarLancamentosAsync(id, ano, pagina, tamanho, ct));

    /// <summary>Quem recebeu as emendas do ano, em páginas. A primeira é a da ficha.</summary>
    private static async Task<IResult> ListarFavorecidosAsync(
        PessoaId id, ServicoEmendas servico, CancellationToken ct,
        Ano? ano = null, int pagina = 1, int tamanho = ServicoEmendas.ItensPorPagina) =>
        Results.Ok(await servico.ListarFavorecidosAsync(id, ano, pagina, tamanho, ct));

    /// <summary>Os convênios das emendas do ano, em páginas. A primeira é a da ficha.</summary>
    private static async Task<IResult> ListarConveniosAsync(
        PessoaId id, ServicoEmendas servico, CancellationToken ct,
        Ano? ano = null, int pagina = 1, int tamanho = ServicoEmendas.ItensPorPagina) =>
        Results.Ok(await servico.ListarConveniosAsync(id, ano, pagina, tamanho, ct));

    private static async Task<IResult> ObterFinanciamentoAsync(
        PessoaId id, ServicoFinanciamento servico, CancellationToken ct, Ano? eleicao = null, Legislatura? legislatura = null) =>
        Results.Ok(await servico.ObterAsync(id, eleicao, legislatura, ct));

    /// <summary>PP3 — o patrimônio declarado ao TSE, por candidatura e tipo de bem.</summary>
    private static async Task<IResult> ObterPatrimonioAsync(PessoaId id, ServicoParlamentares servico, CancellationToken ct) =>
        await servico.PatrimonioAsync(id, ct) is { } patrimonio ? Results.Ok(patrimonio) : Results.NotFound();
}
