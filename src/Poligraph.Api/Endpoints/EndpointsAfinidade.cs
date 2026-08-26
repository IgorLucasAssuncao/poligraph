using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public record RequisicaoAfinidade(IReadOnlyList<RespostaCidadao> Respostas);

/// <summary>⛔ Sem percentual — a tela monta "concordou em X de Y" (RF-29).</summary>
public record ParlamentarAfim(
    long PessoaId, string Nome, string Partido, string Uf, int Acordos, int Comparaveis);

public record RespostaAfinidade(
    string Casa,
    int TotalPerguntasRespondidas,
    IReadOnlyList<ParlamentarAfim> MaisProximos,
    IReadOnlyList<ParlamentarAfim> MaisDistantes);

public record PerguntaPublica(string Id, string Texto, short Ordem);

public static class EndpointsAfinidade
{
    private const int QuantidadeExibida = 5;

    public static IEndpointRouteBuilder MapearAfinidade(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/afinidade").WithTags("Afinidade");

        grupo.MapGet("/perguntas", ObterPerguntasAsync);
        grupo.MapPost("/", CalcularAsync);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════
    // PÚBLICOS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// As perguntas ativas, em ordem. ⚠️ Nunca devolve `VotacaoId` nem `Polaridade`:
    /// expor a polaridade permitiria ao cidadão inferir o voto antes de responder.
    /// </summary>
    private static async Task<IResult> ObterPerguntasAsync(PoligraphDb db, CancellationToken ct)
    {
        var perguntas = await db.Perguntas
            .AsNoTracking()
            .Where(p => p.Ativa)
            .OrderBy(p => p.Ordem)
            .Select(p => new PerguntaPublica(p.Id, p.Texto, p.Ordem))
            .ToListAsync(ct);

        return Results.Ok(perguntas);
    }

    private static async Task<IResult> CalcularAsync(
        RequisicaoAfinidade requisicao, PoligraphDb db, CancellationToken ct)
    {
        var opinadas = requisicao.Respostas.Where(r => r.Valor != 0).ToList();

        var perguntasAtivas = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa).CountAsync(ct);

        if (!TemRespostasSuficientes(opinadas.Count, perguntasAtivas))
        {
            return Results.UnprocessableEntity(new
            {
                erro = "respostas_insuficientes",
                mensagem = "Responda mais perguntas para que o resultado tenha significado.",
                respondidas = opinadas.Count,
                minimo = MinimoDeRespostas(perguntasAtivas)
            });
        }

        var votosPorPessoa = await CarregarVotosAsync(db, opinadas, ct);
        var resultados = CalcularParaTodos(opinadas, votosPorPessoa);

        if (resultados.Count == 0) return Results.UnprocessableEntity(new
        {
            erro = "sem_base_comparavel",
            mensagem = "Nenhum parlamentar votou o suficiente nas perguntas respondidas."
        });

        var fichas = await CarregarFichasAsync(db, resultados, ct);

        return Results.Ok(new RespostaAfinidade(
            Casa: "CAMARA",
            TotalPerguntasRespondidas: opinadas.Count,
            MaisProximos: Montar(resultados.OrderByDescending(r => r.Proporcao), fichas),
            MaisDistantes: Montar(resultados.OrderBy(r => r.Proporcao), fichas)));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem em que são usados
    // ═══════════════════════════════════════════════════════════════

    /// <summary>CT7 — abaixo do piso o resultado não significa nada.</summary>
    private static bool TemRespostasSuficientes(int opinadas, int perguntasAtivas) =>
        perguntasAtivas > 0 && opinadas >= MinimoDeRespostas(perguntasAtivas);

    private static int MinimoDeRespostas(int perguntasAtivas) =>
        (int)Math.Ceiling(perguntasAtivas * 0.60);

    /// <summary>
    /// Uma consulta só, para todas as perguntas respondidas.
    /// ⚠️ Um `foreach` com consulta dentro seria N+1 sobre ~640 parlamentares.
    /// </summary>
    private static async Task<Dictionary<long, Dictionary<string, PosicaoParlamentar>>>
        CarregarVotosAsync(
            PoligraphDb db, List<RespostaCidadao> opinadas, CancellationToken ct)
    {
        var ids = opinadas.Select(r => r.PerguntaId).ToList();

        var linhas = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && ids.Contains(p.Id))
            .Join(db.Votos.AsNoTracking(),
                  pergunta => pergunta.VotacaoId,
                  voto => voto.VotacaoId,
                  (pergunta, voto) => new
                  {
                      pergunta.Id,
                      pergunta.Polaridade,
                      voto.PessoaId,
                      voto.Valor
                  })
            .ToListAsync(ct);

        var porPessoa = new Dictionary<long, Dictionary<string, PosicaoParlamentar>>();
        foreach (var linha in linhas)
        {
            if (!porPessoa.TryGetValue(linha.PessoaId, out var posicoes))
                porPessoa[linha.PessoaId] = posicoes = [];

            posicoes[linha.Id] = new PosicaoParlamentar(linha.Valor, linha.Polaridade);
        }

        return porPessoa;
    }

    private static List<ResultadoAfinidade> CalcularParaTodos(
        List<RespostaCidadao> opinadas,
        Dictionary<long, Dictionary<string, PosicaoParlamentar>> votosPorPessoa)
    {
        var resultados = new List<ResultadoAfinidade>();

        foreach (var (pessoaId, posicoes) in votosPorPessoa)
        {
            var resultado = CalculadoraAfinidade.Calcular(pessoaId, opinadas, posicoes);

            // 🔴 sem o piso, quem votou em 2 e concordou nas 2 lideraria com 100%
            if (CalculadoraAfinidade.TemBaseSuficiente(resultado, opinadas.Count))
                resultados.Add(resultado);
        }

        return resultados;
    }

    private static async Task<Dictionary<long, (string Nome, string Partido, string Uf)>>
        CarregarFichasAsync(
            PoligraphDb db, List<ResultadoAfinidade> resultados, CancellationToken ct)
    {
        var ids = resultados.Select(r => r.PessoaId).ToList();

        var fichas = await db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                // partido e UF vêm do voto mais recente — é o registro histórico
                Ultimo = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        return fichas.ToDictionary(
            f => f.Id,
            f => (f.NomeExibicao, f.Ultimo?.PartidoNoVoto ?? "", f.Ultimo?.UfNoVoto ?? ""));
    }

    private static List<ParlamentarAfim> Montar(
        IOrderedEnumerable<ResultadoAfinidade> ordenados,
        Dictionary<long, (string Nome, string Partido, string Uf)> fichas) =>
        ordenados
            .Take(QuantidadeExibida)
            .Select(r =>
            {
                var ficha = fichas.GetValueOrDefault(r.PessoaId);
                return new ParlamentarAfim(
                    r.PessoaId, ficha.Nome ?? "", ficha.Partido ?? "", ficha.Uf ?? "",
                    r.Acordos, r.Comparaveis);
            })
            .ToList();
}
