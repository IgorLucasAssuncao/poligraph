using Poligraph.Api.Dtos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsAcesso
{
    public static IEndpointRouteBuilder MapearAcesso(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/acesso", Obter)
           .WithTags("Acesso")
           .Produces<AcessoDto>();

        return app;
    }

    /// <summary>
    /// Se o site pode ser lido sem login.
    /// </summary>
    /// <remarks>
    /// <para>Ligado por padrão (decisão do autor, 2026-10-03, Pendência 65): o site se lê sem conta, e só seguir e a página da conta pedem login. A RNF-17 previa acesso restrito no período eleitoral de 2026; o autor decidiu publicar aberto. <c>Acesso:LeituraPublica = false</c> volta a exigir login, sem mudar código.</para>
    /// </remarks>
    private static IResult Obter(IConfiguration configuracao) =>
        Results.Ok(new AcessoDto(configuracao.GetValue("Acesso:LeituraPublica", true)));
}
