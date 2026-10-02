using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O cálculo da afinidade: dadas as respostas do cidadão, quem votou como ele.
///
/// As três primitivas públicas — casa de cada pergunta, votos e cálculo em lote — servem
/// também ao <see cref="ServicoQuestionario"/>.
/// </summary>
public class ServicoAfinidade(PoligraphDb db)
{
    public const int QuantidadeExibida = 5;

    /// <summary>Quantos vizinhos entram no centroide.</summary>
    public const int VizinhosParaPosicionar = 10;

    private readonly PoligraphDb _db = db;

    /// <summary>
    /// Devolve <c>null</c> quando nenhuma casa tem base comparável — é caso de
    /// ERRO, não de resposta vazia: a tela precisa dizer o que houve, e não
    /// mostrar duas listas em branco. Quem traduz isso em 422 é o endpoint.
    /// </summary>
    /// <remarks>
    /// <para>O cálculo roda UMA VEZ POR CASA, sobre as perguntas daquela casa. Não é arrumação: o piso de comparáveis é uma fração das perguntas respondidas, e aplicá-lo sobre o total das duas casas eliminaria todos os senadores. Com 21 da Câmara e 7 do Senado, o piso seria 17 e um senador tem no máximo 7.</para>
    /// <para>Nenhuma casa com base comparável é caso de erro, não de resposta vazia: a tela precisa dizer o que houve, e não mostrar duas listas em branco.</para>
    /// </remarks>
    public async Task<RespostaAfinidadeDto?> CalcularAsync(
        IReadOnlyList<RespostaCidadao> opinadas, CancellationToken ct)
    {
        var casaDaPergunta = await CasaDasPerguntasAsync(opinadas, ct);
        var votosPorPessoa = await CarregarVotosAsync(opinadas, ct);

        var porCasa = new List<ResultadoPorCasaDto>();
        foreach (var casa in casaDaPergunta.Values.Distinct().OrderBy(c => c))
        {
            var daCasa = opinadas
                .Where(r => casaDaPergunta.GetValueOrDefault(r.PerguntaId) == casa)
                .ToList();

            var resultados = CalcularParaTodos(daCasa, votosPorPessoa);
            if (resultados.Count == 0) continue;

            var fichas = await CarregarFichasAsync(resultados, ct);

            porCasa.Add(new ResultadoPorCasaDto(
                Casa: casa,
                PerguntasRespondidas: daCasa.Count,
                MaisProximos: Montar(
                    resultados.OrderByDescending(r => r.Proporcao), fichas, daCasa, votosPorPessoa),
                MaisDistantes: Montar(
                    resultados.OrderBy(r => r.Proporcao), fichas, daCasa, votosPorPessoa),
                PosicaoNoGrafo: await PosicionarAsync(casa, resultados, daCasa, ct),
                Escala: Escala(resultados)));
        }

        if (porCasa.Count == 0) return null;

        return new RespostaAfinidadeDto(
            TotalPerguntasRespondidas: opinadas.Count,
            PorCasa: porCasa);
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
    public async Task<Dictionary<string, TipoCasa>> CasaDasPerguntasAsync(
        IReadOnlyList<RespostaCidadao> opinadas, CancellationToken ct)
    {
        var ids = opinadas.Select(r => r.PerguntaId).ToList();

        var linhas = await _db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && ids.Contains(p.Id))
            .Select(p => new { p.Id, Casa = p.Votacao!.Casa })
            .ToListAsync(ct);

        return linhas.ToDictionary(l => l.Id, l => l.Casa);
    }

