using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O cookie de sessão: o que ele carrega, como é emitido e como é lido.
///
/// <b>Nenhum token é armazenado</b> — nem o <c>id_token</c> do Google, nem sessão em
/// tabela. O cookie é assinado, e a identidade sai das duas claims abaixo.
/// </summary>
public static class SessaoDoUsuario
{
    public const string ClaimUsuario = "usuario_id";
    public const string ClaimSessao = "sessao_versao";

    /// <summary>
    /// Emite o cookie assinado. As claims são numéricas e lidas de volta por
    /// <see cref="IdDoUsuario"/> — daí o <c>InvariantCulture</c>.
    /// </summary>
    public static async Task EmitirAsync(HttpContext contexto, UsuarioModel usuario)
    {
        Claim[] claims =
        [
            new(ClaimUsuario, usuario.Id.ToString(CultureInfo.InvariantCulture)),
            new(ClaimSessao, usuario.SessaoVersao.ToString(CultureInfo.InvariantCulture))
        ];

        await contexto.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(
                claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    }

    public static Task EncerrarAsync(HttpContext contexto) =>
        contexto.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

    public static long IdDoUsuario(ClaimsPrincipal principal) =>
        long.Parse(principal.FindFirstValue(ClaimUsuario)!, CultureInfo.InvariantCulture);
}
