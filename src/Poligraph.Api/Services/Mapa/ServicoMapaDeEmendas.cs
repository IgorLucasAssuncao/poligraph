using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O dinheiro de emenda no mapa: por UF, por município, e quem o mandou para cada cidade.
/// </summary>
/// <remarks>
/// <para>
/// A cidade é a da sede de quem recebeu, pela cadeia CNPJ → TOM → IBGE, toda por chave
/// forte — nenhum nome ou UF é casado por texto. O ano é o da emenda, e não o do pagamento:
/// a pergunta é "que emendas de 2025 chegaram aqui", paga quando fosse.
/// </para>
/// <para>
/// Tudo recebe um período, "de" e "até". Sem período, todos os anos carregados: a pergunta
/// "quem mandou dinheiro para a minha cidade" se responde pela legislatura, não por um ano.
/// </para>
/// </remarks>
public class ServicoMapaDeEmendas(PoligraphDb db, IMemoryCache cache, ServicoAutoresDeEmenda autores, CacheDeLeitura leitura)
{
    public const int ItensPorPagina = 10;

    /// <summary>A única situação em que o convênio ainda recebe dinheiro — como o Portal a escreve.</summary>
    public const string SituacaoEmExecucao = "EM EXECUÇÃO";

    private const int ResultadosDaBusca = 10;

    private static readonly TimeSpan ValidadeDosMunicipios = CacheDeLeitura.Validade;

    /// <summary>O dado só muda quando o ETL roda; 10 minutos bastam para as páginas de uma visita.</summary>
    private static readonly TimeSpan ValidadeDaCidade = CacheDeLeitura.Validade;
    private static readonly CompareInfo Comparacao = CultureInfo.GetCultureInfo("pt-BR").CompareInfo;

    /// <summary>
    /// As naturezas jurídicas da administração municipal: nelas a sede é a própria cidade.
    /// </summary>
    /// <remarks>
    /// <para>Os textos são os do cadastro da Receita, como o Portal os publica. Em 2023–2026, as duas primeiras somam 74,9% do pago a pessoa jurídica; as outras, R$ 31 mi.</para>
    /// </remarks>
    private static readonly string[] NaturezasDaCidade =
    [
        "Município",
        "Fundo Público da Administração Direta Municipal",
        "Órgão Público do Poder Executivo Municipal",
        "Autarquia Municipal",
        "Fundação Pública de Direito Público Municipal",
        "Fundação Pública de Direito Privado Municipal",
    ];

    private readonly PoligraphDb _db = db;
    private readonly IMemoryCache _cache = cache;
    private readonly ServicoAutoresDeEmenda _autores = autores;
    private readonly CacheDeLeitura _leitura = leitura;

    public async Task<MapaDoBrasilDto> ObterBrasilAsync(int? de, int? ate, CancellationToken ct)
    {
        var (periodo, anos, prefixos) = await PeriodoAsync(de, ate, ct);
        if (prefixos.Length == 0) return new MapaDoBrasilDto(periodo, anos, 0, 0, 0, 0, []);

        return await _cache.GetOrCreateAsync($"mapa:brasil:{periodo.De}-{periodo.Ate}", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaCidade;

            var doPeriodo = DoPeriodo(prefixos);
            var totais = await doPeriodo
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Recebido = g.Sum(f => f.Valor),
                    ViaIntermediario = g.Where(f => f.Intermediario).Sum(f => f.Valor)
                })
                .FirstOrDefaultAsync(ct);

            var porUf = await NoMapa(doPeriodo)
                .GroupBy(p => p.Uf)
                .Select(g => new
                {
                    Uf = g.Key,
                    CodigoUf = g.Min(p => p.CodigoIbge)!.Substring(0, 2),
                    Recebido = g.Sum(p => p.Valor),
                    Municipios = g.Select(p => p.CodigoIbge).Distinct().Count()
                })
                .OrderBy(u => u.CodigoUf)
                .ToListAsync(ct);

