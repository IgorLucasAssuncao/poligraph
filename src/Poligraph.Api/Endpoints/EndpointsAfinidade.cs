using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public record RequisicaoAfinidade(IReadOnlyList<RespostaCidadao> Respostas);

/// <summary>⛔ Sem percentual — a tela monta "concordou em X de Y" (RF-29).</summary>
public record ParlamentarAfim(
    long PessoaId, string Nome, string Partido, string Uf, int Acordos, int Comparaveis);

/// <summary>
/// Onde o cidadão cai no grafo.
///
/// ⭐ Centroide ponderado dos parlamentares com quem ele mais concordou — ou seja, ele
/// é posicionado ENTRE as pessoas com quem se parece, que é a leitura honesta.
///
/// 🔴 `BaseDeVotacoes` existe para a tela poder ser franca: a posição do cidadão vale
/// sobre as perguntas que ele respondeu (dezenas), a de cada deputado sobre a
/// legislatura inteira (mais de mil). ⛔ Não é a mesma medida com o mesmo nome, e
/// esconder isso seria afirmar uma precisão que o dado não tem.
/// </summary>
public record PosicaoDoCidadao(
    float EixoX,
    float EixoY,
    short? Comunidade,
    int VizinhosUsados,
    int BaseDeVotacoes);

/// <summary>
/// O resultado de UMA casa.
///
/// <para>
/// <b>O piso de comparáveis vale por casa, e não sobre o total.</b> Com 21 perguntas da
/// Câmara e 7 do Senado, um piso de 60% sobre as 28 daria 17 — e um senador tem no
/// máximo 7 comparáveis. Todo senador seria filtrado, e a lista do Senado nasceria
/// vazia para sempre, sem erro nenhum.
/// </para>
///
/// <para>
/// <c>PerguntasRespondidas</c> é o denominador honesto desta casa: quantas perguntas
/// dela o cidadão respondeu. É o número que a tela usa em "concordaram em 4 de 6".
/// </para>
/// </summary>
public record ResultadoPorCasa(
    string Casa,
    int PerguntasRespondidas,
    IReadOnlyList<ParlamentarAfim> MaisProximos,
    IReadOnlyList<ParlamentarAfim> MaisDistantes,
    PosicaoDoCidadao? PosicaoNoGrafo);

/// <summary>
/// O resultado completo — uma lista por casa.
///
/// <para>
/// O cidadão responde um fluxo único e nunca escolhe entre Câmara e Senado (RNF-28):
/// escolher exigiria justamente o conhecimento que ele não tem. As duas casas votam
/// matérias diferentes (achado #7), então o resultado se separa <b>depois</b> do
/// questionário, em "Deputados mais próximos" e "Senadores mais próximos" — o que é
/// autoexplicativo e não exige decisão prévia.
/// </para>
/// </summary>
public record RespostaAfinidade(
    int TotalPerguntasRespondidas,
    IReadOnlyList<ResultadoPorCasa> PorCasa);

