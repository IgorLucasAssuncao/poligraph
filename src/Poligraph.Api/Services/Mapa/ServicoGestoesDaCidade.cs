using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// As gestões de uma cidade: os prefeitos e governadores eleitos de cada período, e o pago a quem tem sede nela (Pendência 90, fase 4).
/// </summary>
/// <remarks>
/// <para>RISCO: o TSE dá quem foi eleito, não quem exerceu. Prefeito cassado, morto ou que renunciou continua na gestão para a qual foi eleito; a tela diz "eleito".</para>
/// <para>DECISÃO (autor, 2026-10-22): o vice eleito fica à vista, porque é quem assume no afastamento. No Rio, Witzel foi afastado em 2020 e cassado em 2021, e o vice Cláudio Castro governou. Quem exerceu de fato não tem fonte periódica nacional.</para>
/// <para>As contas da prefeitura (Siconfi) entram só nos anos declarados, e a gestão diz quantos foram: somar 2 de 4 anos como se fossem os 4 seria um número menor e errado.</para>
/// <para>DECISÃO: o dinheiro entra na gestão pelo ano do pagamento. A emenda é do parlamentar, e a tela diz "chegou durante", nunca "conseguiu".</para>
/// </remarks>
public class ServicoGestoesDaCidade(PoligraphDb db, ServicoMapaDeEmendas mapa, CacheDeLeitura leitura)
{
    private readonly PoligraphDb _db = db;
    private readonly ServicoMapaDeEmendas _mapa = mapa;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>A página da cidade. Nulo para código que não é município, e o endpoint responde 404.</summary>
    public Task<GestoesDaCidadeDto?> ObterAsync(CodigoIbge codigoIbge, CancellationToken ct) =>
        _leitura.ObterAsync(("gestoes", codigoIbge.Digitos), () => CalcularAsync(codigoIbge.Digitos, ct));

    private async Task<GestoesDaCidadeDto?> CalcularAsync(string codigoIbge, CancellationToken ct)
    {
        var municipio = await _db.Municipios.AsNoTracking()
            .Where(m => m.CodigoIbge == codigoIbge)
            .Select(m => new { Dto = new MunicipioDto(m.CodigoIbge, m.Nome, m.Uf), m.Populacao })
            .FirstOrDefaultAsync(ct);
        if (municipio is null)
        {
            return null;
        }

        var uf = municipio.Dto.Uf;
        var eleitos = await _db.Mandatos.AsNoTracking()
            .Where(m => (m.CodigoMunicipioIbge == codigoIbge && (m.Cargo == TipoCargo.PREFEITO || m.Cargo == TipoCargo.VICE_PREFEITO))
                     || (m.Uf == uf && (m.Cargo == TipoCargo.GOVERNADOR || m.Cargo == TipoCargo.VICE_GOVERNADOR)))
            .Join(_db.Pessoas.AsNoTracking(), m => m.PessoaId, p => p.Id, (m, p) => new EleitoComAnos(
                m.Cargo, m.PrimeiroAno, m.UltimoAno,
                new EleitoNaGestaoDto(p.Id, p.NomeExibicao, m.Partido, _db.Votos.Any(v => v.PessoaId == p.Id))))
            .ToListAsync(ct);

        var porAno = await _mapa.PagoPorAnoNaCidadeAsync(codigoIbge, ct);
        var contas = await _db.ContasDosMunicipios.AsNoTracking()
            .Where(c => c.CodigoIbge == codigoIbge)
            .Select(c => new { c.Ano, Receita = c.ReceitaBruta - c.Deducoes, c.DespesaPaga })
            .ToListAsync(ct);
        var governadores = eleitos.Where(e => e.Cargo == TipoCargo.GOVERNADOR).ToList();
        var viceGovernadores = eleitos.Where(e => e.Cargo == TipoCargo.VICE_GOVERNADOR).ToList();

        var gestoes = eleitos
            .Where(e => e.Cargo is TipoCargo.PREFEITO or TipoCargo.VICE_PREFEITO)
            .GroupBy(e => (e.PrimeiroAno, e.UltimoAno))
            .OrderByDescending(g => g.Key.PrimeiroAno)
            .Select(g =>
            {
                var (primeiro, ultimo) = g.Key;
                var anos = porAno.Where(a => a.Ano >= primeiro && a.Ano <= ultimo).ToList();
                var declarados = contas.Where(c => c.Ano >= primeiro && c.Ano <= ultimo).ToList();
                return new GestaoDaCidadeDto(
                    primeiro, ultimo,
                    [.. g.Where(e => e.Cargo == TipoCargo.PREFEITO).Select(e => e.Eleito)],
                    [.. g.Where(e => e.Cargo == TipoCargo.VICE_PREFEITO).Select(e => e.Eleito)],
                    NoPeriodo(governadores, primeiro, ultimo),
                    anos.Sum(a => a.Recebido),
                    anos.Sum(a => a.NaPrefeitura),
                    ComPagamento: anos.Count > 0,
                    Contas: declarados.Count == 0
                        ? null
                        : new ContasDaGestaoDto(declarados.Sum(c => c.Receita), declarados.Sum(c => c.DespesaPaga), declarados.Count, ultimo - primeiro + 1),
                    ViceGovernadores: NoPeriodo(viceGovernadores, primeiro, ultimo));
            })
            .ToList();

        return new GestoesDaCidadeDto(
            municipio.Dto, municipio.Populacao, porAno.Sum(a => a.Recebido), porAno.Sum(a => a.NaPrefeitura), gestoes, porAno);
    }

    /// <summary>Os eleitos para o estado cujo mandato cruza a gestão municipal, com os anos que coincidem.</summary>
    private static List<GovernadorNoPeriodoDto> NoPeriodo(IEnumerable<EleitoComAnos> eleitos, short primeiro, short ultimo) =>
        Juntar(eleitos
            .Where(e => e.PrimeiroAno <= ultimo && e.UltimoAno >= primeiro)
            .OrderBy(e => e.PrimeiroAno)
            .Select(e => new GovernadorNoPeriodoDto(e.Eleito, Math.Max(e.PrimeiroAno, primeiro), Math.Min(e.UltimoAno, ultimo))));

    /// <summary>Mandatos seguidos da mesma pessoa viram um período só: o governador reeleito aparece uma vez, de ponta a ponta.</summary>
    private static List<GovernadorNoPeriodoDto> Juntar(IEnumerable<GovernadorNoPeriodoDto> periodos)
    {
        var juntos = new List<GovernadorNoPeriodoDto>();
        foreach (var periodo in periodos)
        {
            if (juntos.Count > 0 && juntos[^1].Governador.IdPessoa == periodo.Governador.IdPessoa && juntos[^1].AteAno + 1 >= periodo.DeAno)
            {
                juntos[^1] = juntos[^1] with { AteAno = periodo.AteAno };
            }
            else
            {
                juntos.Add(periodo);
            }
        }

        return juntos;
    }

    private sealed record EleitoComAnos(TipoCargo Cargo, short PrimeiroAno, short UltimoAno, EleitoNaGestaoDto Eleito);
}
