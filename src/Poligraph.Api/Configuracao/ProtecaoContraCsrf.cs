using Poligraph.Api.Textos;

namespace Poligraph.Api.Configuracao;

/// <summary>
/// Exige, nas rotas que mudam estado com a sessão, um cabeçalho que só o próprio site manda.
/// </summary>
/// <remarks>
/// <para>O cookie é <c>SameSite=Lax</c> e a API fica na mesma origem do site, o que já barra o POST, o PUT e o DELETE vindos de outro site. O cabeçalho fecha o que sobra (auditoria de 2026-10-03, OWASP A01): um formulário de outro site não consegue mandar cabeçalho próprio, e um script de outro site que tentasse esbarraria no CORS, que a API não libera.</para>
/// </remarks>
public static class ProtecaoContraCsrf
{
    /// <summary>O nome do cabeçalho.</summary>
    public const string Cabecalho = "X-Requested-With";

    /// <summary>O valor que o front manda.</summary>
    public const string Valor = "poligraph";

    /// <summary>Recusa com 403 o pedido que muda estado sem o cabeçalho. GET e HEAD passam.</summary>
    public static TBuilder ExigirCabecalhoDoSite<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (contexto, proximo) =>
        {
            var pedido = contexto.HttpContext.Request;
            if (HttpMethods.IsGet(pedido.Method) || HttpMethods.IsHead(pedido.Method))
            {
                return await proximo(contexto);
            }

            if (pedido.Headers[Cabecalho] != Valor)
            {
                return Results.Problem(MensagensDaApi.FaltaCabecalhoDoSite, statusCode: StatusCodes.Status403Forbidden);
            }

            return await proximo(contexto);
        });
}
