using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// Quais perguntas o cidadão vê, e quantas ele precisa responder.
///
/// Usa o <see cref="ServicoAfinidade"/>: o desempate precisa saber quem está empatado.
/// </summary>
public class ServicoQuestionario(PoligraphDb db, ServicoAfinidade afinidade, CacheDeLeitura leitura)
{
    /// <summary>
    /// Quantas perguntas da Câmara o questionário tem, ao todo. Medido em 2026-08-29,
    /// com cada deputado no papel de cidadão:
    ///
    /// <code>
    /// perguntas | empate mediano no topo | sozinho no topo
    /// 12 | 20 | 3,0%
    /// 15 | 13 | 10,1% com desempate: 6
    /// 21 | 6 | 20,2%
    /// 41 | 2 | 44,3%
    /// </code>
    ///
    /// 15 <b>com desempate dirigido</b> valem 25 fixas. O poço tem 41 curadas, e
    /// mostrar todas faria o mínimo obrigatório subir para 30 — questionário mais longo
    /// não é questionário melhor.
    /// </summary>
    public const int PerguntasDaCamara = 15;

    /// <summary>
    /// Quantas vêm antes do desempate. As <c>Ordem</c> da Câmara estão gravadas na ordem
    /// gulosa de cobertura de pares, então "as 8 primeiras" significa "as 8 que mais
    /// separam deputados" — não é a ordem em que foram curadas.
    /// </summary>
    public const int BaseDaCamara = 8;

    /// <summary>
    /// O Senado não tem desempate: as 9 perguntas SÃO o poço inteiro. Das 52
    /// votações substantivas abertas da 57ª, 39 têm divisão abaixo de 5% e as demais
    /// substantivas são secretas (achado #17). Não há de onde escolher.
    /// </summary>
    public const int DesempateDaCamara = PerguntasDaCamara - BaseDaCamara;

    /// <summary>
    /// A parte do questionário OFERECIDO que precisa de opinião para haver resultado.
    /// Sobre o oferecido, e não sobre o poço: sobre o poço daria mais respostas que perguntas.
    /// </summary>
    public const double FracaoMinimaDeRespostas = 0.60;

    private readonly PoligraphDb _db = db;
    private readonly ServicoAfinidade _afinidade = afinidade;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>
    /// O bloco de abertura: as <see cref="BaseDaCamara"/> primeiras da Câmara e TODAS as
    /// do Senado. Nunca devolve `VotacaoId` nem `Polaridade`: expor a polaridade
    /// permitiria ao cidadão inferir o voto antes de responder.
    ///
    /// <para>
    /// Já NÃO devolve o poço inteiro. Com 50 perguntas ativas o mínimo obrigatório
    /// seria <c>ceil(50 × 0,60) = 30</c>; o resto vem de
    /// <see cref="ObterDesempateAsync"/>, escolhido contra o empate de quem respondeu.
    /// </para>
    /// </summary>
    public Task<QuestionarioDto> ObterAsync(CancellationToken ct) =>
        _leitura.ObterAsync("questionario", () => CalcularAsync(ct));

    /// <summary>
    /// As próximas perguntas da Câmara, escolhidas contra o empate DESTE cidadão.
    ///
    /// <para>
    /// Medido em 2026-08-29: 8 de base + 7 escolhidas aqui deixam empate mediano de
    /// <b>6</b> no topo; as 15 melhores fixas deixam <b>14</b>, e 8 + 7 sorteadas
    /// deixam <b>16</b> — ou seja, sortear é o mesmo que não adaptar.
    /// </para>
    ///
    /// <para>
    /// Sem estado no servidor: a requisição carrega as respostas, e a resposta é
    /// função só delas. Repetir a chamada com as mesmas respostas devolve a mesma lista.
    /// </para>
    ///
    /// <para>
    /// Só da Câmara. O Senado não tem de onde escolher — ver
    /// <see cref="DesempateDaCamara"/>.
    /// </para>
    /// </summary>
    public async Task<IReadOnlyList<PerguntaPublicaDto>> DesempatarAsync(
        IReadOnlyList<RespostaCidadao> respostas, CancellationToken ct)
    {
        var respondidas = respostas.Select(r => r.PerguntaId).ToList();

        var candidatas = await _db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && p.Votacao!.Casa == TipoCasa.CAMARA && !respondidas.Contains(p.Id))
            .OrderBy(p => p.Ordem)
            .Select(p => p.Id)
            .Take(DesempateDaCamara * 4)
            .ToListAsync(ct);

        if (candidatas.Count == 0) return [];

        var empatados = await EmpatadosNoTopoAsync(respostas, ct);
        var posicoes = await PosicoesAsync(candidatas, ct);

        var escolhidas = SeletorDeDesempate.Escolher(empatados, posicoes, DesempateDaCamara);

