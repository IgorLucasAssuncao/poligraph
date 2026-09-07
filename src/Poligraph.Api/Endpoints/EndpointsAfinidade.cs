using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public static class EndpointsAfinidade
{
    public static IEndpointRouteBuilder MapearAfinidade(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/afinidade").WithTags("Afinidade");

        // 🔴 CT3 — `.Produces<T>()` ⛔ não é enfeite: sem ele o OpenAPI publica a rota
        //    com zero esquema de resposta.
        grupo.MapGet("/perguntas", ObterPerguntasAsync)
             .Produces<QuestionarioDto>();

        grupo.MapPost("/perguntas/desempate", ObterDesempateAsync)
             .Produces<IReadOnlyList<PerguntaPublicaDto>>();

        // ⚠️ O 422 é resposta PREVISTA (CT7), ⛔ não falha: abaixo do piso de respostas
        //    o resultado ⛔ não significa nada, e o front trata esse código.
        grupo.MapPost("/", CalcularAsync)
             .Produces<RespostaAfinidadeDto>()
             .Produces(StatusCodes.Status422UnprocessableEntity);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    private static async Task<IResult> ObterPerguntasAsync(
        ServicoQuestionario questionario, CancellationToken ct) =>
        Results.Ok(await questionario.ObterAsync(ct));

    private static async Task<IResult> ObterDesempateAsync(
        RequisicaoAfinidadeDto requisicao,
        ServicoQuestionario questionario,
        CancellationToken ct) =>
        Results.Ok(await questionario.DesempatarAsync(requisicao.Respostas, ct));

    /// <summary>
    /// 🔴 Os dois 422 moram AQUI, ⛔ não no serviço: eles carregam campos diferentes —
    /// um leva <c>respondidas</c> e <c>minimo</c>, que o front usa na mensagem — e a
    /// forma da resposta HTTP é assunto do endpoint.
    /// </summary>
    private static async Task<IResult> CalcularAsync(
        RequisicaoAfinidadeDto requisicao,
        ServicoQuestionario questionario,
        ServicoAfinidade afinidade,
        CancellationToken ct)
    {
        var opinadas = requisicao.Respostas.Where(r => r.Valor != 0).ToList();
        var tamanho = await questionario.TamanhoAsync(ct);

        if (!questionario.TemRespostasSuficientes(opinadas.Count, tamanho))
        {
            return Results.UnprocessableEntity(new
            {
                erro = "respostas_insuficientes",
                mensagem = "Responda mais perguntas para que o resultado tenha significado.",
                respondidas = opinadas.Count,
                minimo = ServicoQuestionario.MinimoDeRespostas(tamanho)
            });
        }

        var resposta = await afinidade.CalcularAsync(opinadas, ct);

        return resposta is null
            ? Results.UnprocessableEntity(new
            {
                erro = "sem_base_comparavel",
                mensagem = "Nenhum parlamentar votou o suficiente nas perguntas respondidas."
            })
            : Results.Ok(resposta);
    }
}
