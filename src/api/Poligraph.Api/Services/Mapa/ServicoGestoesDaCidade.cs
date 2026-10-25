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
/// <para>A mesma pessoa eleita duas vezes para a mesma gestão (eleição normal e suplementar no mesmo ano) aparece uma vez. MEDIDO em 2026-10-23: 83 casos, todos na mesma cidade.</para>
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
                m.Cargo, m.AnoEleicao, m.PrimeiroAno, m.UltimoAno,
                new EleitoNaGestaoDto(p.Id, p.NomeExibicao, m.Partido, _db.Votos.Any(v => v.PessoaId == p.Id))))
            .ToListAsync(ct);

        var porAno = await _mapa.PagoPorAnoNaCidadeAsync(codigoIbge, ct);
        var contas = await _db.ContasDosMunicipios.AsNoTracking()
            .Where(c => c.CodigoIbge == codigoIbge)
            .Select(c => new { c.Ano, Receita = c.ReceitaBruta - c.Deducoes, c.DespesaPaga })
            .ToListAsync(ct);
        var medianaDaReceita = Mediana([.. contas.Select(c => c.Receita).Where(r => r > 0)]);
        var governadores = eleitos.Where(e => e.Cargo == TipoCargo.GOVERNADOR).ToList();
        var viceGovernadores = eleitos.Where(e => e.Cargo == TipoCargo.VICE_GOVERNADOR).ToList();

        var municipais = eleitos.Where(e => e.Cargo is TipoCargo.PREFEITO or TipoCargo.VICE_PREFEITO).ToList();
        var ciclos = await CiclosDaCidadeAsync(municipais, ct);

        var gestoes = ciclos
            .Select(anoEleicao =>
            {
                var g = municipais.Where(e => e.AnoEleicao == anoEleicao).ToList();
                var (primeiro, ultimo) = ((short)(anoEleicao + 1), (short)(anoEleicao + 4));
                var anos = porAno.Where(a => a.Ano >= primeiro && a.Ano <= ultimo).ToList();
                var daGestao = contas.Where(c => c.Ano >= primeiro && c.Ano <= ultimo).ToList();
                var foraDoPadrao = daGestao.Where(c => ForaDoPadrao(c.Receita, medianaDaReceita)).ToList();
                var declarados = daGestao.Except(foraDoPadrao).ToList();
                return new GestaoDaCidadeDto(
                    primeiro, ultimo,
                    [.. g.Where(e => e.Cargo == TipoCargo.PREFEITO).Select(e => ComInicio(e, primeiro)).DistinctBy(e => e.IdPessoa)],
                    [.. g.Where(e => e.Cargo == TipoCargo.VICE_PREFEITO).Select(e => ComInicio(e, primeiro)).DistinctBy(e => e.IdPessoa)],
                    NoPeriodo(governadores, primeiro, ultimo),
                    anos.Sum(a => a.Recebido),
                    anos.Sum(a => a.NaPrefeitura),
                    ComPagamento: anos.Count > 0,
                    Contas: daGestao.Count == 0
                        ? null
                        : new ContasDaGestaoDto(
                            declarados.Sum(c => c.Receita), declarados.Sum(c => c.DespesaPaga), declarados.Count, ultimo - primeiro + 1,
                            [.. foraDoPadrao.OrderBy(c => c.Ano).Select(c => new AnoForaDoPadraoDto(c.Ano, c.Receita))]),
                    ViceGovernadores: NoPeriodo(viceGovernadores, primeiro, ultimo),
                    NoGovernoDoEstado: anos.Sum(a => a.NoGovernoDoEstado));
            })
            .ToList();

        return new GestoesDaCidadeDto(
            municipio.Dto, municipio.Populacao, porAno.Sum(a => a.Recebido), porAno.Sum(a => a.NaPrefeitura), gestoes, porAno,
            porAno.Sum(a => a.NoGovernoDoEstado));
    }

    /// <summary>
    /// As eleições municipais da cidade, da mais recente: as que elegeram alguém, e as que a base tem e a cidade não, entre a
    /// primeira dela e a última da base.
    /// </summary>
    /// <remarks>
    /// <para>DECISÃO (2026-10-24): a gestão sem eleito aparece, e a tela diz que o TSE não registra o eleito. MEDIDO no mesmo
    /// dia: 18 cidades em 2024 e 5 em 2020 tiveram a eleição anulada, e o vencedor da suplementar não está nos arquivos abertos
    /// do TSE. Antes da primeira eleição da cidade não: ela pode não existir ainda.</para>
    /// </remarks>
    private async Task<List<short>> CiclosDaCidadeAsync(List<EleitoComAnos> municipais, CancellationToken ct)
    {
        if (municipais.Count == 0)
        {
            return [];
        }

        var primeira = municipais.Min(e => e.AnoEleicao);
        var daBase = await _db.Mandatos.AsNoTracking()
            .Where(m => m.Cargo == TipoCargo.PREFEITO && m.AnoEleicao >= primeira)
            .Select(m => m.AnoEleicao)
            .Distinct()
            .ToListAsync(ct);
        return [.. daBase.Union(municipais.Select(e => e.AnoEleicao)).OrderDescending()];
    }

    /// <summary>O eleito com o ano em que começou, quando não foi o primeiro da gestão.</summary>
    private static EleitoNaGestaoDto ComInicio(EleitoComAnos eleito, short primeiroDaGestao) =>
        eleito.PrimeiroAno > primeiroDaGestao ? eleito.Eleito with { DesdeAno = eleito.PrimeiroAno } : eleito.Eleito;

    /// <summary>Os eleitos para o estado cujo mandato cruza a gestão municipal, com os anos que coincidem.</summary>
    private static List<GovernadorNoPeriodoDto> NoPeriodo(IEnumerable<EleitoComAnos> eleitos, short primeiro, short ultimo) =>
        Juntar(eleitos
            .Where(e => e.PrimeiroAno <= ultimo && e.UltimoAno >= primeiro)
            .OrderBy(e => e.PrimeiroAno)
            .Select(e => new GovernadorNoPeriodoDto(e.Eleito, Math.Max(e.PrimeiroAno, primeiro), Math.Min(e.UltimoAno, ultimo))));

    /// <summary>
    /// Vezes acima ou abaixo da mediana da própria cidade a partir das quais o ano declarado é tratado como erro de declaração.
    /// </summary>
    /// <remarks>
    /// <para>A mesma régua da regra <c>salto-de-receita-municipal</c> do <c>conferir</c> (ETL, <c>conferencia.py</c>). MEDIDO em 2026-10-22: a mediana de um ano para o seguinte é 1,17 vez, e 30 pares passam de 10 vezes; Varginha (MG) declarou R$ 11,8 bi em 2022, com R$ 646 mi no ano anterior.</para>
    /// <para>DECISÃO (regra 5 do projeto): o ano fora do padrão sai da soma e aparece com o valor declarado, para a pessoa conferir no Siconfi. Receita negativa também.</para>
    /// </remarks>
    private const decimal VezesForaDoPadrao = 10m;

    private static bool ForaDoPadrao(decimal receita, decimal? mediana) =>
        receita < 0 || (mediana is > 0 && receita > 0 && (receita / mediana >= VezesForaDoPadrao || mediana / receita >= VezesForaDoPadrao));

    private static decimal? Mediana(IReadOnlyList<decimal> valores)
    {
        if (valores.Count == 0)
        {
            return null;
        }

        var ordenados = valores.Order().ToList();
        var meio = ordenados.Count / 2;
        return ordenados.Count % 2 == 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
    }

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

    private sealed record EleitoComAnos(TipoCargo Cargo, short AnoEleicao, short PrimeiroAno, short UltimoAno, EleitoNaGestaoDto Eleito);
}