            var recebido = totais?.Recebido ?? 0;
            var viaIntermediario = totais?.ViaIntermediario ?? 0;
            var noMapa = porUf.Sum(u => u.Recebido);

            return new MapaDoBrasilDto(
                periodo, anos, recebido, noMapa, viaIntermediario,
                SemSede: recebido - noMapa - viaIntermediario,
                [.. porUf.Select(u => new RecebidoNaUfDto(u.Uf, u.CodigoUf, u.Recebido, u.Municipios))]);
        }) ?? new MapaDoBrasilDto(periodo, anos, 0, 0, 0, 0, []);
    }

    /// <remarks>
    /// <para>Traz TODAS as cidades da UF, com zero onde nada chegou: o mapa mostra o nome de cada uma sob o mouse, e cidade sem pagamento também é informação.</para>
    /// </remarks>
    public Task<MapaDoEstadoDto> ObterEstadoAsync(string uf, int? de, int? ate, CancellationToken ct) =>
        _leitura.ObterAsync(("mapa:estado", uf.ToUpperInvariant(), de, ate), () => CalcularEstadoAsync(uf, de, ate, ct));

    /// <summary>A busca "sua cidade", sem caixa e sem acento. O resultado é o código IBGE.</summary>
    /// <remarks>
    /// <para>A busca por nome serve para a pessoa ACHAR a cidade; a partir da escolha, tudo segue pelo código.</para>
    /// </remarks>
    public async Task<IReadOnlyList<MunicipioDto>> BuscarAsync(string? busca, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(busca)) return [];

        var termo = busca.Trim();
        var opcoes = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;

        return [.. (await MunicipiosAsync(ct))
            .Select(m => new { Municipio = m, Posicao = Comparacao.IndexOf(m.Nome, termo, opcoes) })
            .Where(m => m.Posicao >= 0)
            .OrderBy(m => m.Posicao == 0 ? 0 : 1)
            .ThenBy(m => m.Municipio.Nome, Comparacao.GetStringComparer(CompareOptions.IgnoreCase))
            .Take(ResultadosDaBusca)
            .Select(m => m.Municipio)];
    }

    /// <summary>Quem mandou dinheiro de emenda para a cidade no ano, e quem o recebeu lá.</summary>
    /// <remarks>
    /// <para>Devolve <c>null</c> para código IBGE inexistente, e o endpoint responde 404.</para>
    /// </remarks>
    public async Task<EmendasDoMunicipioDto?> ObterMunicipioAsync(
        string codigoIbge, int? de, int? ate, CancellationToken ct)
    {
        var cidade = await CidadeAsync(codigoIbge, de, ate, ct);
        if (cidade is null) return null;

        return new EmendasDoMunicipioDto(
            cidade.Municipio, cidade.Periodo, cidade.AnosDisponiveis, cidade.Recebido, cidade.NaPropriaCidade,
            DeParlamentares: cidade.Parlamentares.Sum(p => p.Recebido),
            Parlamentares: Paginar(cidade.Parlamentares, 1),
            Coletivos: cidade.Coletivos,
            Favorecidos: Paginar(cidade.Favorecidos, 1),
            Convenios: ResumoDosConvenios(cidade.Convenios, 1));
    }

    /// <summary>Os convênios da cidade, em páginas. A primeira é a do painel.</summary>
    public async Task<ConveniosDaCidadeDto?> ListarConveniosAsync(
        string codigoIbge, int? de, int? ate, int pagina, CancellationToken ct) =>
        await CidadeAsync(codigoIbge, de, ate, ct) is { } cidade ? ResumoDosConvenios(cidade.Convenios, pagina) : null;

    private static ConveniosDaCidadeDto ResumoDosConvenios(IReadOnlyList<ConvenioDaCidadeDto> convenios, int pagina)
    {
        var emExecucao = convenios.Where(EmExecucao).ToList();
        return new ConveniosDaCidadeDto(
            convenios.Count,
            emExecucao.Count,
            convenios.Sum(c => c.Valor),
            convenios.Sum(c => c.ValorLiberado ?? 0),
            emExecucao.Sum(c => Math.Max(c.Valor - (c.ValorLiberado ?? 0), 0)),
            Paginar(convenios, pagina));
    }

    private static bool EmExecucao(ConvenioDaCidadeDto convenio) =>
        string.Equals(convenio.Situacao, SituacaoEmExecucao, StringComparison.OrdinalIgnoreCase);

    /// <summary>Os deputados e senadores que mandaram dinheiro para a cidade, em páginas. A primeira é a do painel.</summary>
    public async Task<PaginaDto<ParlamentarQueMandouDto>?> ListarParlamentaresAsync(
        string codigoIbge, int? de, int? ate, int pagina, CancellationToken ct) =>
        await CidadeAsync(codigoIbge, de, ate, ct) is { } cidade ? Paginar(cidade.Parlamentares, pagina) : null;

    /// <summary>Quem recebeu na cidade, em páginas. A primeira é a do painel.</summary>
    public async Task<PaginaDto<FavorecidoDaEmendaDto>?> ListarFavorecidosAsync(
        string codigoIbge, int? de, int? ate, int pagina, CancellationToken ct) =>
        await CidadeAsync(codigoIbge, de, ate, ct) is { } cidade ? Paginar(cidade.Favorecidos, pagina) : null;

    private async Task<MapaDoEstadoDto> CalcularEstadoAsync(string uf, int? de, int? ate, CancellationToken ct)
    {
        var (periodo, _, prefixos) = await PeriodoAsync(de, ate, ct);
        uf = uf.ToUpperInvariant();
        if (prefixos.Length == 0) return new MapaDoEstadoDto(uf, periodo, 0, []);

        var recebido = await NoMapa(DoPeriodo(prefixos))
            .Where(p => p.Uf == uf)
            .GroupBy(p => p.CodigoIbge)
            .Select(g => new { CodigoIbge = g.Key, Recebido = g.Sum(p => p.Valor) })
            .ToDictionaryAsync(m => m.CodigoIbge, m => m.Recebido, ct);

        var porMunicipio = (await MunicipiosAsync(ct))
            .Where(m => m.Uf == uf)
            .Select(m => new RecebidoNoMunicipioDto(m.CodigoIbge, m.Nome, recebido.GetValueOrDefault(m.CodigoIbge)))
            .OrderByDescending(m => m.Recebido)
            .ThenBy(m => m.Nome, StringComparer.Create(CultureInfo.GetCultureInfo("pt-BR"), ignoreCase: true))
            .ToList();

        return new MapaDoEstadoDto(uf, periodo, recebido.Values.Sum(), porMunicipio);
    }

    /// <summary>Os anos das emendas que têm pagamento registrado. Em cache: é a mesma lista em toda chamada.</summary>
    private async Task<IReadOnlyList<int>> AnosAsync(CancellationToken ct) =>
        await _cache.GetOrCreateAsync("mapa:anos", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaCidade;
            var prefixos = await _db.EmendasFavorecidos.AsNoTracking()
                .Select(f => f.CodigoEmenda.Substring(0, 4))
                .Distinct()
                .ToListAsync(ct);

            return (IReadOnlyList<int>)[.. prefixos.Select(p => int.Parse(p, CultureInfo.InvariantCulture)).Order()];
        }) ?? [];

    /// <summary>
    /// O período pedido, contido nos anos que existem. Sem ponta, a ponta dos anos
    /// carregados; ponta invertida é desinvertida, não recusada.
    /// </summary>
    /// <remarks>
    /// <para><c>Prefixos</c> são os anos do período como texto: o ano da emenda são os quatro primeiros dígitos do código dela.</para>
    /// </remarks>
    private async Task<(PeriodoDto Periodo, IReadOnlyList<int> Anos, string[] Prefixos)> PeriodoAsync(
        int? de, int? ate, CancellationToken ct)
    {
        var anos = await AnosAsync(ct);
        if (anos.Count == 0) return (new PeriodoDto(0, 0), anos, []);

        var inicio = Math.Clamp(de ?? anos[0], anos[0], anos[^1]);
        var fim = Math.Clamp(ate ?? anos[^1], anos[0], anos[^1]);
        if (inicio > fim) (inicio, fim) = (fim, inicio);

        var prefixos = anos
            .Where(a => a >= inicio && a <= fim)
            .Select(a => a.ToString(CultureInfo.InvariantCulture))
            .ToArray();

        return (new PeriodoDto(inicio, fim), anos, prefixos);
    }

    private IQueryable<EmendaFavorecidoModel> DoPeriodo(string[] prefixos) =>
        _db.EmendasFavorecidos.AsNoTracking().Where(f => prefixos.Contains(f.CodigoEmenda.Substring(0, 4)));

    /// <summary>
    /// Os pagamentos que o mapa localiza: pessoa jurídica fora do intermediário, com a sede
    /// ligada por CNPJ ao município.
    /// </summary>
    private IQueryable<PagamentoLocalizado> NoMapa(IQueryable<EmendaFavorecidoModel> pagamentos) =>
        from f in pagamentos
        where f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
        join c in _db.CnpjsMunicipio on f.Documento equals c.Cnpj
        join m in _db.Municipios on c.CodigoIbge equals m.CodigoIbge
        select new PagamentoLocalizado
        {
            CodigoEmenda = f.CodigoEmenda,
            Documento = f.Documento!,
            NomeDoFavorecido = f.Nome,
            NaturezaJuridica = f.NaturezaJuridica,
            Valor = f.Valor,
            CodigoIbge = m.CodigoIbge,
            Nome = m.Nome,
            Uf = m.Uf
        };

    private async Task<IReadOnlyList<MunicipioDto>> MunicipiosAsync(CancellationToken ct) =>
        await _cache.GetOrCreateAsync("municipios", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDosMunicipios;
            return (IReadOnlyList<MunicipioDto>)await _db.Municipios.AsNoTracking()
                .Select(m => new MunicipioDto(m.CodigoIbge, m.Nome, m.Uf))
                .ToListAsync(ct);
        }) ?? [];

    /// <summary>
    /// A cidade num ano, calculada inteira uma vez e guardada: as páginas das listas leem daqui.
    /// </summary>
    private async Task<CidadeCalculada?> CidadeAsync(string codigoIbge, int? de, int? ate, CancellationToken ct)
    {
        var municipio = (await MunicipiosAsync(ct)).FirstOrDefault(m => m.CodigoIbge == codigoIbge);
        if (municipio is null) return null;

        var (periodo, anos, prefixos) = await PeriodoAsync(de, ate, ct);

        return await _cache.GetOrCreateAsync($"mapa:cidade:{codigoIbge}:{periodo.De}-{periodo.Ate}", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaCidade;
            return await CalcularCidadeAsync(municipio, periodo, anos, prefixos, ct);
        });
    }

    private async Task<CidadeCalculada> CalcularCidadeAsync(
        MunicipioDto municipio, PeriodoDto periodo, IReadOnlyList<int> anos, string[] prefixos, CancellationToken ct)
    {
        var naCidade = NoMapa(DoPeriodo(prefixos)).Where(p => p.CodigoIbge == municipio.CodigoIbge);

        var porEmenda = await naCidade
            .GroupBy(p => p.CodigoEmenda)
            .Select(g => new { Codigo = g.Key, Recebido = g.Sum(p => p.Valor) })
            .ToListAsync(ct);

        var favorecidos = await naCidade
            .GroupBy(p => p.Documento)
            .Select(g => new
            {
                Cnpj = g.Key,
                Nome = g.Max(p => p.NomeDoFavorecido)!,
                NaturezaJuridica = g.Max(p => p.NaturezaJuridica),
                Recebido = g.Sum(p => p.Valor)
            })
            .OrderByDescending(f => f.Recebido)
            .ToListAsync(ct);

        var naPropriaCidade = await naCidade
            .Where(p => NaturezasDaCidade.Contains(p.NaturezaJuridica))
            .SumAsync(p => p.Valor, ct);

        var (parlamentares, coletivos) = await _autores.AgruparAsync([.. porEmenda.Select(e => (e.Codigo, e.Recebido))], ct);
        var convenios = await ConveniosDaCidadeAsync(municipio.CodigoIbge, prefixos, ct);

        return new CidadeCalculada(
            municipio, periodo, anos, porEmenda.Sum(e => e.Recebido), naPropriaCidade, parlamentares, coletivos,
            convenios,
            [.. favorecidos.Select(f =>
                new FavorecidoDaEmendaDto(
                    TextoSemCpf.Limpar(f.Nome), f.NaturezaJuridica, municipio.Uf, municipio.Nome, f.Recebido,
                    FavorecidoDaEmendaDto.CnpjPublico(f.Cnpj, f.NaturezaJuridica)))]);
    }

    /// <summary>
    /// Os convênios de quem tem sede na cidade, financiados por emendas do período.
    /// </summary>
    /// <remarks>
    /// <para>Em execução primeiro, pelo que ainda falta liberar; depois os demais, pelo valor. É a ordem da pergunta de quem acompanha: o que ainda vai chegar.</para>
    /// </remarks>
    private async Task<IReadOnlyList<ConvenioDaCidadeDto>> ConveniosDaCidadeAsync(
        string codigoIbge, string[] prefixos, CancellationToken ct)
    {
        var cnpjs = _db.CnpjsMunicipio.Where(c => c.CodigoIbge == codigoIbge).Select(c => c.Cnpj);
        var numeros = _db.EmendasConvenios
            .Where(e => prefixos.Contains(e.CodigoEmenda.Substring(0, 4)))
            .Select(e => e.NumeroConvenio);

        var convenios = await _db.Convenios.AsNoTracking()
            .Where(c => c.CnpjConvenente != null && cnpjs.Contains(c.CnpjConvenente) && numeros.Contains(c.Numero))
            .ToListAsync(ct);

        return [.. convenios
            .Select(c => new ConvenioDaCidadeDto(
                c.Numero, c.Objeto, TextoSemCpf.Limpar(c.Convenente), c.CnpjConvenente!, c.Situacao, c.DataPublicacao,
                c.Valor, c.ValorLiberado, FontesOficiais.Convenio(c.Numero)))
            .OrderBy(c => EmExecucao(c) ? 0 : 1)
            .ThenByDescending(c => EmExecucao(c) ? c.Valor - (c.ValorLiberado ?? 0) : c.Valor)];
    }

    private static PaginaDto<T> Paginar<T>(IReadOnlyList<T> itens, int pagina)
    {
        pagina = Math.Max(pagina, 1);
        return new PaginaDto<T>(
            [.. itens.Skip((pagina - 1) * ItensPorPagina).Take(ItensPorPagina)], pagina, ItensPorPagina, itens.Count);
    }

    private sealed record CidadeCalculada(
        MunicipioDto Municipio,
        PeriodoDto Periodo,
        IReadOnlyList<int> AnosDisponiveis,
        decimal Recebido,
        decimal NaPropriaCidade,
        IReadOnlyList<ParlamentarQueMandouDto> Parlamentares,
        IReadOnlyList<ColetivoQueMandouDto> Coletivos,
        IReadOnlyList<ConvenioDaCidadeDto> Convenios,
        IReadOnlyList<FavorecidoDaEmendaDto> Favorecidos);

    /// <summary>Projeção do EF para o pagamento com a sede já ligada ao município.</summary>
    private sealed class PagamentoLocalizado
    {
        public required string CodigoEmenda { get; init; }
        public required string Documento { get; init; }
        public string? NomeDoFavorecido { get; init; }
        public string? NaturezaJuridica { get; init; }
        public decimal Valor { get; init; }
        public required string CodigoIbge { get; init; }
        public required string Nome { get; init; }
        public required string Uf { get; init; }
    }
}
