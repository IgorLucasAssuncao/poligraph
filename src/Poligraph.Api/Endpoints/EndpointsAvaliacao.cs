using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Endpoints;


public static class EndpointsAvaliacao
{
    public static IEndpointRouteBuilder MapearAvaliacao(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/avaliacao").WithTags("Avaliação");

        // ⚠️ Exige login como todo o resto do site, mas o que é GRAVADO não carrega
        //    a identidade — ver `AvaliacaoQuestionarioModel`.
        grupo.MapPost("/", RegistrarAsync).RequireAuthorization();

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Registra a avaliação do questionário.
    ///
    /// 🔴 O `ClaimsPrincipal` é recebido para exigir sessão válida — e é DESCARTADO.
    /// Nada do usuário entra na linha gravada. Isso é deliberado: a autodeclaração de
    /// posição política é dado sensível no grau mais direto possível, e ligá-la à conta
    /// transformaria a tabela num cadastro de ideologia por pessoa identificada.
    ///
    /// ⭐ Desligada, ela responde "o instrumento acerta?" sem responder "o que o Fulano
    /// pensa?" — que é exatamente o que o TCC precisa.
    /// </summary>
    private static async Task<IResult> RegistrarAsync(
        RequisicaoAvaliacaoDto requisicao,
        ClaimsPrincipal _,
        PoligraphDb db,
        CancellationToken ct)
    {
        if (requisicao.PosicaoAutodeclarada is < -3 or > 3)
            return Results.BadRequest(new { erro = "posicao_fora_da_escala" });

        db.Avaliacoes.Add(new AvaliacaoQuestionarioModel
        {
            PerguntasRespondidas = requisicao.PerguntasRespondidas,
            AcordosDoPrimeiro = requisicao.AcordosDoPrimeiro,
            ComparaveisDoPrimeiro = requisicao.ComparaveisDoPrimeiro,
            Acertou = requisicao.Acertou,
            PosicaoAutodeclarada = requisicao.PosicaoAutodeclarada
        });

        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