        return await MontarAsync(escolhidas, ct);
    }

    /// <summary>
    /// Quantas perguntas o questionário OFERECE — não quantas existem curadas.
    ///
    /// <para>
    /// A distinção é o ponto todo. O poço tem 50 perguntas ativas; o cidadão vê 24
    /// (<see cref="PerguntasDaCamara"/> da Câmara mais as do Senado). Contar as 50 aqui
    /// exigiria <c>ceil(50 × 0,60) = 30</c> respostas de um questionário de 24 — o
    /// resultado ficaria <b>impossível de obter</b>, e a mensagem de erro pediria
    /// perguntas que a tela nunca mostrou.
    /// </para>
    ///
    /// <para>
    /// Sai do banco, não é constante: se a curadoria da Câmara encolher para menos
    /// de <see cref="PerguntasDaCamara"/>, o questionário encolhe junto e o mínimo
    /// acompanha.
    /// </para>
    /// </summary>
    public async Task<int> TamanhoAsync(CancellationToken ct)
    {
        var porCasa = await _db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa)
            .GroupBy(p => p.Votacao!.Casa)
            .Select(g => new { Casa = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.Casa, x => x.Total, ct);

        return Math.Min(PerguntasDaCamara, porCasa.GetValueOrDefault(TipoCasa.CAMARA))
               + porCasa.GetValueOrDefault(TipoCasa.SENADO);
    }

    /// <summary>CT7 — abaixo do piso o resultado não significa nada.</summary>
    public bool TemRespostasSuficientes(int opinadas, int tamanhoDoQuestionario) =>
        tamanhoDoQuestionario > 0 && opinadas >= MinimoDeRespostas(tamanhoDoQuestionario);

    /// <summary> 60% do que é OFERECIDO, não do poço curado.</summary>
    public static int MinimoDeRespostas(int tamanhoDoQuestionario) =>
        (int)Math.Ceiling(tamanhoDoQuestionario * FracaoMinimaDeRespostas);

    private async Task<QuestionarioDto> CalcularAsync(CancellationToken ct)
    {
        var daCamara = await _db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && p.Votacao!.Casa == TipoCasa.CAMARA)
            .OrderBy(p => p.Ordem)
            .Take(BaseDaCamara)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var doSenado = await _db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa && p.Votacao!.Casa == TipoCasa.SENADO)
            .OrderBy(p => p.Ordem)
            .Select(p => p.Id)
            .ToListAsync(ct);

        return new QuestionarioDto(
            await MontarAsync([.. daCamara, .. doSenado], ct),
            await TamanhoAsync(ct));
    }

    /// <summary>
    /// Quem está empatado na primeira posição depois das respostas de base.
    ///
    /// <para>
    /// Só a Câmara entra: o desempate escolhe perguntas de lá, e um senador no grupo
    /// não seria separado por nenhuma delas.
    /// </para>
    ///
    /// <para>
    /// Devolve lista vazia quando ninguém passa o piso de comparáveis — e aí o
    /// seletor cai na ordem de cobertura geral, que é a melhor aposta sem informação.
    /// </para>
    /// </summary>
    private async Task<List<long>> EmpatadosNoTopoAsync(
        IReadOnlyList<RespostaCidadao> respostas, CancellationToken ct)
    {
        var opinadas = respostas.Where(r => r.Valor != 0).ToList();
        if (opinadas.Count == 0) return [];

        var casaDaPergunta = await _afinidade.CasaDasPerguntasAsync(opinadas, ct);
        var daCamara = opinadas
            .Where(r => casaDaPergunta.GetValueOrDefault(r.PerguntaId) == TipoCasa.CAMARA)
            .ToList();

        if (daCamara.Count == 0) return [];

        var votos = await _afinidade.CarregarVotosAsync(daCamara, ct);
        var resultados = _afinidade.CalcularParaTodos(daCamara, votos);
        if (resultados.Count == 0) return [];

        var topo = resultados.Max(r => r.Proporcao);

        return resultados
            .Where(r => Math.Abs(r.Proporcao - topo) < 1e-9)
            .Select(r => r.PessoaId)
            .ToList();
    }

    /// <summary>
    /// Posição efetiva de cada parlamentar nas candidatas — o voto já corrigido pela
    /// polaridade. Sem a correção, uma pergunta cuja votação inverte o sinal separaria
    /// o grupo ao contrário, e o desempate pioraria o resultado em silêncio.
    /// </summary>
    private async Task<Dictionary<string, IReadOnlyDictionary<long, short>>>
        PosicoesAsync(List<string> perguntas, CancellationToken ct)
    {
        var linhas = await _db.Perguntas.AsNoTracking()
            .Where(p => perguntas.Contains(p.Id))
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
    /// A ordem importa: o desempate devolve as perguntas por valor de separação, e
    /// reordenar por <c>Ordem</c> aqui desfaria a escolha.
    /// </summary>
    /// <remarks>
    /// <para>O denominador é recortado por legislatura (Pendência 35) E por casa. A legislatura sai das PERGUNTAS, não do banco: na virada, o pool ainda é da 57ª por um tempo, e o denominador tem de acompanhar as votações mostradas. A casa importa desde que o Senado entrou: sem separar, uma pergunta da Câmara mostrava "439 de 747" — os 747 são deputados MAIS senadores, e os 104 senadores nunca votaram aquela votação. Mesmo formato de erro da Pendência 35.</para>
    /// <para>A casa NÃO é serializada: o cidadão nunca escolhe entre Câmara e Senado (RNF-28), e saber de qual casa veio cada pergunta não muda o que ele responde. Ela serve só para escolher o denominador certo.</para>
    /// </remarks>
    private async Task<List<PerguntaPublicaDto>> MontarAsync(
        List<string> perguntas, CancellationToken ct)
    {
        var legislaturas = await Legislaturas.DasPerguntasAtivasAsync(_db, ct);

        var possivelPorCasa = await _db.Votos.AsNoTracking()
            .Where(v => legislaturas.Contains(v.Votacao!.Legislatura))
            .GroupBy(v => v.Votacao!.Casa)
            .Select(g => new { Casa = g.Key, Total = g.Select(v => v.PessoaId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Casa, x => x.Total, ct);

        var brutas = await _db.Perguntas
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

        var porId = brutas.ToDictionary(p => p.Id);

        return perguntas
            .Where(porId.ContainsKey)
            .Select(id => porId[id])
            .Select(p => new PerguntaPublicaDto(
                p.Id, p.Texto, p.Ordem, p.TotalVotos,
                possivelPorCasa.GetValueOrDefault(p.Casa)))
            .ToList();
    }
}
