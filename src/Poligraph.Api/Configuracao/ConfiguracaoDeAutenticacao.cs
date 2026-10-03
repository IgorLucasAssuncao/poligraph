using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Endpoints;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Api.Textos;

namespace Poligraph.Api.Configuracao;

/// <summary>Cookie de sessão, chaves do Data Protection e autorização.</summary>
public static class ConfiguracaoDeAutenticacao
{
    /// <summary>
    /// Cookie de sessão assinado, chaves do Data Protection persistidas e autorização.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Sem persistir as chaves, todo redeploy desloga todo mundo, e o sintoma engana:
    /// funciona local, funciona em produção, e quebra sozinho depois de um deploy que
    /// não tocou em autenticação. (Pendência 30)
    /// </para>
    /// <para>
    /// Os dois <c>OnRedirect</c> respondem 401 e 403 em vez de redirecionar: é uma API,
    /// e sem eles uma chamada sem cookie devolve 302 com HTML onde o front espera JSON.
    /// </para>
    /// <para>
    /// <c>OnValidatePrincipal</c> é a quarta conferência do cookie: se
    /// <c>sessao_versao</c> não bate com a do banco, a sessão foi revogada.
    /// </para>
    /// </remarks>
    public static WebApplicationBuilder AdicionarAutenticacao(this WebApplicationBuilder builder)
    {
        var pastaChaves = builder.Configuration["DataProtection:Pasta"];
        if (builder.Environment.IsProduction() && string.IsNullOrWhiteSpace(pastaChaves))
        {
            throw new InvalidOperationException(
                MensagensDaApi.PastaDeChavesObrigatoria);
        }

        if (!string.IsNullOrWhiteSpace(pastaChaves))
        {
            builder.Services.AddDataProtection()
                .PersistKeysToFileSystem(new DirectoryInfo(pastaChaves))
                .SetApplicationName("poligraph");
        }

        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(opcoes =>
            {
                opcoes.Cookie.Name = "sid";
                opcoes.Cookie.HttpOnly = true;
                opcoes.Cookie.SameSite = SameSiteMode.Lax;
                opcoes.ExpireTimeSpan = TimeSpan.FromDays(7);
                opcoes.SlidingExpiration = true;
                opcoes.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;

                opcoes.Events.OnRedirectToLogin = c =>
                {
                    c.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                opcoes.Events.OnRedirectToAccessDenied = c =>
                {
                    c.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };

                opcoes.Events.OnValidatePrincipal = async contexto =>
                {
                    var principal = contexto.Principal;
                    var idBruto = principal?.FindFirst(SessaoDoUsuario.ClaimUsuario)?.Value;
                    var versaoBruta = principal?.FindFirst(SessaoDoUsuario.ClaimSessao)?.Value;

                    if (!long.TryParse(idBruto, out var id) || !short.TryParse(versaoBruta, out var versao))
                    {
                        contexto.RejectPrincipal();
                        return;
                    }

                    var db = contexto.HttpContext.RequestServices.GetRequiredService<PoligraphDb>();
                    var atual = await db.Usuarios.AsNoTracking()
                        .Where(u => u.Id == id)
                        .Select(u => (short?)u.SessaoVersao)
                        .FirstOrDefaultAsync();

                    if (atual != versao)
                    {
                        contexto.RejectPrincipal();
                        await contexto.HttpContext.SignOutAsync(
                            CookieAuthenticationDefaults.AuthenticationScheme);
                    }
                };
            });

        builder.Services.AddAuthorization();

        return builder;
    }
}
