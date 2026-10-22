using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Tipos;
using Poligraph.Api.Constantes;

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

    /// <summary>As naturezas jurídicas da administração municipal: nelas a sede é a própria cidade.</summary>
    private static readonly string[] NaturezasDaCidade = [.. VocabularioDasFontes.NaturezasDaCidade];

    private readonly PoligraphDb _db = db;
    private readonly IMemoryCache _cache = cache;
    private readonly ServicoAutoresDeEmenda _autores = autores;
    private readonly CacheDeLeitura _leitura = leitura;

    public async Task<MapaDoBrasilDto> ObterBrasilAsync(Periodo<AnoDaEmenda> periodoPedido, CancellationToken ct)
    {
        var (periodoMostrado, anosDaEmendaCarregados, prefixosDoCodigoDaEmenda) = await PeriodoAsync(periodoPedido, ct);
        if (prefixosDoCodigoDaEmenda.Length == 0)
        {
            return new MapaDoBrasilDto(periodoMostrado, anosDaEmendaCarregados, 0, 0, 0, 0, []);
        }

        return await _cache.GetOrCreateAsync($"mapa:brasil:{periodoMostrado.PrimeiroAno}-{periodoMostrado.UltimoAno}", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaCidade;

            var doPeriodo = DoPeriodo(prefixosDoCodigoDaEmenda);
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
            var (populacoes, anoDaPopulacao) = await PopulacoesAsync(ct);
            var porUfPopulacao = (await MunicipiosAsync(ct))
                .Where(m => populacoes.ContainsKey(m.CodigoIbge))
                .GroupBy(m => m.Uf)
                .ToDictionary(g => g.Key, g => g.Sum(m => (long)populacoes[m.CodigoIbge]));

            return new MapaDoBrasilDto(
                periodoMostrado, anosDaEmendaCarregados, recebido, noMapa, viaIntermediario,
                SemSede: recebido - noMapa - viaIntermediario,
                [.. porUf.Select(u => new RecebidoNaUfDto(
                    u.Uf, u.CodigoUf, u.Recebido, u.Municipios,
                    porUfPopulacao.TryGetValue(u.Uf, out var p) ? p : null))],
                anoDaPopulacao,
                await PorAnoAsync(anosDaEmendaCarregados, ct));
        }) ?? new MapaDoBrasilDto(periodoMostrado, anosDaEmendaCarregados, 0, 0, 0, 0, []);
    }

    /// <summary>O recebido de cada ano da emenda carregado, para o gráfico de colunas da página.</summary>
    private async Task<IReadOnlyList<RecebidoNoAnoDaEmendaDto>> PorAnoAsync(IReadOnlyList<int> anosDaEmendaCarregados, CancellationToken ct)
    {
        var prefixos = anosDaEmendaCarregados.Select(a => a.ToString(CultureInfo.InvariantCulture)).ToArray();
        var porAno = await DoPeriodo(prefixos)
            .GroupBy(f => f.CodigoEmenda.Substring(0, 4))
            .Select(g => new { Ano = g.Key, Recebido = g.Sum(f => f.Valor) })
            .ToListAsync(ct);
        return [.. porAno
            .Select(a => new RecebidoNoAnoDaEmendaDto(int.Parse(a.Ano, CultureInfo.InvariantCulture), a.Recebido))
            .OrderBy(a => a.AnoDaEmenda)];
    }

    /// <remarks>
    /// <para>Traz TODAS as cidades da UF, com zero onde nada chegou: o mapa mostra o nome de cada uma sob o mouse, e cidade sem pagamento também é informação.</para>
    /// </remarks>
    public Task<MapaDoEstadoDto> ObterEstadoAsync(Uf uf, Periodo<AnoDaEmenda> periodoPedido, CancellationToken ct) =>
        _leitura.ObterAsync(("mapa:estado", uf.Sigla, periodoPedido), () => CalcularEstadoAsync(uf.Sigla, periodoPedido, ct));

    /// <summary>A busca "sua cidade", sem caixa e sem acento. O resultado é o código IBGE.</summary>
    /// <remarks>
    /// <para>A busca por nome serve para a pessoa ACHAR a cidade; a partir da escolha, tudo segue pelo código.</para>
    /// </remarks>
    public async Task<IReadOnlyList<MunicipioDto>> BuscarAsync(string? busca, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(busca))
        {
            return [];
        }

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
        CodigoIbge codigoIbge, Periodo<AnoDaEmenda> periodoPedido, CancellationToken ct)
    {
        var cidade = await CidadeAsync(codigoIbge.Digitos, periodoPedido, ct);
        if (cidade is null)
        {
            return null;
        }

        return new EmendasDoMunicipioDto(
            cidade.Municipio, cidade.Periodo, cidade.AnosDisponiveis, cidade.Recebido, cidade.NaPropriaCidade,
            DeParlamentares: cidade.Parlamentares.Sum(p => p.Recebido),
            Parlamentares: Paginar(cidade.Parlamentares, 1),
            Coletivos: cidade.Coletivos,
            Favorecidos: Paginar(cidade.Favorecidos, 1),
            Convenios: ResumoDosConvenios(cidade.Convenios, 1));
    }

    /// <summary>O pago a quem tem sede na cidade, pelo ano do pagamento (`competencia`), com a parte da prefeitura. A regra do mapa, sem recorte de período.</summary>
    /// <remarks>
    /// <para>O ano é o do pagamento, não o da emenda: é o que diz em que gestão o dinheiro chegou (Pendência 90, fase 4).</para>
    /// </remarks>
    public async Task<IReadOnlyList<PagoNoAnoDto>> PagoPorAnoNaCidadeAsync(string codigoIbge, CancellationToken ct) =>
        [.. (await NoMapa(_db.EmendasFavorecidos.AsNoTracking())
                .Where(p => p.CodigoIbge == codigoIbge)
                .GroupBy(p => p.Competencia.Year)
                .Select(g => new
                {
                    Ano = g.Key,
                    Recebido = g.Sum(p => p.Valor),
                    NaPrefeitura = g.Where(p => NaturezasDaCidade.Contains(p.NaturezaJuridica)).Sum(p => p.Valor),
                })
                .ToListAsync(ct))
            .OrderBy(a => a.Ano)
            .Select(a => new PagoNoAnoDto(a.Ano, a.Recebido, a.NaPrefeitura))];

    /// <summary>Os convênios da cidade, em páginas. A primeira é a do painel.</summary>
    public async Task<ConveniosDaCidadeDto?> ListarConveniosAsync(
        CodigoIbge codigoIbge, Periodo<AnoDaEmenda> periodoPedido, int pagina, CancellationToken ct) =>
        await CidadeAsync(codigoIbge.Digitos, periodoPedido, ct) is { } cidade ? ResumoDosConvenios(cidade.Convenios, pagina) : null;

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
        CodigoIbge codigoIbge, Periodo<AnoDaEmenda> periodoPedido, int pagina, CancellationToken ct) =>
        await CidadeAsync(codigoIbge.Digitos, periodoPedido, ct) is { } cidade ? Paginar(cidade.Parlamentares, pagina) : null;

    /// <summary>Quem recebeu na cidade, em páginas. A primeira é a do painel.</summary>
    public async Task<PaginaDto<FavorecidoDaEmendaDto>?> ListarFavorecidosAsync(
        CodigoIbge codigoIbge, Periodo<AnoDaEmenda> periodoPedido, int pagina, CancellationToken ct) =>
        await CidadeAsync(codigoIbge.Digitos, periodoPedido, ct) is { } cidade ? Paginar(cidade.Favorecidos, pagina) : null;

    private async Task<MapaDoEstadoDto> CalcularEstadoAsync(string siglaDaUf, Periodo<AnoDaEmenda> periodoPedido, CancellationToken ct)
    {
        var (periodoMostrado, _, prefixosDoCodigoDaEmenda) = await PeriodoAsync(periodoPedido, ct);
        if (prefixosDoCodigoDaEmenda.Length == 0)
        {
            return new MapaDoEstadoDto(siglaDaUf, periodoMostrado, 0, []);
        }

        var recebido = await NoMapa(DoPeriodo(prefixosDoCodigoDaEmenda))
            .Where(p => p.Uf == siglaDaUf)
            .GroupBy(p => p.CodigoIbge)
            .Select(g => new { CodigoIbge = g.Key, Recebido = g.Sum(p => p.Valor) })
            .ToDictionaryAsync(m => m.CodigoIbge, m => m.Recebido, ct);

        var (populacoes, _) = await PopulacoesAsync(ct);
        var porMunicipio = (await MunicipiosAsync(ct))
            .Where(m => m.Uf == siglaDaUf)
            .Select(m => new RecebidoNoMunicipioDto(
                m.CodigoIbge, m.Nome, recebido.GetValueOrDefault(m.CodigoIbge),
                populacoes.TryGetValue(m.CodigoIbge, out var p) ? p : null))
            .OrderByDescending(m => m.Recebido)
            .ThenBy(m => m.Nome, StringComparer.Create(CultureInfo.GetCultureInfo("pt-BR"), ignoreCase: true))
            .ToList();

        return new MapaDoEstadoDto(siglaDaUf, periodoMostrado, recebido.Values.Sum(), porMunicipio);
    }

    /// <summary>Os anos das emendas que têm pagamento registrado. Em cache: é a mesma lista em toda chamada.</summary>
    private async Task<IReadOnlyList<int>> AnosAsync(CancellationToken ct) =>
        await _cache.GetOrCreateAsync("mapa:anos", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaCidade;
            var prefixosDoCodigoDaEmenda = await _db.EmendasFavorecidos.AsNoTracking()
                .Select(f => f.CodigoEmenda.Substring(0, 4))
                .Distinct()
                .ToListAsync(ct);

            return (IReadOnlyList<int>)[.. prefixosDoCodigoDaEmenda.Select(p => int.Parse(p, CultureInfo.InvariantCulture)).Order()];
        }) ?? [];

    /// <summary>
    /// O período pedido, contido nos anos que existem. Sem ponta, a ponta dos anos
    /// carregados; ponta invertida é desinvertida, não recusada.
    /// </summary>
    /// <remarks>
    /// <para><c>Prefixos</c> são os anos do período como texto: o ano da emenda são os quatro primeiros dígitos do código dela.</para>
    /// </remarks>
    private async Task<(PeriodoDto Periodo, IReadOnlyList<int> Anos, string[] Prefixos)> PeriodoAsync(
        Periodo<AnoDaEmenda> periodoPedido, CancellationToken ct)
    {
        var anosDaEmendaCarregados = await AnosAsync(ct);
        if (anosDaEmendaCarregados.Count == 0)
        {
            return (new PeriodoDto(0, 0), anosDaEmendaCarregados, []);
        }

        var primeiroAnoDaEmenda = Math.Clamp(periodoPedido.Primeiro?.Valor ?? anosDaEmendaCarregados[0], anosDaEmendaCarregados[0], anosDaEmendaCarregados[^1]);
        var ultimoAnoDaEmenda = Math.Clamp(periodoPedido.Ultimo?.Valor ?? anosDaEmendaCarregados[^1], anosDaEmendaCarregados[0], anosDaEmendaCarregados[^1]);
        if (primeiroAnoDaEmenda > ultimoAnoDaEmenda)
        {
            (primeiroAnoDaEmenda, ultimoAnoDaEmenda) = (ultimoAnoDaEmenda, primeiroAnoDaEmenda);
        }

        var prefixosDoCodigoDaEmenda = anosDaEmendaCarregados
            .Where(a => a >= primeiroAnoDaEmenda && a <= ultimoAnoDaEmenda)
            .Select(a => a.ToString(CultureInfo.InvariantCulture))
            .ToArray();

        return (new PeriodoDto(primeiroAnoDaEmenda, ultimoAnoDaEmenda), anosDaEmendaCarregados, prefixosDoCodigoDaEmenda);
    }

    private IQueryable<EmendaFavorecidoModel> DoPeriodo(string[] prefixosDoCodigoDaEmenda) =>
        _db.EmendasFavorecidos.AsNoTracking().Where(f => prefixosDoCodigoDaEmenda.Contains(f.CodigoEmenda.Substring(0, 4)));

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
            Competencia = f.Competencia,
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

    /// <summary>A população estimada de cada município (IBGE) e o ano da estimativa. Em cache, como os municípios.</summary>
    private async Task<(IReadOnlyDictionary<string, int>, int?)> PopulacoesAsync(CancellationToken ct) =>
        await _cache.GetOrCreateAsync("populacoes", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDosMunicipios;
            var linhas = await _db.Municipios.AsNoTracking()
                .Where(m => m.Populacao != null)
                .Select(m => new { m.CodigoIbge, Populacao = m.Populacao!.Value, m.PopulacaoAno })
                .ToListAsync(ct);
            return ((IReadOnlyDictionary<string, int>)linhas.ToDictionary(l => l.CodigoIbge, l => l.Populacao),
                    (int?)linhas.Max(l => (int?)l.PopulacaoAno));
        });

    /// <summary>
    /// A cidade num ano, calculada inteira uma vez e guardada: as páginas das listas leem daqui.
    /// </summary>
    private async Task<CidadeCalculada?> CidadeAsync(string codigoIbge, Periodo<AnoDaEmenda> periodoPedido, CancellationToken ct)
    {
        var municipio = (await MunicipiosAsync(ct)).FirstOrDefault(m => m.CodigoIbge == codigoIbge);
        if (municipio is null)
        {
            return null;
        }

        var (periodoMostrado, anosDaEmendaCarregados, prefixosDoCodigoDaEmenda) = await PeriodoAsync(periodoPedido, ct);

        return await _cache.GetOrCreateAsync($"mapa:cidade:{codigoIbge}:{periodoMostrado.PrimeiroAno}-{periodoMostrado.UltimoAno}", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaCidade;
            return await CalcularCidadeAsync(municipio, periodoMostrado, anosDaEmendaCarregados, prefixosDoCodigoDaEmenda, ct);
        });
    }

    private async Task<CidadeCalculada> CalcularCidadeAsync(
        MunicipioDto municipio, PeriodoDto periodoMostrado, IReadOnlyList<int> anosDaEmendaCarregados, string[] prefixosDoCodigoDaEmenda, CancellationToken ct)
    {
        var naCidade = NoMapa(DoPeriodo(prefixosDoCodigoDaEmenda)).Where(p => p.CodigoIbge == municipio.CodigoIbge);

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
        var convenios = await ConveniosDaCidadeAsync(municipio.CodigoIbge, prefixosDoCodigoDaEmenda, ct);

        return new CidadeCalculada(
            municipio, periodoMostrado, anosDaEmendaCarregados, porEmenda.Sum(e => e.Recebido), naPropriaCidade, parlamentares, coletivos,
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
        string codigoIbge, string[] prefixosDoCodigoDaEmenda, CancellationToken ct)
    {
        var cnpjs = _db.CnpjsMunicipio.Where(c => c.CodigoIbge == codigoIbge).Select(c => c.Cnpj);
        var numeros = _db.EmendasConvenios
            .Where(e => prefixosDoCodigoDaEmenda.Contains(e.CodigoEmenda.Substring(0, 4)))
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
        public DateOnly Competencia { get; init; }
        public required string CodigoIbge { get; init; }
        public required string Nome { get; init; }
        public required string Uf { get; init; }
    }
}
