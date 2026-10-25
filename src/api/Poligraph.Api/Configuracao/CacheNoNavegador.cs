using Microsoft.AspNetCore.Authorization;
using Microsoft.Net.Http.Headers;

namespace Poligraph.Api.Configuracao;

/// <summary>
/// Deixa o navegador e a borda guardarem por alguns minutos a resposta das rotas que não exigem login.
/// </summary>
/// <remarks>
/// <para>DECISÃO (2026-10-10): o dado só muda quando a ETL roda, então cinco minutos de cache não mostram nada velho que importe, e quem volta a uma página não pede de novo.</para>
/// <para>RISCO: só rota que não exige login. Toda rota que lê o usuário (<c>seguidos</c>, <c>auth/eu</c>) exige login e fica de fora: guardada num cache compartilhado, como o da Cloudflare, a resposta de uma pessoa iria para outra.</para>
/// </remarks>
public static class CacheNoNavegador
{
    /// <summary>Quanto tempo a resposta vale no cache.</summary>
    public static readonly TimeSpan Duracao = TimeSpan.FromMinutes(5);

    /// <summary>Marca com <c>Cache-Control: public, max-age</c> as respostas 200 dos GET de <c>/api</c> sem login.</summary>
    public static IApplicationBuilder UseCacheNoNavegador(this IApplicationBuilder app) =>
        app.Use(async (http, proximo) =>
        {
            if (HttpMethods.IsGet(http.Request.Method) && http.Request.Path.StartsWithSegments("/api"))
            {
                http.Response.OnStarting(() =>
                {
                    if (PodeGuardar(http))
                    {
                        http.Response.Headers[HeaderNames.CacheControl] = $"public, max-age={(int)Duracao.TotalSeconds}";
                    }
                    return Task.CompletedTask;
                });
            }
            await proximo(http);
        });

    /// <summary>Resposta 200 de rota conhecida que não pede login.</summary>
    private static bool PodeGuardar(HttpContext http)
    {
        var rota = http.GetEndpoint();
        return http.Response.StatusCode == StatusCodes.Status200OK
            && rota is not null
            && rota.Metadata.GetMetadata<IAuthorizeData>() is null;
    }
}
