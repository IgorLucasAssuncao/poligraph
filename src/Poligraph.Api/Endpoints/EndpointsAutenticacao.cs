using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public record RequisicaoLogin(string IdToken);

/// <summary>⛔ Não devolve e-mail: o front não precisa, e o que não trafega não vaza.</summary>
public record UsuarioLogado(string? Nome, string? FotoUrl);

public static class EndpointsAutenticacao
{
    public const string ClaimUsuario = "usuario_id";
    public const string ClaimSessao = "sessao_versao";

    public static IEndpointRouteBuilder MapearAutenticacao(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/auth").WithTags("Autenticação");

        grupo.MapPost("/google", EntrarAsync);
        grupo.MapPost("/logout", SairAsync);
        grupo.MapPost("/sair-de-todos", SairDeTodosAsync).RequireAuthorization();
        grupo.MapGet("/eu", QuemSouAsync).RequireAuthorization();
        grupo.MapDelete("/conta", ExcluirContaAsync).RequireAuthorization();

        return app;
    }

    // ═══════════════════════════════════════════════════════════════
    // PÚBLICOS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// O único lugar do sistema onde o `id_token` do Google aparece.
    /// ⭐ Ele é validado, usado e DESCARTADO — nunca vai ao banco.
    /// </summary>
    private static async Task<IResult> EntrarAsync(
        RequisicaoLogin requisicao,
        HttpContext contexto,
        IValidadorGoogle validador,
        PoligraphDb db,
        CancellationToken ct)
    {
        var perfil = await validador.ValidarAsync(requisicao.IdToken, ct);
        if (perfil is null) return Results.Unauthorized();

        var usuario = await SalvarPerfilAsync(db, perfil, ct);
        await EmitirCookieAsync(contexto, usuario);
        // ⬆️ o id_token morre aqui

        return Results.Ok(new UsuarioLogado(usuario.Nome, usuario.FotoUrl));
    }

    private static async Task<IResult> SairAsync(HttpContext contexto)
    {
        await contexto.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    /// <summary>
    /// ⭐ "Sair de todos os aparelhos" sem tabela de sessão: incrementar uma coluna
    /// invalida todos os cookies daquela pessoa, em todo lugar, na hora.
    /// </summary>
    private static async Task<IResult> SairDeTodosAsync(
        ClaimsPrincipal principal, HttpContext contexto, PoligraphDb db, CancellationToken ct)
    {
        var id = IdDoUsuario(principal);

        await db.Usuarios
            .Where(u => u.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.SessaoVersao, u => (short)(u.SessaoVersao + 1)), ct);

        await contexto.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static async Task<IResult> QuemSouAsync(
        ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var id = IdDoUsuario(principal);

        var usuario = await db.Usuarios.AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new UsuarioLogado(u.Nome, u.FotoUrl))
            .FirstOrDefaultAsync(ct);

        return usuario is null ? Results.Unauthorized() : Results.Ok(usuario);
    }

    /// <summary>
    /// 🔴 LGPD art. 18, VI — direito à eliminação.
    ///
    /// ⭐ É UM `DELETE`. Os `ON DELETE CASCADE` do schema levam junto a lista de
    /// acompanhados, os consentimentos e os tokens de e-mail. Foi para isto que eles
    /// existem: sem o cascade, esta operação seria uma lista de tabelas que alguém
    /// esqueceria de atualizar ao criar a próxima.
    ///
    /// 🔴 ⛔ **AQUI A EXCLUSÃO É FÍSICA, E ISSO NÃO É DESCUIDO.**
    ///
    /// O projeto adota exclusão LÓGICA como padrão (ver `Pessoa.ExcluidoEm`) — mas
    /// ⛔ não neste caminho. A LGPD art. 18, VI dá direito à **eliminação**, não à
    /// ocultação. Marcar `excluido_em` e manter a linha seria dizer ao cidadão que os
    /// dados foram apagados enquanto eles continuam no banco — e a tabela `segue`, que
    /// vem junto no cascade, é **registro de convicção política** (art. 5º, II).
    ///
    /// ⚠️ Quem for adotar exclusão lógica em novas tabelas precisa decidir, uma a uma,
    /// se a tabela guarda dado PESSOAL. Se guarda, o `DELETE` é físico.
    /// </summary>
    private static async Task<IResult> ExcluirContaAsync(
        ClaimsPrincipal principal, HttpContext contexto, PoligraphDb db, CancellationToken ct)
    {
        var id = IdDoUsuario(principal);

        await db.Usuarios.Where(u => u.Id == id).ExecuteDeleteAsync(ct);
        await contexto.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        return Results.NoContent();
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Grava o perfil completo. A minimização foi revogada por decisão do autor:
    /// o que o Google manda, o banco guarda.
    ///
    /// ⚠️ A chave é `GoogleSub`, ⛔ nunca o e-mail — o Google permite trocar o
    /// endereço principal, e usar e-mail como chave criaria uma conta órfã.
    /// </summary>
    private static async Task<Usuario> SalvarPerfilAsync(
        PoligraphDb db, PerfilGoogle perfil, CancellationToken ct)
    {
        var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.GoogleSub == perfil.Sub, ct);

        if (usuario is null)
        {
            usuario = new Usuario { GoogleSub = perfil.Sub, Email = perfil.Email };
            db.Usuarios.Add(usuario);
        }

        usuario.Email = perfil.Email;
        usuario.EmailVerificado = perfil.EmailVerificado;
        usuario.Nome = perfil.Nome;
        usuario.PrimeiroNome = perfil.PrimeiroNome;
        usuario.Sobrenome = perfil.Sobrenome;
        usuario.FotoUrl = perfil.FotoUrl;
        usuario.Locale = perfil.Locale;
        usuario.VistoEm = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return usuario;
    }

    private static async Task EmitirCookieAsync(HttpContext contexto, Usuario usuario)
    {
        Claim[] claims =
        [
            new(ClaimUsuario, usuario.Id.ToString()),
            new(ClaimSessao, usuario.SessaoVersao.ToString())
        ];

        await contexto.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(
                claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    }

    internal static long IdDoUsuario(ClaimsPrincipal principal) =>
        long.Parse(principal.FindFirstValue(ClaimUsuario)!);
}
