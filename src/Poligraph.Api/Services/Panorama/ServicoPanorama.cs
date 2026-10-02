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
public class ServicoPanorama(PoligraphDb db, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <remarks>
    /// <para>Base vazia devolve panorama vazio, não erro: é o estado do primeiro dia, e a tela tem um texto próprio para ele.</para>
    /// <para>Casa sem nenhuma votação ingerida fica fora — a tela não deve anunciar uma casa que ainda não entrou na base.</para>
    /// </remarks>
    public Task<PanoramaDto> ObterAsync(CancellationToken ct) =>
        _leitura.ObterAsync("panorama", () => CalcularAsync(ct));

    private async Task<PanoramaDto> CalcularAsync(CancellationToken ct)
    {
        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);

        if (legislatura is null) return new PanoramaDto(null, 0, []);

        var perguntas = await _db.Perguntas.AsNoTracking().CountAsync(p => p.Ativa, ct);

        var porCasa = new List<PanoramaDaCasaDto>();
        foreach (var casa in (TipoCasa[])[TipoCasa.CAMARA, TipoCasa.SENADO])
            porCasa.Add(await DaCasaAsync(casa, legislatura.Value, ct));

        return new PanoramaDto(
            legislatura, perguntas, [.. porCasa.Where(c => c.Votacoes > 0)]);
    }

    /// <remarks>
    /// <para>Quem VOTOU, e não quem está cadastrado: o cadastro traz 7.889 nomes de todas as legislaturas, e anunciar isso como "deputados" seria falso.</para>
    /// <para>O sigilo do Senado é achado do trabalho, não detalhe — a tela mostra.</para>
    /// <para>`== 1 || == -1`, não `!= null`: abstenção não é posição.</para>
    /// </remarks>
    private async Task<PanoramaDaCasaDto> DaCasaAsync(
        TipoCasa casa, short legislatura, CancellationToken ct)
    {
        var votacoes = _db.Votacoes.AsNoTracking()
            .Where(v => v.Casa == casa && v.Legislatura == legislatura);

        var votos = _db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Casa == casa && v.Votacao.Legislatura == legislatura);

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
                                  && a.Tipo == TipoDeAresta.SIMILARIDADE_VOTO, ct));
    }
}
