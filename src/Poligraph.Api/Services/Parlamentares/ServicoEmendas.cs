using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// As emendas do parlamentar, agregadas por ano: para onde foram, quem recebeu, quando
/// foram pagas e que convênios financiam.
///
/// <para>
/// Só entra emenda <b>já reconciliada</b>. Emenda de comissão, de bancada e de autor
/// não resolvido existe no banco e não aparece aqui: atribuí-la por semelhança de
/// nome seria inventar autoria.
/// </para>
/// </summary>
public class ServicoEmendas(PoligraphDb db, CacheDeLeitura leitura)
{
    /// <summary>Quantos itens de cada lista vêm na ficha, e em cada página seguinte.</summary>
    public const int ItensPorPagina = 8;

    private const int TamanhoMaximo = 50;

    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <remarks>
    /// <para>Sem emenda é caso normal: a tela mostra estado vazio, não erro.</para>
    /// <para>Tipo ANÔNIMO, não `record` posicional: o EF não traduz `GroupBy` com construtor posicional e falha em RUNTIME, não na compilação.</para>
    /// <para>Agregação PRÓPRIA, não a soma dos `Take(8)` acima: eles mostrariam um total menor que o real, sem nada na tela indicando o corte.</para>
    /// </remarks>
    /// <param name="legislatura">Sem ano, o mais recente DENTRO do mandato (ver <c>Legislaturas.AnosDeEmenda</c>).</param>
    public Task<EmendasDoParlamentarDto> ObterAsync(long id, int? ano, short? legislatura, CancellationToken ct) =>
        _leitura.ObterAsync(("emendas", id, ano, legislatura), () => CalcularAsync(id, ano, legislatura, ct));

    /// <summary>Quem recebeu, em páginas, na mesma ordem da ficha. A primeira página é a da ficha.</summary>
    public async Task<PaginaDto<FavorecidoDaEmendaDto>> ListarFavorecidosAsync(
        long id, int? ano, int pagina, int tamanho, CancellationToken ct)
    {
        (pagina, tamanho) = Normalizar(pagina, tamanho);

        var alvo = await AnoAlvoAsync(id, ano, ct);
        if (alvo is null) return new PaginaDto<FavorecidoDaEmendaDto>([], pagina, tamanho, 0);

        var identificados = FavorecidosIdentificados(EmendasDoAno(id, alvo.Value).Select(e => e.CodigoEmenda).Distinct());

        var itens = await identificados
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .ToListAsync(ct);

        var cota = await CotaDosFavorecidosAsync(id, alvo.Value, itens, ct);

        return new PaginaDto<FavorecidoDaEmendaDto>(
            [.. itens.Select(f => ParaFavorecido(f, cota))], pagina, tamanho, await identificados.CountAsync(ct));
    }

    /// <summary>Os convênios, em páginas, na mesma ordem da ficha. A primeira página é a da ficha.</summary>
    public async Task<PaginaDto<ConvenioDaEmendaDto>> ListarConveniosAsync(
        long id, int? ano, int pagina, int tamanho, CancellationToken ct)
    {
        (pagina, tamanho) = Normalizar(pagina, tamanho);

        var alvo = await AnoAlvoAsync(id, ano, ct);
        if (alvo is null) return new PaginaDto<ConvenioDaEmendaDto>([], pagina, tamanho, 0);

        var convenios = ConveniosDasEmendas(EmendasDoAno(id, alvo.Value).Select(e => e.CodigoEmenda).Distinct());

        var itens = await convenios
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .ToListAsync(ct);

        return new PaginaDto<ConvenioDaEmendaDto>(
            [.. itens.Select(ParaConvenio)], pagina, tamanho, await convenios.CountAsync(ct));
    }

    /// <summary>As emendas do ano, uma a uma, com o link de cada uma no Portal. Maior empenho primeiro.</summary>
    /// <remarks>
    /// <para>É o caminho de volta à fonte: a ficha mostra somas, e cada soma se confere aqui, emenda por emenda.</para>
    /// </remarks>
    public async Task<PaginaDto<EmendaNaListaDto>> ListarEmendasAsync(
        long id, int? ano, int pagina, int tamanho, CancellationToken ct)
    {
        (pagina, tamanho) = Normalizar(pagina, tamanho);

        var alvo = await AnoAlvoAsync(id, ano, ct);
        if (alvo is null) return new PaginaDto<EmendaNaListaDto>([], pagina, tamanho, 0);

        var porCodigo = EmendasDoAno(id, alvo.Value)
            .GroupBy(e => e.CodigoEmenda)
            .Select(g => new
            {
                Codigo = g.Key,
                Tipo = g.Max(e => e.Tipo),
                Localidade = g.Max(e => e.Localidade),
                Localidades = g.Select(e => e.Localidade).Distinct().Count(),
                Funcao = g.Max(e => e.Funcao),
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago)
            });

