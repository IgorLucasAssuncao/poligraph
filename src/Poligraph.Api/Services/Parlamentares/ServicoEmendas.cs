using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// As emendas do parlamentar, agregadas por ano.
///
/// <para>
/// ⭐ Só entra emenda <b>já reconciliada</b>. Emenda de comissão, de bancada e de autor
/// não resolvido existe no banco e ⛔ não aparece aqui: atribuí-la por semelhança de
/// nome seria inventar autoria.
/// </para>
/// </summary>
public class ServicoEmendas(PoligraphDb db)
{
    /// <summary>Quantos destinos e funções aparecem na ficha.</summary>
    private const int ItensNaFicha = 8;

    private readonly PoligraphDb _db = db;

    public async Task<EmendasDoParlamentarDto> ObterAsync(long id, int? ano, CancellationToken ct)
    {
        var alvo = ano ?? await _db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == id)
            .MaxAsync(e => (int?)e.Ano, ct);

        // Sem emenda é caso normal: a tela mostra estado vazio, ⛔ não erro.
        if (alvo is null) return new EmendasDoParlamentarDto(0, 0, 0, 0, [], []);

        var doAno = _db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == id && e.Ano == (short)alvo.Value);

        // ⚠️ Tipo ANÔNIMO, ⛔ não `record` posicional: o EF não traduz `GroupBy` com
        // construtor posicional e falha em RUNTIME, não na compilação.
        var destinos = await doAno
            .Where(e => e.Localidade != null)
            .GroupBy(e => e.Localidade!)
            .Select(g => new
            {
                Localidade = g.Key,
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Count()
            })
            .OrderByDescending(d => d.Empenhado)
            .Take(ItensNaFicha)
            .ToListAsync(ct);

        var funcoes = await doAno
            .Where(e => e.Funcao != null)
            .GroupBy(e => e.Funcao!)
            .Select(g => new
            {
                Funcao = g.Key,
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago)
            })
            .OrderByDescending(f => f.Empenhado)
            .Take(ItensNaFicha)
            .ToListAsync(ct);

        // 🔴 Agregação PRÓPRIA, ⛔ não a soma dos `Take(8)` acima: eles mostrariam um
        // total menor que o real, sem nada na tela indicando o corte.
        var totais = await doAno
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Count()
            })
            .FirstOrDefaultAsync(ct);

        return new EmendasDoParlamentarDto(
            Ano: alvo.Value,
            Empenhado: totais?.Empenhado ?? 0,
            Pago: totais?.Pago ?? 0,
            Quantidade: totais?.Quantidade ?? 0,
            PorDestino: [.. destinos.Select(d =>
                new EmendaPorDestinoDto(d.Localidade, d.Empenhado, d.Pago, d.Quantidade))],
            PorFuncao: [.. funcoes.Select(f =>
                new EmendaPorFuncaoDto(f.Funcao, f.Empenhado, f.Pago))]);
    }
}
