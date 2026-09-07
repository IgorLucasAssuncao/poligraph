using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Endpoints;
using Poligraph.Data;

namespace Poligraph.Api.Configuracao;

/// <summary>
/// Cookie de sessão e persistência das chaves. Saiu do <c>Program.cs</c> porque eram 60
/// das 168 linhas dele — e nenhuma delas é sobre subir a aplicação.
/// </summary>
public static class ConfiguracaoDeAutenticacao
{
    public static WebApplicationBuilder AdicionarAutenticacao(this WebApplicationBuilder builder)
    {
// 🔴 Sem persistir as chaves, TODO redeploy desloga todo mundo — e o sintoma é péssimo
// de diagnosticar: funciona local, funciona em produção, e quebra sozinho depois de um
// deploy que não mexeu em autenticação. (PL30)
var pastaChaves = builder.Configuration["DataProtection:Pasta"];
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
        opcoes.Cookie.HttpOnly = true;              // ⭐ JavaScript não lê
        opcoes.Cookie.SameSite = SameSiteMode.Lax;
        opcoes.ExpireTimeSpan = TimeSpan.FromDays(7);
        opcoes.SlidingExpiration = true;
        opcoes.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest      // ⚠️ Always quebra em http://localhost
            : CookieSecurePolicy.Always;

        // 🔴 É uma API: responder 401/403, não redirecionar para uma tela que não existe.
        // Sem isto, chamada sem cookie devolve 302 e o front recebe HTML onde esperava
        // JSON — o bug de uma hora perdida.
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

        // ⭐ A 4ª conferência: a sessão foi revogada?
        opcoes.Events.OnValidatePrincipal = async contexto =>
        {
            var principal = contexto.Principal;
            var idBruto = principal?.FindFirst(EndpointsAutenticacao.ClaimUsuario)?.Value;
            var versaoBruta = principal?.FindFirst(EndpointsAutenticacao.ClaimSessao)?.Value;

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