        var itens = await porCodigo
            .OrderByDescending(e => e.Empenhado)
            .ThenBy(e => e.Codigo)
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .ToListAsync(ct);

        return new PaginaDto<EmendaNaListaDto>(
            [.. itens.Select(e => new EmendaNaListaDto(
                e.Codigo, e.Tipo, e.Localidade, e.Localidades, e.Funcao, e.Empenhado, e.Pago,
                FontesOficiais.Emenda(e.Codigo)))],
            pagina, tamanho, await porCodigo.CountAsync(ct));
    }

    private async Task<EmendasDoParlamentarDto> CalcularAsync(long id, int? ano, short? legislatura, CancellationToken ct)
    {
        var alvo = await AnoAlvoAsync(id, ano, ct, legislatura);

        if (alvo is null)
        {
            return new EmendasDoParlamentarDto(
                0, 0, 0, 0, [], [], new FavorecidosDaEmendaDto(0, 0, 0, 0, null, 0, []), [],
                new ConveniosDaEmendaDto(0, []), new CidadesDaEmendaDto(0, []));
        }

        var doAno = EmendasDoAno(id, alvo.Value);

        var destinos = await doAno
            .Where(e => e.Localidade != null)
            .GroupBy(e => e.Localidade!)
            .Select(g => new
            {
                Localidade = g.Key,
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Select(e => e.CodigoEmenda).Distinct().Count()
            })
            .OrderByDescending(d => d.Empenhado)
            .Take(ItensPorPagina)
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
            .Take(ItensPorPagina)
            .ToListAsync(ct);

        var totais = await doAno
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Select(e => e.CodigoEmenda).Distinct().Count()
            })
            .FirstOrDefaultAsync(ct);

        var codigos = doAno.Select(e => e.CodigoEmenda).Distinct();

        return new EmendasDoParlamentarDto(
            Ano: alvo.Value,
            Empenhado: totais?.Empenhado ?? 0,
            Pago: totais?.Pago ?? 0,
            Quantidade: totais?.Quantidade ?? 0,
            PorDestino: [.. destinos.Select(d =>
                new EmendaPorDestinoDto(d.Localidade, d.Empenhado, d.Pago, d.Quantidade))],
            PorFuncao: [.. funcoes.Select(f =>
                new EmendaPorFuncaoDto(f.Funcao, f.Empenhado, f.Pago))],
            Favorecidos: await FavorecidosAsync(id, alvo.Value, codigos, ct),
            PagamentosPorMes: await PagamentosPorMesAsync(codigos, ct),
            Convenios: await ConveniosAsync(codigos, ct),
            Cidades: await CidadesAsync(codigos, ct));
    }

    /// <summary>O ano pedido; sem ele, o último ano fechado com emenda do parlamentar.</summary>
    /// <remarks>
    /// <para>Abria no mais recente, que é o ano em andamento: valores parciais, que pareciam baixos só por estarem incompletos. O ano corrente só abre quando é o único que o parlamentar tem, e a tela o marca.</para>
    /// </remarks>
    private async Task<int?> AnoAlvoAsync(long id, int? ano, CancellationToken ct, short? legislatura = null)
    {
        if (ano is not null) return ano;

        var daPessoa = _db.Emendas.AsNoTracking().Where(e => e.PessoaId == id);
        if (legislatura is { } l)
        {
            var (de, ate) = Legislaturas.AnosDeEmenda(l);
            daPessoa = daPessoa.Where(e => e.Ano >= de && e.Ano <= ate);
        }
        var anos = await daPessoa
            .Select(e => (int)e.Ano)
            .Distinct()
            .ToListAsync(ct);

        if (anos.Count == 0) return null;

        var corrente = DateTimeOffset.UtcNow.Year;
        var fechados = anos.Where(a => a < corrente).ToList();

        return fechados.Count > 0 ? fechados.Max() : anos.Max();
    }

    private IQueryable<EmendaModel> EmendasDoAno(long id, int ano) =>
        _db.Emendas.AsNoTracking().Where(e => e.PessoaId == id && e.Ano == (short)ano);

    /// <remarks>
    /// <para>A lista traz só quem se identifica e recebe como destino: empresa, entidade, órgão público. Intermediário, pessoa e registro sem identificação entram nos totais ao lado, e a soma de tudo continua em <c>Recebido</c>.</para>
    /// </remarks>
    private async Task<FavorecidosDaEmendaDto> FavorecidosAsync(
        long id, int ano, IQueryable<string> codigos, CancellationToken ct)
    {
        var totais = await _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => codigos.Contains(f.CodigoEmenda))
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Recebido = g.Sum(f => f.Valor),
                ViaIntermediario = g.Where(f => f.Intermediario).Sum(f => f.Valor),
                APessoas = g.Where(f => f.Tipo == TipoFavorecido.PESSOA).Sum(f => f.Valor),
                SemIdentificacao = g.Where(f => f.Tipo == TipoFavorecido.SEM_INFORMACAO)
                    .Sum(f => f.Valor),
                UltimoMes = g.Max(f => (DateOnly?)f.Competencia)
            })
            .FirstOrDefaultAsync(ct);

        var identificados = FavorecidosIdentificados(codigos);
        var maiores = await identificados.Take(ItensPorPagina).ToListAsync(ct);
        var cota = await CotaDosFavorecidosAsync(id, ano, maiores, ct);

        return new FavorecidosDaEmendaDto(
            Recebido: totais?.Recebido ?? 0,
            ViaIntermediario: totais?.ViaIntermediario ?? 0,
            APessoas: totais?.APessoas ?? 0,
            SemIdentificacao: totais?.SemIdentificacao ?? 0,
            UltimoMes: totais?.UltimoMes,
            Identificados: await identificados.CountAsync(ct),
            Maiores: [.. maiores.Select(f => ParaFavorecido(f, cota))]);
    }

    /// <summary>PL74: quanto a cota do parlamentar pagou a cada CNPJ da lista, no mandato da emenda.</summary>
    /// <remarks>
    /// <para>Só CNPJ público: o fornecedor pessoa física da cota guarda hash, e o empresário individual tem CNPJ de pessoa.</para>
    /// <para>O mandato sai do ano da emenda, não do ano corrente: a emenda de 2023 é da 56ª, e a cota que importa é a de 2019 a 2022.</para>
    /// </remarks>
    private async Task<Dictionary<string, decimal>> CotaDosFavorecidosAsync(
        long id, int anoDaEmenda, IEnumerable<FavorecidoAgrupado> favorecidos, CancellationToken ct)
    {
        var cnpjs = favorecidos
            .Select(f => FavorecidoDaEmendaDto.CnpjPublico(f.Documento, f.NaturezaJuridica))
            .OfType<string>()
            .ToList();
        if (cnpjs.Count == 0) return [];

        var (de, ate) = Legislaturas.AnosDeDespesa(Legislaturas.DoAnoDeEmenda(anoDaEmenda));

        return await _db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == id && d.Ano >= de && d.Ano <= ate
                && !d.FornecedorEhPessoaFisica && cnpjs.Contains(d.CnpjOuHash!))
            .GroupBy(d => d.CnpjOuHash!)
            .Select(g => new { Cnpj = g.Key, Pago = g.Sum(d => d.ValorLiquido) })
            .Where(g => g.Pago > 0)
            .ToDictionaryAsync(g => g.Cnpj, g => g.Pago, ct);
    }

    /// <remarks>
    /// <para>Agrupado por documento, e não por nome: o mesmo CNPJ aparece com grafias diferentes entre meses. O documento desempata a ordem, para a página seguinte não repetir nem pular ninguém.</para>
    /// </remarks>
    private IQueryable<FavorecidoAgrupado> FavorecidosIdentificados(IQueryable<string> codigos) =>
        _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => codigos.Contains(f.CodigoEmenda) && !f.Intermediario && f.Documento != null)
            .GroupBy(f => f.Documento!)
            .Select(g => new FavorecidoAgrupado
            {
                Documento = g.Key,
                Nome = g.Max(f => f.Nome)!,
                NaturezaJuridica = g.Max(f => f.NaturezaJuridica),
                Uf = g.Max(f => f.Uf),
                Municipio = g.Max(f => f.Municipio),
                Recebido = g.Sum(f => f.Valor)
            })
            .OrderByDescending(f => f.Recebido)
            .ThenBy(f => f.Documento);

    private static FavorecidoDaEmendaDto ParaFavorecido(FavorecidoAgrupado f, Dictionary<string, decimal> cota)
    {
        var cnpj = FavorecidoDaEmendaDto.CnpjPublico(f.Documento, f.NaturezaJuridica);
        return new(TextoSemCpf.Limpar(f.Nome), f.NaturezaJuridica, f.Uf, f.Municipio, f.Recebido, cnpj,
            cnpj is not null && cota.TryGetValue(cnpj, out var pago) ? pago : null);
    }

    /// <summary>As cidades que receberam, pela sede de quem recebeu. Só pessoa jurídica fora do intermediário: é quem tem sede.</summary>
    private async Task<CidadesDaEmendaDto> CidadesAsync(IQueryable<string> codigos, CancellationToken ct)
    {
        var porCidade = await (
                from f in _db.EmendasFavorecidos.AsNoTracking()
                where codigos.Contains(f.CodigoEmenda) && f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
                join c in _db.CnpjsMunicipio on f.Documento equals c.Cnpj
                join m in _db.Municipios on c.CodigoIbge equals m.CodigoIbge
                group f.Valor by new { m.CodigoIbge, m.Nome, m.Uf } into g
                select new { g.Key.CodigoIbge, g.Key.Nome, g.Key.Uf, Recebido = g.Sum() })
            .OrderByDescending(c => c.Recebido)
            .ToListAsync(ct);

        return new CidadesDaEmendaDto(
            porCidade.Count,
            [.. porCidade.Take(ItensPorPagina).Select(c => new RecebidoNaCidadeDto(new MunicipioDto(c.CodigoIbge, c.Nome, c.Uf), c.Recebido))]);
    }

    /// <remarks>
    /// <para>Todo pagamento conta, inclusive o que passou pelo intermediário: a pergunta aqui é quando o dinheiro saiu, não para onde foi.</para>
    /// </remarks>
    private async Task<IReadOnlyList<PagamentoPorMesDto>> PagamentosPorMesAsync(
        IQueryable<string> codigos, CancellationToken ct)
    {
        var meses = await _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => codigos.Contains(f.CodigoEmenda))
            .GroupBy(f => f.Competencia)
            .Select(g => new { Mes = g.Key, Valor = g.Sum(f => f.Valor) })
            .OrderBy(m => m.Mes)
            .ToListAsync(ct);

        return [.. meses.Select(m => new PagamentoPorMesDto(m.Mes, m.Valor))];
    }

    private async Task<ConveniosDaEmendaDto> ConveniosAsync(
        IQueryable<string> codigos, CancellationToken ct)
    {
        var convenios = ConveniosDasEmendas(codigos);
        var maiores = await convenios.Take(ItensPorPagina).ToListAsync(ct);

        return new ConveniosDaEmendaDto(
            await convenios.CountAsync(ct), [.. maiores.Select(ParaConvenio)]);
    }

    /// <remarks>
    /// <para>O valor é o do convênio inteiro. Por isso vai junto quantas emendas o financiam, de qualquer autor: sem esse número, a lista leria como dinheiro do parlamentar.</para>
    /// </remarks>
    private IQueryable<ConvenioComEmendas> ConveniosDasEmendas(IQueryable<string> codigos)
    {
        var numeros = _db.EmendasConvenios.AsNoTracking()
            .Where(ec => codigos.Contains(ec.CodigoEmenda))
            .Select(ec => ec.NumeroConvenio);

        return _db.Convenios.AsNoTracking()
            .Where(c => numeros.Contains(c.Numero))
            .OrderByDescending(c => c.Valor)
            .ThenBy(c => c.Numero)
            .Select(c => new ConvenioComEmendas
            {
                Numero = c.Numero,
                Convenente = c.Convenente,
                Objeto = c.Objeto,
                DataPublicacao = c.DataPublicacao,
                Valor = c.Valor,
                Emendas = _db.EmendasConvenios.Count(ec => ec.NumeroConvenio == c.Numero)
            });
    }

    private static ConvenioDaEmendaDto ParaConvenio(ConvenioComEmendas c) =>
        new(c.Numero, c.Convenente, c.Objeto, c.DataPublicacao, c.Valor, c.Emendas,
            FontesOficiais.Convenio(c.Numero));

    private static (int Pagina, int Tamanho) Normalizar(int pagina, int tamanho) =>
        (Math.Max(pagina, 1), Math.Clamp(tamanho, 1, TamanhoMaximo));

    /// <summary>Projeção do EF: classe com inicializador, que ele traduz no `GroupBy`.</summary>
    private sealed class FavorecidoAgrupado
    {
        public required string Documento { get; init; }
        public required string Nome { get; init; }
        public string? NaturezaJuridica { get; init; }
        public string? Uf { get; init; }
        public string? Municipio { get; init; }
        public decimal Recebido { get; init; }
    }

    private sealed class ConvenioComEmendas
    {
        public required string Numero { get; init; }
        public required string Convenente { get; init; }
        public string? Objeto { get; init; }
        public DateOnly DataPublicacao { get; init; }
        public decimal Valor { get; init; }
        public int Emendas { get; init; }
    }
}
