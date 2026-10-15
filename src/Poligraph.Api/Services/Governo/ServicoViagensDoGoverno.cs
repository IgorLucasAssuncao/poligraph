using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>As viagens a serviço do Executivo federal, por período, órgão e destino.</summary>
/// <remarks>
/// <para>Lê o que a carga <c>viagens</c> gravou; nada é recalculado do arquivo.</para>
/// </remarks>
public class ServicoViagensDoGoverno(PoligraphDb db, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>Quantos destinos vão à tela em cada lista.</summary>
    public const int DestinosExibidos = 15;

    /// <summary>O nome com que o Portal publica o órgão das viagens protegidas por sigilo.</summary>
    public const string OrgaoSigiloso = "Sigiloso";

    /// <summary>O país dos destinos nacionais.</summary>
    public const string Brasil = "Brasil";

    /// <summary>Sem período, todos os anos carregados. Ponta fora dos anos é trazida para dentro. Sem dado, <c>null</c>.</summary>
    /// <remarks>
    /// <para>Com <paramref name="orgao"/>, só as viagens desse órgão superior, com o nome como o Portal publica.</para>
    /// </remarks>
    public Task<ViagensDoGovernoDto?> ObterAsync(Periodo<AnoDoOrcamento> periodoPedido, string? orgao, CancellationToken ct) =>
        _leitura.ObterAsync(("viagens", periodoPedido, orgao), () => CalcularAsync(periodoPedido, orgao, ct));

    private async Task<ViagensDoGovernoDto?> CalcularAsync(Periodo<AnoDoOrcamento> periodoPedido, string? orgao, CancellationToken ct)
    {
        var anos = await _db.ViagensDoOrgao.AsNoTracking().Select(v => (int)v.Ano).Distinct().OrderBy(a => a).ToListAsync(ct);
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

        var todos = await _db.ViagensDoOrgao.AsNoTracking().Where(v => v.Ano >= primeiro && v.Ano <= ultimo).ToListAsync(ct);
        var escolhido = orgao is not null && todos.Any(o => o.OrgaoSuperior == orgao) ? orgao : null;
        var orgaos = escolhido is null ? todos : [.. todos.Where(o => o.OrgaoSuperior == escolhido)];
        var destinos = await _db.DestinosDeViagem.AsNoTracking()
            .Where(d => d.Ano >= primeiro && d.Ano <= ultimo && (escolhido == null || d.OrgaoSuperior == escolhido))
            .GroupBy(d => new { d.Pais, d.Uf, d.Cidade })
            .Select(g => new DestinoDeViagemDto(g.Key.Pais, g.Key.Uf, g.Key.Cidade, g.Sum(d => d.Chegadas)))
            .ToListAsync(ct);

        return new ViagensDoGovernoDto(
            Periodo: new PeriodoDto(primeiro, ultimo),
            AnosDisponiveis: anos,
            GestoesDisponiveis: await GestoesDoPeriodo.ListarAsync(_db, anos[0], anos[^1], ct),
            Orgao: escolhido,
            Total: orgaos.Sum(Total),
            Diarias: orgaos.Sum(o => o.Diarias),
            Passagens: orgaos.Sum(o => o.Passagens),
            Restituicao: orgaos.Sum(o => o.Restituicao),
            Seguro: orgaos.Sum(o => o.Seguro),
            Viagens: orgaos.Sum(o => o.Viagens),
            Urgentes: orgaos.Sum(o => o.Urgentes),
            NaoRealizadas: orgaos.Sum(o => o.NaoRealizadas),
            Sigiloso: orgaos.Where(o => o.OrgaoSuperior == OrgaoSigiloso).Sum(Total),
            PagoComOrgaoSigiloso: orgaos.Sum(o => o.PagoComOrgaoSigiloso),
            PorAno: [.. orgaos.GroupBy(o => o.Ano).OrderBy(g => g.Key).Select(g => new ViagensNoAnoDto(
                g.Key, g.Sum(o => o.Diarias), g.Sum(o => o.Passagens), g.Sum(Total), g.Sum(o => o.Viagens)))],
            PorOrgao: [.. todos.GroupBy(o => o.OrgaoSuperior)
                .Select(g => new ViagensDoOrgaoDto(
                    g.Key, g.Sum(Total), g.Sum(o => o.Diarias), g.Sum(o => o.Passagens), g.Sum(o => o.Viagens), g.Sum(o => o.Urgentes)))
                .OrderByDescending(o => o.Total)],
            Destinos: [.. destinos.Where(d => d.Pais == Brasil).OrderByDescending(d => d.Chegadas).Take(DestinosExibidos)],
            DestinosNoExterior: [.. destinos.Where(d => d.Pais != Brasil && d.Uf is null).OrderByDescending(d => d.Chegadas).Take(DestinosExibidos)]);
    }

    /// <summary>Tudo o que foi pago pela viagem: diárias, passagens, restituição e seguro.</summary>
    private static decimal Total(ViagensDoOrgaoModel orgao) =>
        orgao.Diarias + orgao.Passagens + orgao.Restituicao + orgao.Seguro;
}
