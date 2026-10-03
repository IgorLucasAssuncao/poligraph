using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Endpoints;

public static class EndpointsAfinidade
{
    public static IEndpointRouteBuilder MapearAfinidade(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/afinidade").WithTags("Afinidade");

        grupo.MapGet("/perguntas", ObterPerguntasAsync)
             .Produces<QuestionarioDto>();

        grupo.MapPost("/perguntas/desempate", ObterDesempateAsync)
             .Produces<IReadOnlyList<PerguntaPublicaDto>>();

        grupo.MapPost("/", CalcularAsync)
             .Produces<RespostaAfinidadeDto>()
             .Produces(StatusCodes.Status422UnprocessableEntity);

        return app;
    }

    private static async Task<IResult> ObterPerguntasAsync(
        ServicoQuestionario questionario, CancellationToken ct) =>
        Results.Ok(await questionario.ObterAsync(ct));

    private static async Task<IResult> ObterDesempateAsync(
        RequisicaoAfinidadeDto requisicao,
        ServicoQuestionario questionario,
        CancellationToken ct) =>
        Results.Ok(await questionario.DesempatarAsync(requisicao.Respostas, ct));

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

        Uf? uf = null;
        if (requisicao.Uf is not null)
        {
            if (!Uf.TryParse(requisicao.Uf, null, out var lida))
            {
                return Results.Problem($"UF desconhecida: {requisicao.Uf}.", statusCode: StatusCodes.Status400BadRequest);
            }

            uf = lida;
        }

        var resposta = await afinidade.CalcularAsync(opinadas, uf, ct);

        return resposta is null
            ? Results.UnprocessableEntity(new
            {
                erro = "sem_base_comparavel",
                mensagem = "Nenhum parlamentar votou o suficiente nas perguntas respondidas."
            })
            : Results.Ok(resposta);
    }
}
