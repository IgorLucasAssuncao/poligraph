using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// A linha do tempo de uma pessoa: o que a base já tem, posto num eixo por ano (Pendência 92).
/// </summary>
/// <remarks>
/// <para>MEDIDO em 2026-10-22, banco local: a mediana é de 2 marcos para quem só tem mandato no TSE e de 12 (em 7 anos) para parlamentar, com máximo de 41. Cabe numa lista só, sem detalhe sob demanda.</para>
/// <para>DECISÃO: cada marco é um resumo do ano, e a tela leva à aba que o detalha. Nenhum número novo: são os mesmos totais das abas.</para>
/// <para>As emendas trazem o empenhado, o mesmo número do cartão "Emendas de {ano}" do topo da ficha, e o pago ao lado (avaliação heurística U24, 2026-10-22: a linha do tempo mostrava só o pago, e a ficha só o empenhado).</para>
/// <para>A troca de partido sai do partido registrado em cada voto, na ordem das votações. É o mesmo critério do aviso "trocou de partido" (Pendência 63).</para>
/// </remarks>
public class ServicoLinhaDoTempo(PoligraphDb db, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>A linha do tempo. Nula para pessoa que não existe, e o endpoint responde 404.</summary>
    public Task<LinhaDoTempoDto?> ObterAsync(IdPessoa idPessoa, CancellationToken ct) =>
        _leitura.ObterAsync(("linha-do-tempo", idPessoa.Valor), () => CalcularAsync(idPessoa.Valor, ct));

    private async Task<LinhaDoTempoDto?> CalcularAsync(long idPessoa, CancellationToken ct)
    {
        if (!await _db.Pessoas.AnyAsync(p => p.Id == idPessoa, ct))
        {
            return null;
        }

        var marcos = new List<(int Ano, MarcoDto Marco)>();

        var mandatos = await (
                from m in _db.Mandatos.AsNoTracking().Where(m => m.PessoaId == idPessoa)
                join mu in _db.Municipios.AsNoTracking() on m.CodigoMunicipioIbge equals mu.CodigoIbge into municipios
                from mu in municipios.DefaultIfEmpty()
                select new { m.Cargo, m.AnoEleicao, m.PrimeiroAno, m.UltimoAno, m.Uf, m.Partido, Municipio = mu })
            .ToListAsync(ct);
        marcos.AddRange(mandatos.Select(m => ((int)m.AnoEleicao, new MarcoDto(TipoDeMarco.ELEITO, Mandato: new MandatoNoTseDto(
            m.Cargo, m.Cargo.Nivel(), m.AnoEleicao, m.PrimeiroAno, m.UltimoAno, m.Uf,
            m.Municipio is null ? null : new MunicipioDto(m.Municipio.CodigoIbge, m.Municipio.Nome, m.Municipio.Uf),
            m.Partido)))));

        var votos = await _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == idPessoa)
            .Select(v => new { v.Votacao!.Data, v.PartidoNoVoto })
            .OrderBy(v => v.Data)
            .ToListAsync(ct);
        marcos.AddRange(votos.GroupBy(v => v.Data.Year).Select(g => (g.Key, new MarcoDto(TipoDeMarco.VOTOU, Quantidade: g.Count()))));
        string? partido = null;
        foreach (var voto in votos)
        {
            if (partido is not null && voto.PartidoNoVoto != partido)
            {
                marcos.Add((voto.Data.Year, new MarcoDto(TipoDeMarco.TROCOU_DE_PARTIDO, Partido: voto.PartidoNoVoto, PartidoAnterior: partido)));
            }

            partido = voto.PartidoNoVoto;
        }

        var bens = await _db.Patrimonios.AsNoTracking()
            .Where(p => p.PessoaId == idPessoa)
            .GroupBy(p => p.AnoEleicao)
            .Select(g => new { Ano = g.Key, Valor = g.Sum(p => p.Valor), Quantidade = g.Sum(p => p.Quantidade) })
            .ToListAsync(ct);
        marcos.AddRange(bens.Select(b => ((int)b.Ano, new MarcoDto(TipoDeMarco.DECLAROU_BENS, Quantidade: b.Quantidade, Valor: b.Valor))));

        var cota = await _db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == idPessoa)
            .GroupBy(d => d.Ano)
            .Select(g => new { Ano = g.Key, Valor = g.Sum(d => d.ValorLiquido) })
            .ToListAsync(ct);
        marcos.AddRange(cota.Select(c => ((int)c.Ano, new MarcoDto(TipoDeMarco.GASTOU_NA_COTA, Valor: c.Valor))));

        var emendas = await _db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == idPessoa)
            .GroupBy(e => e.Ano)
            .Select(g => new { Ano = g.Key, Empenhado = g.Sum(e => e.ValorEmpenhado), Pago = g.Sum(e => e.ValorPago) })
            .ToListAsync(ct);
        marcos.AddRange(emendas.Where(e => e.Empenhado > 0 || e.Pago > 0)
            .Select(e => ((int)e.Ano, new MarcoDto(TipoDeMarco.EMENDAS_PAGAS, Valor: e.Empenhado, Pago: e.Pago))));

        return new LinhaDoTempoDto([.. marcos
            .GroupBy(m => m.Ano)
            .OrderByDescending(g => g.Key)
            .Select(g => new AnoNaLinhaDoTempoDto(g.Key, [.. g.Select(m => m.Marco).OrderBy(m => m.Tipo)]))]);
    }
}
