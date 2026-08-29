using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Poligraph.Api.Services;

namespace Poligraph.Api.Endpoints;

public record RequisicaoAfinidadeDto(IReadOnlyList<RespostaCidadao> Respostas);

/// <summary>
/// ⛔ Sem percentual — a tela monta "concordou em X de Y" (RF-29).
///
/// <para>
/// ⭐ <c>Acordou</c> e <c>Discordou</c> são os ids das perguntas que produziram esse
/// "X de Y". Sem eles o número ⛔ não é conferível: o cidadão ⛔ não tem como saber se
/// os 14 acordos foram nas perguntas que ele considera importantes ou nas de data
/// comemorativa.
/// </para>
///
/// <para>
/// ⚠️ Id, ⛔ não texto — o front acabou de mostrar os enunciados e já os tem.
/// </para>
/// </summary>
public record ParlamentarAfimDto(
    long PessoaId,
    string Nome,
    string Partido,
    string Uf,
    int Acordos,
    int Comparaveis,
    IReadOnlyList<string> Acordou,
    IReadOnlyList<string> Discordou);

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
public record PosicaoDoCidadaoDto(
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
public record ResultadoPorCasaDto(
    Casa Casa,
    int PerguntasRespondidas,
    IReadOnlyList<ParlamentarAfimDto> MaisProximos,
    IReadOnlyList<ParlamentarAfimDto> MaisDistantes,
    PosicaoDoCidadaoDto? PosicaoNoGrafo);

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
public record RespostaAfinidadeDto(
    int TotalPerguntasRespondidas,
    IReadOnlyList<ResultadoPorCasaDto> PorCasa);

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
public record PerguntaPublicaDto(
    string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);

/// <summary>
/// O bloco de abertura mais o TAMANHO do questionário completo.
///
/// <para>
/// 🔴 <c>Total</c> existe por causa da barra de progresso. As perguntas de desempate só
/// podem ser escolhidas depois das respostas de base, então a primeira resposta traz
/// menos perguntas do que o questionário terá. Sem declarar o total, a tela mostraria
/// "Pergunta 9 de 17" e o denominador saltaria para 24 no meio — quem estava quase
/// terminando voltaria a estar pela metade.
/// </para>
/// </summary>
public record QuestionarioDto(IReadOnlyList<PerguntaPublicaDto> Perguntas, int Total);

public static class EndpointsAfinidade
{
    private const int QuantidadeExibida = 5;

    /// <summary>
    /// 📐 Quantas perguntas da Câmara o questionário tem, ao todo. Medido em 2026-08-29,
    /// com cada deputado no papel de cidadão:
    ///
    /// <code>
    ///   perguntas | empate mediano no topo | sozinho no topo
    ///          12 |                     20 |            3,0%
    ///          15 |                     13 |           10,1%   ← com desempate: 6
    ///          21 |                      6 |           20,2%
    ///          41 |                      2 |           44,3%
    /// </code>
    ///
    /// ⭐ 15 <b>com desempate dirigido</b> valem 25 fixas. O poço tem 41 curadas, e
    /// mostrar todas faria o mínimo obrigatório subir para 30 — questionário mais longo
    /// ⛔ não é questionário melhor.
    /// </summary>
    private const int PerguntasDaCamara = 15;

    /// <summary>
    /// Quantas vêm antes do desempate. As <c>Ordem</c> da Câmara estão gravadas na ordem
    /// gulosa de cobertura de pares, então "as 8 primeiras" ⭐ significa "as 8 que mais
    /// separam deputados" — ⛔ não é a ordem em que foram curadas.
    /// </summary>
    private const int BaseDaCamara = 8;

    /// <summary>
    /// ⛔ O Senado ⛔ não tem desempate: as 9 perguntas SÃO o poço inteiro. Das 52
    /// votações substantivas abertas da 57ª, 39 têm divisão abaixo de 5% e as demais
    /// substantivas são secretas (achado #17). ⛔ Não há de onde escolher.
    /// </summary>
    private const int DesempateDaCamara = PerguntasDaCamara - BaseDaCamara;

    public static IEndpointRouteBuilder MapearAfinidade(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/afinidade").WithTags("Afinidade");

        grupo.MapGet("/perguntas", ObterPerguntasAsync);
        grupo.MapPost("/perguntas/desempate", ObterDesempateAsync);
        grupo.MapPost("/", CalcularAsync);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════
    // PÚBLICOS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// O bloco de abertura: as <see cref="BaseDaCamara"/> primeiras da Câmara e TODAS as
    /// do Senado. ⚠️ Nunca devolve `VotacaoId` nem `Polaridade`: expor a polaridade
    /// permitiria ao cidadão inferir o voto antes de responder.
    ///
    /// <para>
    /// ⛔ Já ⛔ NÃO devolve o poço inteiro. Com 50 perguntas ativas o mínimo obrigatório
    /// seria <c>ceil(50 × 0,60) = 30</c>; o resto vem de
    /// <see cref="ObterDesempateAsync"/>, escolhido contra o empate de quem respondeu.
    /// </para>
    /// </summary>
    private static async Task<IResult> ObterPerguntasAsync(PoligraphDb db, CancellationToken ct)
    {
        var daCamara = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && p.Votacao!.Casa == Casa.CAMARA)
            .OrderBy(p => p.Ordem)
            .Take(BaseDaCamara)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var doSenado = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && p.Votacao!.Casa == Casa.SENADO)
            .OrderBy(p => p.Ordem)
            .Select(p => p.Id)
            .ToListAsync(ct);

        return Results.Ok(new QuestionarioDto(
            await MontarAsync(db, [.. daCamara, .. doSenado], ct),
            await TamanhoDoQuestionarioAsync(db, ct)));
    }

    /// <summary>
    /// As próximas perguntas da Câmara, escolhidas contra o empate DESTE cidadão.
    ///
    /// <para>
    /// 📐 Medido em 2026-08-29: 8 de base + 7 escolhidas aqui deixam empate mediano de
    /// <b>6</b> no topo; as 15 melhores fixas deixam <b>14</b>, e 8 + 7 sorteadas
    /// deixam <b>16</b> — ou seja, sortear é o mesmo que não adaptar.
    /// </para>
    ///
    /// <para>
    /// ⭐ Sem estado no servidor: a requisição carrega as respostas, e a resposta é
    /// função só delas. Repetir a chamada com as mesmas respostas devolve a mesma lista.
    /// </para>
    ///
    /// <para>
    /// ⛔ Só da Câmara. O Senado ⛔ não tem de onde escolher — ver
    /// <see cref="DesempateDaCamara"/>.
    /// </para>
    /// </summary>
    private static async Task<IResult> ObterDesempateAsync(
        RequisicaoAfinidadeDto requisicao, PoligraphDb db, CancellationToken ct)
    {
        var respondidas = requisicao.Respostas.Select(r => r.PerguntaId).ToList();

        var candidatas = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && p.Votacao!.Casa == Casa.CAMARA && !respondidas.Contains(p.Id))
            .OrderBy(p => p.Ordem)
            .Select(p => p.Id)
            .Take(DesempateDaCamara * 4)
            .ToListAsync(ct);

        if (candidatas.Count == 0) return Results.Ok(Array.Empty<PerguntaPublicaDto>());

        var empatados = await EmpatadosNoTopoAsync(db, requisicao.Respostas, ct);
        var posicoes = await PosicoesAsync(db, candidatas, ct);

        var escolhidas = SeletorDeDesempate.Escolher(empatados, posicoes, DesempateDaCamara);

        return Results.Ok(await MontarAsync(db, escolhidas, ct));
    }

    /// <summary>
    /// Quem está empatado na primeira posição depois das respostas de base.
    ///
    /// <para>
    /// ⚠️ Só a Câmara entra: o desempate escolhe perguntas de lá, e um senador no grupo
    /// ⛔ não seria separado por nenhuma delas.
    /// </para>
    ///
    /// <para>
    /// ⛔ Devolve lista vazia quando ninguém passa o piso de comparáveis — e aí o
    /// seletor cai na ordem de cobertura geral, que é a melhor aposta sem informação.
    /// </para>
    /// </summary>
    private static async Task<List<long>> EmpatadosNoTopoAsync(
        PoligraphDb db, IReadOnlyList<RespostaCidadao> respostas, CancellationToken ct)
    {
        var opinadas = respostas.Where(r => r.Valor != 0).ToList();
        if (opinadas.Count == 0) return [];

        var casaDaPergunta = await CasaDasPerguntasAsync(db, opinadas, ct);
        var daCamara = opinadas
            .Where(r => casaDaPergunta.GetValueOrDefault(r.PerguntaId) == Casa.CAMARA)
            .ToList();

        if (daCamara.Count == 0) return [];

        var votos = await CarregarVotosAsync(db, daCamara, ct);
        var resultados = CalcularParaTodos(daCamara, votos);
        if (resultados.Count == 0) return [];

        var topo = resultados.Max(r => r.Proporcao);

        return resultados
            .Where(r => Math.Abs(r.Proporcao - topo) < 1e-9)
            .Select(r => r.PessoaId)
            .ToList();
    }

    /// <summary>
    /// Posição efetiva de cada parlamentar nas candidatas — o voto já corrigido pela
    /// polaridade. 🔴 Sem a correção, uma pergunta cuja votação inverte o sinal separaria
    /// o grupo ao contrário, e o desempate pioraria o resultado em silêncio.
    /// </summary>
    private static async Task<Dictionary<string, IReadOnlyDictionary<long, short>>>
        PosicoesAsync(PoligraphDb db, List<string> perguntas, CancellationToken ct)
    {
        var linhas = await db.Perguntas.AsNoTracking()
            .Where(p => perguntas.Contains(p.Id))
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

        var porPergunta = new Dictionary<string, IReadOnlyDictionary<long, short>>();

        foreach (var grupo in linhas.GroupBy(l => l.Id))
        {
            var posicoes = new Dictionary<long, short>();

            foreach (var linha in grupo)
            {
                var efetiva = CalculadoraAfinidade.PosicaoEfetiva(
                    new PosicaoParlamentar(linha.Valor, linha.Polaridade));

                if (efetiva is not null and not 0) posicoes[linha.PessoaId] = efetiva.Value;
            }

            porPergunta[grupo.Key] = posicoes;
        }

        return porPergunta;
    }

    /// <summary>
    /// Monta o DTO público de um conjunto de perguntas, preservando a ordem recebida.
    /// ⚠️ A ordem importa: o desempate devolve as perguntas por valor de separação, e
    /// reordenar por <c>Ordem</c> aqui desfaria a escolha.
    /// </summary>
    private static async Task<List<PerguntaPublicaDto>> MontarAsync(
        PoligraphDb db, List<string> perguntas, CancellationToken ct)
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
            .Where(p => p.Ativa && perguntas.Contains(p.Id))
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
        var porId = brutas.ToDictionary(p => p.Id);

        return perguntas
            .Where(porId.ContainsKey)
            .Select(id => porId[id])
            .Select(p => new PerguntaPublicaDto(
                p.Id, p.Texto, p.Ordem, p.TotalVotos,
                possivelPorCasa.GetValueOrDefault(p.Casa)))
            .ToList();
    }

    private static async Task<IResult> CalcularAsync(
        RequisicaoAfinidadeDto requisicao, PoligraphDb db, CancellationToken ct)
    {
        var opinadas = requisicao.Respostas.Where(r => r.Valor != 0).ToList();

        var tamanho = await TamanhoDoQuestionarioAsync(db, ct);

        if (!TemRespostasSuficientes(opinadas.Count, tamanho))
        {
            return Results.UnprocessableEntity(new
            {
                erro = "respostas_insuficientes",
                mensagem = "Responda mais perguntas para que o resultado tenha significado.",
                respondidas = opinadas.Count,
                minimo = MinimoDeRespostas(tamanho)
            });
        }

        // O cálculo roda UMA VEZ POR CASA, sobre as perguntas daquela casa.
        //
        // Não é arrumação: o piso de comparáveis é uma fração das perguntas respondidas,
        // e aplicá-lo sobre o total das duas casas eliminaria todos os senadores. Com 21
        // da Câmara e 7 do Senado, o piso seria 17 e um senador tem no máximo 7.
        var casaDaPergunta = await CasaDasPerguntasAsync(db, opinadas, ct);
        var votosPorPessoa = await CarregarVotosAsync(db, opinadas, ct);

        var porCasa = new List<ResultadoPorCasaDto>();
        foreach (var casa in casaDaPergunta.Values.Distinct().OrderBy(c => c))
        {
            var daCasa = opinadas
                .Where(r => casaDaPergunta.GetValueOrDefault(r.PerguntaId) == casa)
                .ToList();

            var resultados = CalcularParaTodos(daCasa, votosPorPessoa);
            if (resultados.Count == 0) continue;

            var fichas = await CarregarFichasAsync(db, resultados, ct);

            porCasa.Add(new ResultadoPorCasaDto(
                Casa: casa,
                PerguntasRespondidas: daCasa.Count,
                MaisProximos: Montar(
                    resultados.OrderByDescending(r => r.Proporcao), fichas, daCasa, votosPorPessoa),
                MaisDistantes: Montar(
                    resultados.OrderBy(r => r.Proporcao), fichas, daCasa, votosPorPessoa),
                PosicaoNoGrafo: await PosicionarAsync(db, casa, resultados, daCasa.Count, ct)));
        }

        // Nenhuma casa com base comparável é caso de erro, não de resposta vazia: a tela
        // precisa dizer o que houve, e não mostrar duas listas em branco.
        if (porCasa.Count == 0) return Results.UnprocessableEntity(new
        {
            erro = "sem_base_comparavel",
            mensagem = "Nenhum parlamentar votou o suficiente nas perguntas respondidas."
        });

        return Results.Ok(new RespostaAfinidadeDto(
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
    private static async Task<PosicaoDoCidadaoDto?> PosicionarAsync(
        PoligraphDb db,
        Casa casa,
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
            .Where(e => e.Status == StatusDaExecucao.CONCLUIDA && e.Casa == casa)
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

        return new PosicaoDoCidadaoDto(
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
    private static bool TemRespostasSuficientes(int opinadas, int tamanhoDoQuestionario) =>
        tamanhoDoQuestionario > 0 && opinadas >= MinimoDeRespostas(tamanhoDoQuestionario);

    private static int MinimoDeRespostas(int tamanhoDoQuestionario) =>
        (int)Math.Ceiling(tamanhoDoQuestionario * 0.60);

    /// <summary>
    /// Quantas perguntas o questionário OFERECE — ⛔ não quantas existem curadas.
    ///
    /// <para>
    /// 🔴 A distinção é o ponto todo. O poço tem 50 perguntas ativas; o cidadão vê 24
    /// (<see cref="PerguntasDaCamara"/> da Câmara mais as do Senado). Contar as 50 aqui
    /// exigiria <c>ceil(50 × 0,60) = 30</c> respostas de um questionário de 24 — o
    /// resultado ficaria <b>impossível de obter</b>, e a mensagem de erro pediria
    /// perguntas que a tela nunca mostrou.
    /// </para>
    ///
    /// <para>
    /// ⚠️ Sai do banco, ⛔ não é constante: se a curadoria da Câmara encolher para menos
    /// de <see cref="PerguntasDaCamara"/>, o questionário encolhe junto e o mínimo
    /// acompanha.
    /// </para>
    /// </summary>
    private static async Task<int> TamanhoDoQuestionarioAsync(PoligraphDb db, CancellationToken ct)
    {
        var porCasa = await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa)
            .GroupBy(p => p.Votacao!.Casa)
            .Select(g => new { Casa = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.Casa, x => x.Total, ct);

        return Math.Min(PerguntasDaCamara, porCasa.GetValueOrDefault(Casa.CAMARA))
               + porCasa.GetValueOrDefault(Casa.SENADO);
    }

    /// <summary>
    /// De qual casa é cada pergunta respondida.
    ///
    /// <para>
    /// A casa vive em <c>votacoes.casa</c>, e a pergunta a alcança pela chave estrangeira.
    /// Sem este mapa não haveria como separar o resultado, porque as duas casas
    /// compartilham as mesmas tabelas.
    /// </para>
    /// </summary>
    private static async Task<Dictionary<string, Casa>> CasaDasPerguntasAsync(
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

    /// <summary>
    /// ⚠️ O detalhe é calculado só para os <see cref="QuantidadeExibida"/> que aparecem,
    /// ⛔ não para os ~640 do cálculo: são duas listas de ids por parlamentar, e gerá-las
    /// para quem ⛔ não vai à tela seria trabalho jogado fora em toda requisição.
    /// </summary>
    private static List<ParlamentarAfimDto> Montar(
        IOrderedEnumerable<ResultadoAfinidade> ordenados,
        Dictionary<long, (string Nome, string Partido, string Uf)> fichas,
        List<RespostaCidadao> respostas,
        Dictionary<long, Dictionary<string, PosicaoParlamentar>> votosPorPessoa) =>
        ordenados
            .Take(QuantidadeExibida)
            .Select(r =>
            {
                var ficha = fichas.GetValueOrDefault(r.PessoaId);
                var detalhe = CalculadoraAfinidade.Detalhar(
                    respostas,
                    votosPorPessoa.GetValueOrDefault(r.PessoaId) ?? []);

                return new ParlamentarAfimDto(
                    r.PessoaId, ficha.Nome ?? "", ficha.Partido ?? "", ficha.Uf ?? "",
                    r.Acordos, r.Comparaveis, detalhe.Acordou, detalhe.Discordou);
            })
            .ToList();
}
