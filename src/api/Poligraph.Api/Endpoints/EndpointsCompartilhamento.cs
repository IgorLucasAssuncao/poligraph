using Poligraph.Api.Services;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsCompartilhamento
{
    public static IEndpointRouteBuilder MapearCompartilhamento(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/compartilhar/{idPessoa}", ObterAsync)
           .WithTags("Compartilhamento")
           .Produces<string>(StatusCodes.Status200OK, "text/html")
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/compartilhar/cidade/{codigoIbge}", ObterDaCidadeAsync)
           .WithTags("Compartilhamento")
           .Produces<string>(StatusCodes.Status200OK, "text/html")
           .Produces(StatusCodes.Status404NotFound);
        app.MapGet("/api/compartilhar/entidade/{cnpj}", ObterDaEntidadeAsync)
           .WithTags("Compartilhamento")
           .Produces<string>(StatusCodes.Status200OK, "text/html")
           .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>A página de prévia do link de compartilhar: nome e foto nas tags Open Graph, e o redirecionamento para a ficha. O nginx serve este endereço como <c>/p/{id}</c>.</summary>
    /// <remarks>
    /// <para>O host é o da requisição: em produção o <c>AllowedHosts</c> só aceita <c>registroaberto.org</c>, e o envenenamento de <c>Host</c> não passa. O protocolo é sempre https fora do <c>localhost</c>: o túnel da Cloudflare fala com o nginx em http, e o link sairia <c>http://</c>.</para>
    /// </remarks>
    private static async Task<IResult> ObterAsync(IdPessoa idPessoa, HttpRequest request, ServicoCompartilhamento servico, CancellationToken ct) =>
        Responder(await servico.ObterPaginaAsync(idPessoa, Origem(request), ct));

    /// <summary>A prévia da cidade; o nginx serve como <c>/c/{codigoIbge}</c>.</summary>
    private static async Task<IResult> ObterDaCidadeAsync(CodigoIbge codigoIbge, HttpRequest request, ServicoCompartilhamento servico, CancellationToken ct) =>
        Responder(await servico.ObterPaginaDaCidadeAsync(codigoIbge, Origem(request), ct));

    /// <summary>A prévia da entidade; o nginx serve como <c>/e/{cnpj}</c>.</summary>
    private static async Task<IResult> ObterDaEntidadeAsync(Cnpj cnpj, HttpRequest request, ServicoCompartilhamento servico, CancellationToken ct) =>
        Responder(await servico.ObterPaginaDaEntidadeAsync(cnpj, Origem(request), ct));

    private static string Origem(HttpRequest request) =>
        $"{(request.Host.Host == "localhost" ? request.Scheme : "https")}://{request.Host}";

    private static IResult Responder(string? pagina) =>
        pagina is null ? Results.NotFound() : Results.Content(pagina, "text/html; charset=utf-8");
}
