using System.Security.Claims;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsAutenticacao
{
    public static IEndpointRouteBuilder MapearAutenticacao(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/auth").WithTags("Autenticação");

        grupo.MapPost("/google", EntrarAsync)
             .Produces<UsuarioLogadoDto>()
             .Produces(StatusCodes.Status401Unauthorized);

        // 🔴 O `(Delegate)` muda o COMPORTAMENTO da rota, ⛔ não a documentação: com
        //    `HttpContext` como único parâmetro, o C# elege a sobrecarga
        //    `MapPost(string, RequestDelegate)`, que DESCARTA o `IResult` e some do
        //    OpenAPI. 📐 achados/032. O `ASP0016` é `error` para ⛔ não voltar calado.
        grupo.MapPost("/logout", (Delegate)SairAsync)
             .Produces(StatusCodes.Status204NoContent);

        grupo.MapPost("/sair-de-todos", SairDeTodosAsync)
             .RequireAuthorization()
             .Produces(StatusCodes.Status204NoContent);

        grupo.MapGet("/eu", QuemSouAsync)
             .RequireAuthorization()
             .Produces<UsuarioLogadoDto>()
             .Produces(StatusCodes.Status401Unauthorized);

        grupo.MapDelete("/conta", ExcluirContaAsync)
             .RequireAuthorization()
             .Produces(StatusCodes.Status204NoContent);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// O único lugar do sistema onde o `id_token` do Google aparece.
    /// ⭐ Ele é validado, usado e DESCARTADO — nunca vai ao banco.
    /// </summary>
    private static async Task<IResult> EntrarAsync(
        RequisicaoLoginDto requisicao,
        HttpContext contexto,
        IValidadorGoogle validador,
        ServicoContas contas,
        CancellationToken ct)
    {
        var perfil = await validador.ValidarAsync(requisicao.IdToken, ct);
        if (perfil is null) return Results.Unauthorized();

        var usuario = await contas.SalvarPerfilAsync(perfil, ct);
        await SessaoDoUsuario.EmitirAsync(contexto, usuario);
        // o id_token morre aqui

        return Results.Ok(new UsuarioLogadoDto(usuario.Nome, usuario.FotoUrl));
    }

    private static async Task<IResult> SairAsync(HttpContext contexto)
    {
        await SessaoDoUsuario.EncerrarAsync(contexto);
        return Results.NoContent();
    }

    private static async Task<IResult> SairDeTodosAsync(
        ClaimsPrincipal principal, HttpContext contexto,
        ServicoContas contas, CancellationToken ct)
    {
        await contas.InvalidarSessoesAsync(SessaoDoUsuario.IdDoUsuario(principal), ct);
        await SessaoDoUsuario.EncerrarAsync(contexto);

        return Results.NoContent();
    }

    private static async Task<IResult> QuemSouAsync(
        ClaimsPrincipal principal, ServicoContas contas, CancellationToken ct) =>
        await contas.ObterAsync(SessaoDoUsuario.IdDoUsuario(principal), ct) is { } usuario
            ? Results.Ok(usuario)
            : Results.Unauthorized();

    /// <summary>🔴 LGPD art. 18, VI — a exclusão é FÍSICA. Ver `ServicoContas.ExcluirAsync`.</summary>
    private static async Task<IResult> ExcluirContaAsync(
        ClaimsPrincipal principal, HttpContext contexto,
        ServicoContas contas, CancellationToken ct)
    {
        await contas.ExcluirAsync(SessaoDoUsuario.IdDoUsuario(principal), ct);
        await SessaoDoUsuario.EncerrarAsync(contexto);

        return Results.NoContent();
    }
}
