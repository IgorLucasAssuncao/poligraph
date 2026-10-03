using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// A reconciliação dos totais de emenda com o Portal, gravada pela ETL a cada carga (Pendência 81).
/// </summary>
/// <remarks>
/// <para>A API só lê: quem calcula é a carga, que tem o arquivo da fonte na mão. O <c>conferir</c> da ETL garante que fonte = base + motivos e que a base não mudou depois.</para>
/// </remarks>
public class ServicoReconciliacao(PoligraphDb db, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>As reconciliações dos anos pedidos, inclusive nas pontas. Sem período, todas.</summary>
    public Task<IReadOnlyList<ReconciliacaoDto>> ListarAsync(int? de, int? ate, CancellationToken ct) =>
        _leitura.ObterAsync(("reconciliacao", de, ate), () => CalcularAsync(de, ate, ct));

    private async Task<IReadOnlyList<ReconciliacaoDto>> CalcularAsync(int? de, int? ate, CancellationToken ct)
    {
        var consulta = _db.Reconciliacoes.AsNoTracking().Include(r => r.Motivos).AsQueryable();
        if (de is { } inicio)
        {
            consulta = consulta.Where(r => r.Ano >= inicio);
        }

        if (ate is { } fim)
        {
            consulta = consulta.Where(r => r.Ano <= fim);
        }

        var linhas = await consulta
            .OrderBy(r => r.Conjunto).ThenBy(r => r.Medida).ThenBy(r => r.Ano)
            .ToListAsync(ct);

        return [.. linhas.Select(r => new ReconciliacaoDto(
            r.Conjunto, r.Medida, r.Ano, r.TotalNaFonte, r.TotalNaBase, r.TotalInferido,
            [.. r.Motivos.OrderByDescending(m => m.Valor).Select(m => new MotivoDeForaDto(m.Motivo, m.Valor))]))];
    }
}
