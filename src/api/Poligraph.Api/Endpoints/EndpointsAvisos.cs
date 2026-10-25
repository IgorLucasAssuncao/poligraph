using System.Security.Claims;
using Poligraph.Api.Configuracao;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Textos;
using Poligraph.Data;

namespace Poligraph.Api.Endpoints;

/// <summary>
/// Os avisos no navegador sobre quem a pessoa segue (Pendência 89). Quem envia é o worker
/// (<c>Poligraph.Worker</c>); aqui o navegador entra e sai da lista.
/// </summary>
/// <remarks>
/// <para>RISCO: a inscrição diz que a pessoa segue alguém, então tem consentimento próprio (LGPD art. 8º, §4º), separado do de seguir, com o mesmo 428 que a tela transforma em pergunta.</para>
/// </remarks>
public static class EndpointsAvisos
{
    /// <summary>Onde fica a chave pública VAPID na configuração.</summary>
    public const string ChavePublicaNaConfiguracao = "Avisos:ChavePublica";

    public static IEndpointRouteBuilder MapearAvisos(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/avisos")
            .WithTags("Avisos")
            .RequireAuthorization()
            .ExigirCabecalhoDoSite();

        grupo.MapGet("/chave", Chave).Produces<ChaveDosAvisosDto>();
        grupo.MapGet("/", EstadoAsync).Produces<EstadoDosAvisosDto>();
        grupo.MapPut("/navegador", InscreverAsync);
        grupo.MapPost("/navegador/saida", RemoverAsync);
        grupo.MapDelete("/consentimento", RevogarAsync);

        return app;
    }

    private static IResult Chave(IConfiguration configuracao) =>
        Results.Ok(new ChaveDosAvisosDto(configuracao[ChavePublicaNaConfiguracao] is { Length: > 0 } chave ? chave : null));

    /// <param name="endereco">O endereço do navegador que pergunta, para dizer se ele já recebe avisos.</param>
    private static async Task<IResult> EstadoAsync(
        string? endereco, ClaimsPrincipal principal, ServicoAvisos avisos, CancellationToken ct) =>
        Results.Ok(await avisos.EstadoAsync(SessaoDoUsuario.IdDoUsuario(principal), endereco, ct));

    /// <summary>
    /// Inscreve o navegador, se houver consentimento vivo na versão do texto que a tela mostra.
    /// </summary>
    /// <param name="versao">A versão do texto de consentimento que a tela mostra.</param>
    /// <param name="aceite">Verdadeiro só depois de a pessoa aceitar o texto daquela versão.</param>
    private static async Task<IResult> InscreverAsync(
        InscricaoNoNavegadorDto inscricao, string? versao, bool? aceite, ClaimsPrincipal principal,
        ServicoConsentimentos consentimentos, ServicoAvisos avisos, PoligraphDb db, CancellationToken ct)
    {
        if (!Valida(inscricao))
        {
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: MensagensDaApi.InscricaoInvalida);
        }

        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);
        if (!await consentimentos.EmDiaAsync(idUsuario, TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR, versao, aceite == true, ct))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: MensagensDaApi.FaltaConsentimentoParaAvisos,
                detail: MensagensDaApi.FaltaConsentimentoParaAvisosDetalhe);
        }

        await db.EmTransacaoAsync(c => avisos.InscreverAsync(idUsuario, inscricao, c), ct);
        return Results.NoContent();
    }

    /// <summary>POST, e não DELETE com corpo: o endereço é longo e não cabe bem na URL, e há proxies que descartam corpo de DELETE.</summary>
    private static async Task<IResult> RemoverAsync(
        SaidaDoNavegadorDto saida, ClaimsPrincipal principal, ServicoAvisos avisos, CancellationToken ct)
    {
        await avisos.RemoverAsync(SessaoDoUsuario.IdDoUsuario(principal), saida.Endereco, ct);
        return Results.NoContent();
    }

    /// <summary>Revoga o consentimento (LGPD art. 8º, §5º) e apaga os navegadores e o histórico de avisos, que dependiam dele.</summary>
    private static async Task<IResult> RevogarAsync(
        ClaimsPrincipal principal, ServicoConsentimentos consentimentos, ServicoAvisos avisos, PoligraphDb db, CancellationToken ct)
    {
        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);
        await db.EmTransacaoAsync(async c =>
        {
            await avisos.ApagarTudoAsync(idUsuario, c);
            await consentimentos.RevogarAsync(idUsuario, TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR, c);
        }, ct);
        return Results.NoContent();
    }

    /// <summary>O mesmo que o <c>CHECK</c> da tabela exige, para responder 400 em vez de estourar no banco.</summary>
    private static bool Valida(InscricaoNoNavegadorDto inscricao) =>
        inscricao.Endereco is { Length: <= 1024 } endereco
        && endereco.StartsWith("https://", StringComparison.Ordinal)
        && inscricao.P256dh is { Length: >= 80 and <= 100 }
        && inscricao.Auth is { Length: >= 16 and <= 32 };
}
