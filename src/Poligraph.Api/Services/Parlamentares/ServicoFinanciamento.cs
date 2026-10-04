using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Tipos;

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
    /// <param name="legislatura">Sem eleição, a que deu ESTE mandato — e nenhuma outra: a campanha de 2022 na ficha do mandato de 2015 seria a mistura de períodos que a ficha não pode fazer.</param>
    public async Task<FinanciamentoDeCampanhaDto> ObterAsync(IdPessoa idPessoa, AnoDaEleicao? anoDaEleicaoPedido, Legislatura? legislaturaPedida, CancellationToken ct)
    {
        var legislatura = legislaturaPedida?.Numero;
        var anoDaEleicao = anoDaEleicaoPedido?.Valor ?? (legislatura is { } l
            ? Legislaturas.EleicaoDoMandato(l)
            : await _db.ReceitasDeCampanha.AsNoTracking()
                .Where(r => r.PessoaId == idPessoa.Valor)
                .MaxAsync(r => (int?)r.AnoEleicao, ct));

        if (anoDaEleicao is null)
        {
            return new FinanciamentoDeCampanhaDto(0, 0, 0, 0, [], []);
        }

        var daEleicao = _db.ReceitasDeCampanha.AsNoTracking()
            .Where(r => r.PessoaId == idPessoa.Valor && r.AnoEleicao == (short)anoDaEleicao.Value);

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
            AnoEleicao: anoDaEleicao.Value,
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
