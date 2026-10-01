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
    /// <para>Desligado por padrão: a RNF-17 restringe o acesso durante o período eleitoral de 2026. Liga-se com <c>Acesso:LeituraPublica = true</c> depois da eleição, sem mudar código. O questionário e "seguir" continuam pedindo conta.</para>
    /// </remarks>
    private static IResult Obter(IConfiguration configuracao) =>
        Results.Ok(new AcessoDto(configuracao.GetValue("Acesso:LeituraPublica", false)));
}
