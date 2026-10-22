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
            ? await EleicaoDoMandatoAsync(idPessoa.Valor, l, ct)
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

    /// <summary>A eleição que deu o mandato da pessoa nesta legislatura, pelos mandatos do TSE; sem mandato na base, a eleição anterior à legislatura.</summary>
    /// <remarks>
    /// <para>RISCO: o senador tem oito anos de mandato, e a legislatura, quatro. Pela regra só da legislatura, a ficha da 57ª de um senador eleito em 2018 procurava a campanha de 2022, que não houve, e dizia "sem registro". MEDIDO em 2026-10-22: Ciro Nogueira.</para>
    /// </remarks>
    private async Task<int> EleicaoDoMandatoAsync(long idPessoa, short legislatura, CancellationToken ct)
    {
        var inicio = (short)Legislaturas.AnoInicial(legislatura);
        var doTse = await _db.Mandatos.AsNoTracking()
            .Where(m => m.PessoaId == idPessoa
                     && (m.Cargo == TipoCargo.SENADOR || m.Cargo == TipoCargo.DEPUTADO_FEDERAL)
                     && m.PrimeiroAno <= inicio && m.UltimoAno >= inicio)
            .MaxAsync(m => (short?)m.AnoEleicao, ct);
        return doTse ?? Legislaturas.EleicaoDoMandato(legislatura);
    }
}
