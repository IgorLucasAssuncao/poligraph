using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O financiamento da campanha, com os dois fundos separados —
/// ver <see cref="FinanciamentoDeCampanhaDto"/>.
/// </summary>
public class ServicoFinanciamento(PoligraphDb db)
{
    /// <summary>Quantos doadores aparecem na ficha.</summary>
    private const int ItensNaFicha = 8;

    private readonly PoligraphDb _db = db;

    /// <remarks>
    /// <para>RNF-13: doador pessoa física aparece pelo NOME; o documento é hash e nunca sai da API. Mesma regra de `DespesaModel.CnpjOuHash`.</para>
    /// </remarks>
    public async Task<FinanciamentoDeCampanhaDto> ObterAsync(long id, int? eleicao, CancellationToken ct)
    {
        var alvo = eleicao ?? await _db.ReceitasDeCampanha.AsNoTracking()
            .Where(r => r.PessoaId == id)
            .MaxAsync(r => (int?)r.AnoEleicao, ct);

        if (alvo is null) return new FinanciamentoDeCampanhaDto(0, 0, 0, 0, [], []);

        var daEleicao = _db.ReceitasDeCampanha.AsNoTracking()
            .Where(r => r.PessoaId == id && r.AnoEleicao == (short)alvo.Value);

        var fontes = await daEleicao
            .GroupBy(r => r.FonteReceita)
            .Select(g => new
            {
                Fonte = g.Key,
                Total = g.Sum(r => r.Valor),
                Lancamentos = g.Count()
            })
            .OrderByDescending(f => f.Total)
            .ToListAsync(ct);

        var doadores = await daEleicao
            .Where(r => r.Doador != null)
            .GroupBy(r => new { r.Doador, r.DoadorEhPessoaFisica })
            .Select(g => new
            {
                g.Key.Doador,
                g.Key.DoadorEhPessoaFisica,
                Total = g.Sum(r => r.Valor)
            })
            .OrderByDescending(d => d.Total)
            .Take(ItensNaFicha)
            .ToListAsync(ct);

        return new FinanciamentoDeCampanhaDto(
            AnoEleicao: alvo.Value,
            Total: fontes.Sum(f => f.Total),
            FundoEspecial: fontes
                .Where(f => f.Fonte == ReceitaDeCampanhaModel.FonteFundoEspecial)
                .Sum(f => f.Total),
            FundoPartidario: fontes
                .Where(f => f.Fonte == ReceitaDeCampanhaModel.FonteFundoPartidario)
                .Sum(f => f.Total),
            PorFonte: [.. fontes.Select(f =>
                new ReceitaPorFonteDto(f.Fonte, f.Total, f.Lancamentos))],
            MaioresDoadores: [.. doadores.Select(d =>
                new DoadorDoParlamentarDto(TextoSemCpf.Limpar(d.Doador!), d.Total, d.DoadorEhPessoaFisica))]);
    }
}