    /// <summary>
    /// Uma consulta só, para todas as perguntas respondidas.
    /// Um `foreach` com consulta dentro seria N+1 sobre ~640 parlamentares.
    /// </summary>
    public async Task<Dictionary<long, Dictionary<string, PosicaoParlamentar>>>
        CarregarVotosAsync(
            IReadOnlyList<RespostaCidadao> opinadas, CancellationToken ct)
    {
        var ids = opinadas.Select(r => r.PerguntaId).ToList();

        var linhas = await _db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && ids.Contains(p.Id))
            .Join(_db.Votos.AsNoTracking(),
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

    /// <remarks>
    /// <para>sem o piso, quem votou em 2 e concordou nas 2 lideraria com 100%</para>
    /// </remarks>
    public List<ResultadoAfinidade> CalcularParaTodos(
        IReadOnlyList<RespostaCidadao> opinadas,
        Dictionary<long, Dictionary<string, PosicaoParlamentar>> votosPorPessoa)
    {
        var resultados = new List<ResultadoAfinidade>();

        foreach (var (pessoaId, posicoes) in votosPorPessoa)
        {
            var resultado = CalculadoraAfinidade.Calcular(pessoaId, opinadas, posicoes);

            if (CalculadoraAfinidade.TemBaseSuficiente(resultado, opinadas.Count))
                resultados.Add(resultado);
        }

        return resultados;
    }

    /// <remarks>
    /// <para>partido e UF vêm do voto mais recente — é o registro histórico</para>
    /// </remarks>
    private async Task<Dictionary<long, (string Nome, string Partido, string Uf)>>
        CarregarFichasAsync(
            List<ResultadoAfinidade> resultados, CancellationToken ct)
    {
        var ids = resultados.Select(r => r.PessoaId).ToList();

        var fichas = await _db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
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
    /// O detalhe é calculado só para os <see cref="QuantidadeExibida"/> que aparecem,
    /// não para os ~640 do cálculo: são duas listas de ids por parlamentar, e gerá-las
    /// para quem não vai à tela seria trabalho jogado fora em toda requisição.
    /// </summary>
    private static List<ParlamentarAfimDto> Montar(
        IOrderedEnumerable<ResultadoAfinidade> ordenados,
        Dictionary<long, (string Nome, string Partido, string Uf)> fichas,
        IReadOnlyList<RespostaCidadao> respostas,
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

    /// <summary>
    /// Coloca o cidadão no grafo, pelo centroide ponderado dos mais parecidos.
    ///
    /// Ponderado pela concordância AO QUADRADO. Sem elevar, quem concordou em 60%
    /// puxa quase tanto quanto quem concordou em 95%, e todo mundo acaba no meio do
    /// desenho — que é o pior resultado possível: parece medida e não separa nada.
    ///
    /// A comunidade é a MODA entre os vizinhos, não a do primeiro colocado. Com o
    /// topo empatado — e a medição mostrou empate mediano de 30 —, olhar só o primeiro
    /// seria sortear entre gente que a conta não distingue.
    ///
    /// Devolve `null` quando não há execução do grafo, e a tela omite o desenho em
    /// vez de inventar um ponto.
    /// </summary>
    /// <remarks>
    /// <para>A execução é a DAQUELA CASA e da legislatura em que as perguntas respondidas foram votadas. Sem a casa, o cidadão cairia no grafo do Senado a partir das respostas da Câmara; sem a legislatura, a análise de uma legislatura antiga, ou a posse da seguinte antes de as perguntas mudarem, o poria numa figura de outra Câmara.</para>
    /// <para>Todos com concordância zero: dividir daria NaN, e NaN vira `null` no JSON sem erro nenhum — a tela receberia um ponto fantasma.</para>
    /// <para>Quem PESOU, não quem tem métrica: concordância zero não posiciona.</para>
    /// </remarks>
    private async Task<PosicaoDoCidadaoDto?> PosicionarAsync(
        TipoCasa casa,
        List<ResultadoAfinidade> resultados,
        IReadOnlyList<RespostaCidadao> respondidas,
        CancellationToken ct)
    {
        var perguntas = respondidas.Select(r => r.PerguntaId).ToList();
        var legislatura = await _db.Perguntas.AsNoTracking()
            .Where(p => perguntas.Contains(p.Id))
            .MaxAsync(p => (short?)p.Votacao!.Legislatura, ct);

        if (legislatura is null) return null;

        var execucaoId = await ExecucaoVigente.IdAsync(_db, casa, legislatura.Value, ct);

        if (execucaoId is null) return null;

        var vizinhos = resultados
            .OrderByDescending(r => r.Proporcao)
            .Take(VizinhosParaPosicionar)
            .ToList();

        var ids = vizinhos.Select(v => v.PessoaId).ToList();

        var metricas = await _db.NosMetrica.AsNoTracking()
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

        if (somaDosPesos <= 0) return null;

        return new PosicaoDoCidadaoDto(
            EixoX: (float)(x / somaDosPesos),
            EixoY: (float)(y / somaDosPesos),
            Comunidade: comunidades.Count == 0
                ? null
                : comunidades.OrderByDescending(c => c.Value).First().Key,
            VizinhosUsados: contribuiram,
            BaseDeVotacoes: respondidas.Count);
    }

    /// <summary>O parlamentar do meio da lista, pela mesma proporção que ordena os mais próximos.</summary>
    /// <remarks>
    /// <para>Não recalcula nada: lê o resultado que já existe para todos os parlamentares da casa.</para>
    /// </remarks>
    private static EscalaDaCasaDto Escala(IReadOnlyList<ResultadoAfinidade> resultados)
    {
        var mediano = resultados.OrderBy(r => r.Proporcao).ElementAt(resultados.Count / 2);
        return new EscalaDaCasaDto(resultados.Count, mediano.Acordos, mediano.Comparaveis);
    }
}