/// <summary>
/// ⚠️ `TotalVotos` é o comparecimento na votação — quantos deputados se posicionaram.
/// `TotalPossivel` é quantos parlamentares a base tem, ou seja, o denominador.
///
/// 🔴 De propósito NÃO é a divisão (quantos Sim, quantos Não). Mostrar o placar antes
/// de a pessoa responder induziria conformidade: "a maioria votou Sim, então voto Sim
/// também" — e o instrumento passaria a medir adesão à maioria, não posição própria.
/// O comparecimento dá contexto sem revelar direção.
///
/// ⭐ Os dois números juntos são o que a tela desenha como "painel": uma marca por
/// parlamentar, cheia para quem se posicionou. Sem o denominador, 300 e 480 marcas
/// seriam indistinguíveis a olho.
/// </summary>
public record PerguntaPublica(
    string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);

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
        // O denominador é recortado por legislatura (PL35) E por casa.
        //
        // A legislatura sai das PERGUNTAS, não do banco: na virada, o pool ainda é da
        // 57ª por um tempo, e o denominador tem de acompanhar as votações mostradas.
        //
        // A casa importa desde que o Senado entrou: sem separar, uma pergunta da Câmara
        // mostrava "439 de 747" — os 747 são deputados MAIS senadores, e os 104
        // senadores nunca votaram aquela votação. Mesmo formato de erro da PL35.
        var legislaturas = await Legislaturas.DasPerguntasAtivasAsync(db, ct);

        var possivelPorCasa = await db.Votos.AsNoTracking()
            .Where(v => legislaturas.Contains(v.Votacao!.Legislatura))
            .GroupBy(v => v.Votacao!.Casa)
            .Select(g => new { Casa = g.Key, Total = g.Select(v => v.PessoaId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Casa, x => x.Total, ct);

        var brutas = await db.Perguntas
            .AsNoTracking()
            .Where(p => p.Ativa)
            .OrderBy(p => p.Ordem)
            .Select(p => new
            {
                p.Id,
                p.Texto,
                p.Ordem,
                Casa = p.Votacao!.Casa,
                TotalVotos = (p.Votacao.VotosSim ?? 0) + (p.Votacao.VotosNao ?? 0)
            })
            .ToListAsync(ct);

        // A casa NÃO é serializada: o cidadão nunca escolhe entre Câmara e Senado
        // (RNF-28), e saber de qual casa veio cada pergunta não muda o que ele responde.
        // Ela serve só para escolher o denominador certo.
        var perguntas = brutas
            .Select(p => new PerguntaPublica(
                p.Id, p.Texto, p.Ordem, p.TotalVotos,
                possivelPorCasa.GetValueOrDefault(p.Casa)))
            .ToList();

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

        // O cálculo roda UMA VEZ POR CASA, sobre as perguntas daquela casa.
        //
        // Não é arrumação: o piso de comparáveis é uma fração das perguntas respondidas,
        // e aplicá-lo sobre o total das duas casas eliminaria todos os senadores. Com 21
        // da Câmara e 7 do Senado, o piso seria 17 e um senador tem no máximo 7.
        var casaDaPergunta = await CasaDasPerguntasAsync(db, opinadas, ct);
        var votosPorPessoa = await CarregarVotosAsync(db, opinadas, ct);

        var porCasa = new List<ResultadoPorCasa>();
        foreach (var casa in casaDaPergunta.Values.Distinct().OrderBy(c => c))
        {
            var daCasa = opinadas
                .Where(r => casaDaPergunta.GetValueOrDefault(r.PerguntaId) == casa)
                .ToList();

            var resultados = CalcularParaTodos(daCasa, votosPorPessoa);
            if (resultados.Count == 0) continue;

            var fichas = await CarregarFichasAsync(db, resultados, ct);

            porCasa.Add(new ResultadoPorCasa(
                Casa: casa,
                PerguntasRespondidas: daCasa.Count,
                MaisProximos: Montar(resultados.OrderByDescending(r => r.Proporcao), fichas),
                MaisDistantes: Montar(resultados.OrderBy(r => r.Proporcao), fichas),
                PosicaoNoGrafo: await PosicionarAsync(db, casa, resultados, daCasa.Count, ct)));
        }

        // Nenhuma casa com base comparável é caso de erro, não de resposta vazia: a tela
        // precisa dizer o que houve, e não mostrar duas listas em branco.
        if (porCasa.Count == 0) return Results.UnprocessableEntity(new
        {
            erro = "sem_base_comparavel",
            mensagem = "Nenhum parlamentar votou o suficiente nas perguntas respondidas."
        });

        return Results.Ok(new RespostaAfinidade(
            TotalPerguntasRespondidas: opinadas.Count,
            PorCasa: porCasa));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem em que são usados
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Quantos vizinhos entram no centroide.</summary>
    private const int VizinhosParaPosicionar = 10;

    /// <summary>
    /// Coloca o cidadão no grafo, pelo centroide ponderado dos mais parecidos.
    ///
    /// ⚠️ Ponderado pela concordância AO QUADRADO. Sem elevar, quem concordou em 60%
    /// puxa quase tanto quanto quem concordou em 95%, e todo mundo acaba no meio do
    /// desenho — que é o pior resultado possível: parece medida e não separa nada.
    ///
    /// ⚠️ A comunidade é a MODA entre os vizinhos, não a do primeiro colocado. Com o
    /// topo empatado — e a medição mostrou empate mediano de 30 —, olhar só o primeiro
    /// seria sortear entre gente que a conta não distingue.
    ///
    /// ⛔ Devolve `null` quando não há execução do grafo, e a tela omite o desenho em
    /// vez de inventar um ponto.
    /// </summary>
    private static async Task<PosicaoDoCidadao?> PosicionarAsync(
        PoligraphDb db,
        string casa,
        List<ResultadoAfinidade> resultados,
        int perguntasRespondidas,
        CancellationToken ct)
    {
        // A execução é a mais recente DAQUELA CASA. Antes do Senado havia uma só, e
        // pegar "a mais recente" funcionava por acidente; agora existem duas, e a
        // ordem entre elas depende de qual ETL rodou por último. Posicionar o cidadão
        // no grafo do Senado a partir das respostas da Câmara daria um ponto plausível
        // sobre uma figura que não é a dele.
        var execucaoId = await db.Execucoes.AsNoTracking()
            .Where(e => e.Status == "CONCLUIDA" && e.Casa == casa)
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        if (execucaoId is null) return null;

        var vizinhos = resultados
            .OrderByDescending(r => r.Proporcao)
            .Take(VizinhosParaPosicionar)
            .ToList();

        var ids = vizinhos.Select(v => v.PessoaId).ToList();

        var metricas = await db.NosMetrica.AsNoTracking()
            .Where(n => n.ExecucaoId == execucaoId && ids.Contains(n.PessoaId)
                        && n.EixoX != null && n.EixoY != null)
            .ToDictionaryAsync(n => n.PessoaId, ct);

        if (metricas.Count == 0) return null;

        double x = 0, y = 0, somaDosPesos = 0;
        var contribuiram = 0;
        var comunidades = new Dictionary<short, double>();

        foreach (var vizinho in vizinhos)
        {
            if (!metricas.TryGetValue(vizinho.PessoaId, out var metrica)) continue;

            var peso = vizinho.Proporcao * vizinho.Proporcao;
            if (peso <= 0) continue;

            contribuiram++;
            x += metrica.EixoX!.Value * peso;
            y += metrica.EixoY!.Value * peso;
            somaDosPesos += peso;

            if (metrica.Comunidade is { } comunidade)
                comunidades[comunidade] = comunidades.GetValueOrDefault(comunidade) + peso;
        }

        // ⚠️ Todos com concordância zero: dividir daria NaN, e NaN vira `null` no JSON
        //    sem erro nenhum — a tela receberia um ponto fantasma.
        if (somaDosPesos <= 0) return null;

        return new PosicaoDoCidadao(
            EixoX: (float)(x / somaDosPesos),
            EixoY: (float)(y / somaDosPesos),
            Comunidade: comunidades.Count == 0
                ? null
                : comunidades.OrderByDescending(c => c.Value).First().Key,
            // ⚠️ Quem PESOU, não quem tem métrica: concordância zero não posiciona.
            VizinhosUsados: contribuiram,
            BaseDeVotacoes: perguntasRespondidas);
    }

    /// <summary>CT7 — abaixo do piso o resultado não significa nada.</summary>
    private static bool TemRespostasSuficientes(int opinadas, int perguntasAtivas) =>
        perguntasAtivas > 0 && opinadas >= MinimoDeRespostas(perguntasAtivas);

    private static int MinimoDeRespostas(int perguntasAtivas) =>
        (int)Math.Ceiling(perguntasAtivas * 0.60);

    /// <summary>
    /// De qual casa é cada pergunta respondida.
    ///
    /// <para>
    /// A casa vive em <c>votacoes.casa</c>, e a pergunta a alcança pela chave estrangeira.
    /// Sem este mapa não haveria como separar o resultado, porque as duas casas
    /// compartilham as mesmas tabelas.
    /// </para>
    /// </summary>
    private static async Task<Dictionary<string, string>> CasaDasPerguntasAsync(
        PoligraphDb db, List<RespostaCidadao> opinadas, CancellationToken ct)
    {
        var ids = opinadas.Select(r => r.PerguntaId).ToList();

        var linhas = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && ids.Contains(p.Id))
            .Select(p => new { p.Id, Casa = p.Votacao!.Casa })
            .ToListAsync(ct);

        return linhas.ToDictionary(l => l.Id, l => l.Casa);
    }

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
