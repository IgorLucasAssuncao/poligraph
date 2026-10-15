using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// Os parâmetros do método para a página "Como calculamos", lidos de onde o cálculo os lê.
/// </summary>
public class ServicoMetodologia(PoligraphDb db, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    public Task<MetodologiaDto> ObterAsync(CancellationToken ct) =>
        _leitura.ObterAsync("metodologia", () => CalcularAsync(ct));

    private async Task<MetodologiaDto> CalcularAsync(CancellationToken ct)
    {
        var doSenado = await _db.Perguntas.AsNoTracking()
            .CountAsync(p => p.Ativa && p.Votacao!.Casa == TipoCasa.SENADO, ct);

        var oferecidas = ServicoQuestionario.PerguntasDaCamara + doSenado;

        return new MetodologiaDto(
            new QuestionarioNaMetodologiaDto(
                ServicoQuestionario.PerguntasDaCamara,
                ServicoQuestionario.BaseDaCamara,
                ServicoQuestionario.DesempateDaCamara,
                doSenado,
                ServicoQuestionario.FracaoMinimaDeRespostas,
                ServicoQuestionario.MinimoDeRespostas(oferecidas)),
            new AfinidadeNaMetodologiaDto(
                ServicoAfinidade.QuantidadeExibida, ServicoAfinidade.VizinhosParaPosicionar),
            await CasasAsync(ct));
    }

    /// <remarks>
    /// <para>A legislatura é a corrente, a mesma de toda a base. As votações secretas entram na contagem para a página dizer quantas ficaram fora: no Senado, 239 de 421.</para>
    /// </remarks>
    private async Task<IReadOnlyList<CasaNaMetodologiaDto>> CasasAsync(CancellationToken ct)
    {
        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);
        if (legislatura is null)
        {
            return [];
        }

        var votacoes = await _db.Votacoes.AsNoTracking()
            .Where(v => v.Legislatura == legislatura && v.Plenario)
            .GroupBy(v => v.Casa)
            .Select(g => new { Casa = g.Key, Total = g.Count(), Secretas = g.Count(v => v.Secreta) })
            .ToListAsync(ct);

        var execucoes = await _db.Execucoes.AsNoTracking()
            .Where(e => e.Legislatura == legislatura && e.Status == TipoStatusDaExecucao.CONCLUIDA)
            .GroupBy(e => e.Casa)
            .Select(g => g.OrderByDescending(e => e.Id).First())
            .ToListAsync(ct);

        return [.. votacoes
            .OrderBy(v => v.Casa)
            .Select(v =>
            {
                var execucao = execucoes.FirstOrDefault(e => e.Casa == v.Casa);
                return new CasaNaMetodologiaDto(
                    v.Casa.ToString(), legislatura.Value, v.Total, v.Secretas,
                    execucao?.ConcluidaEm, execucao?.K, execucao?.MinimoVotacoesComuns,
                    execucao?.RazaoRecencia, execucao?.PesoDestaque, execucao?.PesoAutoridade);
            })];
    }
}
