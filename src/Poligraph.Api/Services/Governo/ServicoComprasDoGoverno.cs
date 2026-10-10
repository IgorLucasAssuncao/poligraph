using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>Os contratos do Executivo federal, por período, modalidade, órgão e contratado.</summary>
/// <remarks>
/// <para>Lê o que a carga <c>compras</c> gravou. O valor sigiloso sai da proporção de contratos sigilosos de cada linha, porque a carga soma o valor por órgão e modalidade.</para>
/// </remarks>
public class ServicoComprasDoGoverno(PoligraphDb db, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>Quantas linhas vão à tela nas listas de órgão e de contratado.</summary>
    public const int Exibidos = 15;

    /// <summary>Como o Portal publica o contrato sem modalidade.</summary>
    public const string SemInformacao = "Sem Informação";

    /// <summary>Sem período, todos os anos carregados. Sem dado, <c>null</c>.</summary>
    public Task<ComprasDoGovernoDto?> ObterAsync(Periodo<AnoDoOrcamento> periodoPedido, CancellationToken ct) =>
        _leitura.ObterAsync(("compras", periodoPedido), () => CalcularAsync(periodoPedido, ct));

    private async Task<ComprasDoGovernoDto?> CalcularAsync(Periodo<AnoDoOrcamento> periodoPedido, CancellationToken ct)
    {
        var anos = await _db.ContratacoesDoOrgao.AsNoTracking().Select(c => (int)c.Ano).Distinct().OrderBy(a => a).ToListAsync(ct);
        if (anos.Count == 0)
        {
            return null;
        }

        var primeiro = Math.Clamp(periodoPedido.Primeiro?.Valor ?? anos[0], anos[0], anos[^1]);
        var ultimo = Math.Clamp(periodoPedido.Ultimo?.Valor ?? anos[^1], anos[0], anos[^1]);
        if (primeiro > ultimo)
        {
            (primeiro, ultimo) = (ultimo, primeiro);
        }

        var linhas = await _db.ContratacoesDoOrgao.AsNoTracking().Where(c => c.Ano >= primeiro && c.Ano <= ultimo).ToListAsync(ct);
        var contratados = await _db.ContratadosDoGoverno.AsNoTracking()
            .Where(c => c.Ano >= primeiro && c.Ano <= ultimo)
            .GroupBy(c => c.Cnpj)
            .Select(g => new { Cnpj = g.Key, Nome = g.Max(c => c.Nome), Contratos = g.Sum(c => c.Contratos), Valor = g.Sum(c => c.Valor) })
            .OrderByDescending(c => c.Valor)
            .Take(Exibidos)
            .ToListAsync(ct);

        return new ComprasDoGovernoDto(
            Periodo: new PeriodoDto(primeiro, ultimo),
            AnosDisponiveis: anos,
            Contratos: linhas.Sum(l => l.Contratos),
            Valor: linhas.Sum(l => l.Valor),
            Sigilosos: linhas.Sum(l => l.Sigilosos),
            ValorSigiloso: linhas.Sum(ParteSigilosa),
            SemModalidade: linhas.Where(l => l.Modalidade == SemInformacao).Sum(l => l.Valor),
            Divergentes: linhas.Sum(l => l.Divergentes),
            ValorDescartado: linhas.Sum(l => l.ValorDescartado),
            PorAno: [.. linhas.GroupBy(l => l.Ano).OrderBy(g => g.Key)
                .Select(g => new ComprasNoAnoDto(g.Key, g.Sum(l => l.Contratos), g.Sum(l => l.Valor)))],
            PorModalidade: [.. linhas.GroupBy(l => l.Modalidade)
                .Select(g => new ComprasPorModalidadeDto(g.Key, g.Sum(l => l.Contratos), g.Sum(l => l.Valor)))
                .OrderByDescending(m => m.Valor)],
            PorOrgao: [.. linhas.GroupBy(l => l.OrgaoSuperior)
                .Select(g => new ComprasDoOrgaoDto(g.Key, g.Sum(l => l.Contratos), g.Sum(l => l.Valor), g.Sum(l => l.Sigilosos)))
                .OrderByDescending(o => o.Valor).Take(Exibidos)],
            Contratados: [.. contratados.Select(c => new ContratadoDto(c.Cnpj, c.Nome ?? "", c.Contratos, c.Valor))]);
    }

    /// <summary>
    /// A parte do valor da linha que é de contrato sigiloso. Exata quando a linha é toda sigilosa ou toda aberta,
    /// e proporcional ao número de contratos quando mistura os dois.
    /// </summary>
    private static decimal ParteSigilosa(ContratacoesDoOrgaoModel linha) =>
        linha.Contratos == 0 ? 0 : linha.Valor * linha.Sigilosos / linha.Contratos;
}
