using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// RF-33 — os números da base, para a página inicial.
///
/// <para>
/// Existe porque a alternativa era pedir o grafo inteiro só para contar: são alguns
/// MB de nós e arestas por casa, transferidos e descartados. Aqui são sete inteiros.
/// </para>
///
/// <para>
/// Público, e é decisão de método: todo número aqui vem do registro nominal
/// publicado. Nada depende de quem está olhando, e por isso não há nada a
/// proteger — nem a vazar.
/// </para>
/// </summary>
public class ServicoPanorama(PoligraphDb db, CacheDeLeitura leitura, ServicoQuestionario questionario)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;
    private readonly ServicoQuestionario _questionario = questionario;

    /// <remarks>
    /// <para>Base vazia devolve panorama vazio, não erro: é o estado do primeiro dia, e a tela tem um texto próprio para ele.</para>
    /// <para>Casa sem nenhuma votação ingerida fica fora — a tela não deve anunciar uma casa que ainda não entrou na base.</para>
    /// </remarks>
    public Task<PanoramaDto> ObterAsync(short? legislatura, CancellationToken ct) =>
        _leitura.ObterAsync(("panorama", legislatura), () => CalcularAsync(legislatura, ct));

    /// <summary>As legislaturas que a base tem, da mais recente para a mais antiga.</summary>
    public Task<IReadOnlyList<LegislaturaDto>> LegislaturasAsync(CancellationToken ct) =>
        _leitura.ObterAsync("legislaturas", () => CalcularLegislaturasAsync(ct));

    /// <summary>
    /// Se a legislatura pedida existe na base. Nula vale: é "a corrente". Os endpoints
    /// respondem 404 antes de calcular — senão cada número inventado na URL viraria uma
    /// entrada vazia no cache.
    /// </summary>
    public async Task<bool> ExisteAsync(short? legislatura, CancellationToken ct) =>
        legislatura is null || (await LegislaturasAsync(ct)).Any(l => l.Numero == legislatura);

    private async Task<PanoramaDto> CalcularAsync(short? pedida, CancellationToken ct)
    {
        var legislatura = pedida ?? await Legislaturas.CorrenteAsync(_db, ct);

        if (legislatura is null) return new PanoramaDto(null, 0, []);

        var perguntas = await _db.Perguntas.AsNoTracking().CountAsync(p => p.Ativa, ct);

        var porCasa = new List<PanoramaDaCasaDto>();
        foreach (var casa in (TipoCasa[])[TipoCasa.CAMARA, TipoCasa.SENADO])
            porCasa.Add(await DaCasaAsync(casa, legislatura.Value, ct));

        return new PanoramaDto(
            legislatura, perguntas, [.. porCasa.Where(c => c.Votacoes > 0)],
            await _questionario.TamanhoAsync(ct));
    }

    private async Task<IReadOnlyList<LegislaturaDto>> CalcularLegislaturasAsync(CancellationToken ct)
    {
        var pares = await _db.Votacoes.AsNoTracking()
            .Select(v => new { v.Legislatura, v.Casa })
            .Distinct()
            .ToListAsync(ct);

        if (pares.Count == 0) return [];

        var corrente = pares.Max(p => p.Legislatura);

        return [.. pares
            .GroupBy(p => p.Legislatura)
            .OrderByDescending(g => g.Key)
            .Select(g => new LegislaturaDto(
                g.Key,
                Legislaturas.AnoInicial(g.Key),
                Legislaturas.AnoInicial(g.Key) + 4,
                g.Key == corrente,
                [.. g.Select(p => p.Casa).Order()]))];
    }

    /// <remarks>
    /// <para>Quem VOTOU, e não quem está cadastrado: o cadastro traz 7.889 nomes de todas as legislaturas, e anunciar isso como "deputados" seria falso.</para>
    /// <para>O sigilo do Senado é achado do trabalho, não detalhe — a tela mostra.</para>
    /// <para>`== 1 || == -1`, não `!= null`: abstenção não é posição.</para>
    /// <para>Só plenário (2026-10-03): o grafo e o questionário só usam votação de plenário. O cartão dizia 1.597 votações na 57ª da Câmara e "a comparação se apoia nas 1.595 abertas"; a conta usava 1.123.</para>
    /// </remarks>
    private async Task<PanoramaDaCasaDto> DaCasaAsync(
        TipoCasa casa, short legislatura, CancellationToken ct)
    {
        var todas = _db.Votacoes.AsNoTracking()
            .Where(v => v.Casa == casa && v.Legislatura == legislatura && v.Plenario);
        var votacoes = todas.Where(v => _db.Votos.Any(o => o.VotacaoId == v.Id));

        var votos = _db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Casa == casa && v.Votacao.Legislatura == legislatura && v.Votacao.Plenario);

        var execucao = await ExecucaoVigente.IdAsync(_db, casa, legislatura, ct);

        return new PanoramaDaCasaDto(
            casa,
            Parlamentares: await votos.Select(v => v.PessoaId).Distinct().CountAsync(ct),
            Votacoes: await votacoes.CountAsync(ct),
            VotacoesSecretas: await votacoes.CountAsync(v => v.Secreta, ct),
            VotosComPosicao: await votos.CountAsync(v => v.Valor == 1 || v.Valor == -1, ct),
            Comunidades: execucao is null
                ? 0
                : await _db.NosMetrica.AsNoTracking()
                    .Where(n => n.ExecucaoId == execucao && n.Comunidade != null)
                    .Select(n => n.Comunidade)
                    .Distinct()
                    .CountAsync(ct),
            Ligacoes: execucao is null
                ? 0
                : await _db.ArestasGrafo.AsNoTracking()
                    .CountAsync(a => a.ExecucaoId == execucao
                                  && a.Tipo == TipoDeAresta.SIMILARIDADE_VOTO, ct),
            VotacoesSemVotoNominal: await todas.CountAsync(v => !_db.Votos.Any(o => o.VotacaoId == v.Id), ct));
    }
}
