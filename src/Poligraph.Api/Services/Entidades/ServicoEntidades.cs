using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// Quem recebeu dinheiro de emenda, por pessoa jurídica: a lista, a busca e a página de cada uma.
/// </summary>
/// <remarks>
/// <para>
/// A chave é o CNPJ, do começo ao fim: a emenda liga ao favorecido pelo CNPJ, a sede sai do
/// cadastro da Receita pelo CNPJ, e a cota se cruza pelo CNPJ do fornecedor. Nenhum nome é
/// casado por texto.
/// </para>
/// <para>
/// RISCO: Empresário individual não entra. O CNPJ dele é de uma pessoa, e o nome empresarial de
/// MEI traz o CPF. Medido em 2026-09-25: nenhum recebeu emenda — a regra é para o que vier.
/// </para>
/// <para>Todos os anos carregados: a página de uma entidade responde "o que ela recebeu", não "o que recebeu num ano".</para>
/// </remarks>
public class ServicoEntidades(
    PoligraphDb db, IMemoryCache cache, ServicoAutoresDeEmenda autores, ServicoParlamentares parlamentares)
{
    public const int ItensPorPagina = 20;
    public const int ResultadosDaBusca = 5;

    private static readonly TimeSpan Validade = CacheDeLeitura.Validade;
    private static readonly CompareInfo Comparacao = CultureInfo.GetCultureInfo("pt-BR").CompareInfo;
    private const CompareOptions SemCaixaNemAcento = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;

    private readonly PoligraphDb _db = db;
    private readonly IMemoryCache _cache = cache;
    private readonly ServicoAutoresDeEmenda _autores = autores;
    private readonly ServicoParlamentares _parlamentares = parlamentares;

    /// <summary>A lista, do maior recebedor ao menor, com filtro por grupo e por nome ou CNPJ.</summary>
    public async Task<PaginaDto<EntidadeNaListaDto>> ListarAsync(
        string? busca, GrupoDeEntidade? grupo, int pagina, CancellationToken ct)
    {
        pagina = Math.Max(pagina, 1);

        var filtradas = Filtrar(await IndiceAsync(ct), busca)
            .Where(e => grupo is null || e.Grupo == grupo)
            .ToList();

        return new PaginaDto<EntidadeNaListaDto>(
            [.. filtradas.Skip((pagina - 1) * ItensPorPagina).Take(ItensPorPagina)],
            pagina, ItensPorPagina, filtradas.Count);
    }

    /// <summary>Os primeiros resultados para a busca do cabeçalho.</summary>
    public async Task<IReadOnlyList<EntidadeNaListaDto>> BuscarAsync(string busca, CancellationToken ct) =>
        [.. Filtrar(await IndiceAsync(ct), busca).Take(ResultadosDaBusca)];

    /// <summary>A página da entidade. Nulo para CNPJ que não recebeu emenda, e o endpoint responde 404.</summary>
    public async Task<EntidadeDto?> ObterAsync(string cnpj, CancellationToken ct)
    {
        var entidade = await CalculadaAsync(cnpj, ct);
        if (entidade is null) return null;

        var (lista, detalhe) = entidade.Value;
        return new EntidadeDto(
            lista.Cnpj, lista.Nome, lista.NaturezaJuridica, lista.Grupo, lista.Sede,
            FontesOficiais.PessoaJuridica(lista.Cnpj),
            lista.Recebido, lista.Emendas, detalhe.PorAno,
            DeParlamentares: detalhe.Parlamentares.Sum(p => p.Recebido),
            Parlamentares: Paginar(detalhe.Parlamentares, 1),
            Coletivos: detalhe.Coletivos,
            NaCota: detalhe.NaCota,
            Convenios: Paginar(detalhe.Convenios, 1));
    }

    /// <summary>Os convênios da entidade, em páginas. A primeira é a da página.</summary>
    public async Task<PaginaDto<ConvenioDaEntidadeDto>?> ListarConveniosAsync(string cnpj, int pagina, CancellationToken ct) =>
        await CalculadaAsync(cnpj, ct) is { } entidade ? Paginar(entidade.Detalhe.Convenios, pagina) : null;

    /// <summary>Os deputados e senadores que mandaram dinheiro para a entidade, em páginas. A primeira é a da página.</summary>
    public async Task<PaginaDto<ParlamentarQueMandouDto>?> ListarParlamentaresAsync(
        string cnpj, int pagina, CancellationToken ct) =>
        await CalculadaAsync(cnpj, ct) is { } entidade ? Paginar(entidade.Detalhe.Parlamentares, pagina) : null;

    /// <summary>
    /// O grupo que a pessoa reconhece, a partir da natureza jurídica da Receita.
    /// </summary>
    /// <remarks>
    /// <para>Pelas palavras da natureza, e não por uma tabela das 35: uma natureza nova cai no grupo certo quando segue o padrão, e em <see cref="GrupoDeEntidade.OUTRO"/> quando não segue.</para>
    /// </remarks>
    public static GrupoDeEntidade GrupoDe(string? natureza) => natureza switch
    {
        null or "" => GrupoDeEntidade.OUTRO,
        _ when natureza.Contains("Consórcio Público", StringComparison.OrdinalIgnoreCase) => GrupoDeEntidade.OUTRO,
        _ when natureza == "Município" || natureza.EndsWith("Municipal", StringComparison.OrdinalIgnoreCase) =>
            GrupoDeEntidade.MUNICIPIO,
        _ when natureza.StartsWith("Estado ou Distrito Federal", StringComparison.OrdinalIgnoreCase)
            || natureza.Contains("Estadual", StringComparison.OrdinalIgnoreCase) => GrupoDeEntidade.ESTADO,
        _ when natureza.StartsWith("Associação Privada", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Fundação Privada", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Organização Social", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Organização Religiosa", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Serviço Social Autônomo", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Entidade Sindical", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Cooperativa", StringComparison.OrdinalIgnoreCase) => GrupoDeEntidade.SEM_FINS_LUCRATIVOS,
        _ when natureza.StartsWith("Sociedade", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Empresa", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Consórcio de Sociedades", StringComparison.OrdinalIgnoreCase)
            || natureza.StartsWith("Estabelecimento, no Brasil, de Sociedade", StringComparison.OrdinalIgnoreCase) =>
            GrupoDeEntidade.EMPRESA,
        _ => GrupoDeEntidade.OUTRO,
    };

    /// <summary>Por CNPJ, quando a busca tem dígitos que bastem; por nome, sem caixa e sem acento, no resto.</summary>
    /// <remarks>
    /// <para>Quem começa pelo termo vem antes de quem só o contém; dentro de cada parte, o maior recebedor primeiro.</para>
    /// </remarks>
    private static IEnumerable<EntidadeNaListaDto> Filtrar(IReadOnlyList<EntidadeNaListaDto> indice, string? busca)
    {
        if (string.IsNullOrWhiteSpace(busca)) return indice;

        var termo = busca.Trim();
        var digitos = new string([.. termo.Where(char.IsDigit)]);
        if (digitos.Length >= 8 && digitos.Length == termo.Count(c => !char.IsWhiteSpace(c) && c is not ('.' or '/' or '-')))
            return indice.Where(e => e.Cnpj.StartsWith(digitos, StringComparison.Ordinal));

        return indice
            .Select(e => new { Entidade = e, Posicao = Comparacao.IndexOf(e.Nome, termo, SemCaixaNemAcento) })
            .Where(e => e.Posicao >= 0)
            .OrderBy(e => e.Posicao == 0 ? 0 : 1)
            .ThenByDescending(e => e.Entidade.Recebido)
            .Select(e => e.Entidade);
    }

    /// <summary>Todas as pessoas jurídicas que receberam emenda, com a sede. Em cache: ~31 mil linhas.</summary>
    private async Task<IReadOnlyList<EntidadeNaListaDto>> IndiceAsync(CancellationToken ct) =>
        await _cache.GetOrCreateAsync("entidades:indice", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = Validade;

            var recebidos = await _db.EmendasFavorecidos.AsNoTracking()
                .Where(f => f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario && f.Documento != null)
                .GroupBy(f => f.Documento!)
                .Select(g => new
                {
                    Cnpj = g.Key,
                    Nome = g.Max(f => f.Nome),
                    Natureza = g.Max(f => f.NaturezaJuridica),
                    Recebido = g.Sum(f => f.Valor),
                    Emendas = g.Select(f => f.CodigoEmenda).Distinct().Count()
                })
                .ToListAsync(ct);

            var sedes = await (
                    from c in _db.CnpjsMunicipio
                    join m in _db.Municipios on c.CodigoIbge equals m.CodigoIbge
                    select new { c.Cnpj, Municipio = new MunicipioDto(m.CodigoIbge, m.Nome, m.Uf) })
                .ToDictionaryAsync(s => s.Cnpj, s => s.Municipio, ct);

            return (IReadOnlyList<EntidadeNaListaDto>)[.. recebidos
                .Where(r => r.Natureza?.Contains("Individual", StringComparison.OrdinalIgnoreCase) != true)
                .Select(r => new EntidadeNaListaDto(
                    r.Cnpj, TextoSemCpf.Limpar(r.Nome ?? r.Cnpj), r.Natureza, GrupoDe(r.Natureza),
                    sedes.GetValueOrDefault(r.Cnpj), r.Recebido, r.Emendas))
                .OrderByDescending(e => e.Recebido)];
        }) ?? [];

    /// <summary>A entidade calculada inteira uma vez e guardada: as páginas das listas leem daqui.</summary>
    private async Task<(EntidadeNaListaDto Lista, DetalheDaEntidade Detalhe)?> CalculadaAsync(string cnpj, CancellationToken ct)
    {
        var lista = (await IndiceAsync(ct)).FirstOrDefault(e => e.Cnpj == cnpj);
        if (lista is null) return null;

        var detalhe = await _cache.GetOrCreateAsync($"entidades:{cnpj}", async entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = Validade;
            return await DetalharAsync(cnpj, ct);
        });

        return (lista, detalhe!);
    }

    private async Task<DetalheDaEntidade> DetalharAsync(string cnpj, CancellationToken ct)
    {
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => f.Documento == cnpj && f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario);

        var porEmenda = await pagamentos
            .GroupBy(f => f.CodigoEmenda)
            .Select(g => new { Codigo = g.Key, Recebido = g.Sum(f => f.Valor) })
            .ToListAsync(ct);

        var porAno = porEmenda
            .GroupBy(e => int.Parse(e.Codigo[..4], CultureInfo.InvariantCulture))
            .Select(g => new RecebidoNoAnoDto(g.Key, g.Sum(e => e.Recebido)))
            .OrderBy(a => a.Ano)
            .ToList();

        var (parlamentares, coletivos) = await _autores.AgruparAsync([.. porEmenda.Select(e => (e.Codigo, e.Recebido))], ct);

        return new DetalheDaEntidade(porAno, parlamentares, coletivos, await NaCotaAsync(cnpj, ct), await ConveniosAsync(cnpj, ct));
    }

    /// <summary>Do maior ao menor; o mesmo convênio financiado por várias emendas aparece uma vez.</summary>
    private async Task<IReadOnlyList<ConvenioDaEntidadeDto>> ConveniosAsync(string cnpj, CancellationToken ct) =>
        [.. (await _db.Convenios.AsNoTracking()
                .Where(c => c.CnpjConvenente == cnpj)
                .OrderByDescending(c => c.Valor)
                .ToListAsync(ct))
            .Select(c => new ConvenioDaEntidadeDto(
                c.Numero, c.Objeto, c.Situacao, c.DataPublicacao, c.Valor, c.ValorLiberado,
                FontesOficiais.Convenio(c.Numero)))];

    /// <summary>O que parlamentares pagaram a este CNPJ com a cota. Nulo quando ninguém pagou.</summary>
    private async Task<CotaDaEntidadeDto?> NaCotaAsync(string cnpj, CancellationToken ct)
    {
        var porPessoa = await _db.Despesas.AsNoTracking()
            .Where(d => d.CnpjOuHash == cnpj && !d.FornecedorEhPessoaFisica)
            .GroupBy(d => d.PessoaId)
            .Select(g => new { PessoaId = g.Key, Total = g.Sum(d => d.ValorLiquido), Lancamentos = g.Count() })
            .OrderByDescending(p => p.Total)
            .ToListAsync(ct);

        if (porPessoa.Count == 0) return null;

        var legislatura = (await _parlamentares.ParlamentaresDaLegislaturaAsync(ct)).ToDictionary(p => p.Id);
        var ids = porPessoa.Where(p => !legislatura.ContainsKey(p.PessoaId)).Select(p => p.PessoaId).ToList();
        var foraDaLista = await _db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.NomeCivil, ct);

        return new CotaDaEntidadeDto(
            porPessoa.Sum(p => p.Total),
            porPessoa.Sum(p => p.Lancamentos),
            [.. porPessoa.Select(p => legislatura.GetValueOrDefault(p.PessoaId) is { } pessoa
                ? new ParlamentarNaCotaDto(p.PessoaId, pessoa.Nome, pessoa.Partido, pessoa.Casa, p.Total, p.Lancamentos)
                : new ParlamentarNaCotaDto(p.PessoaId, foraDaLista.GetValueOrDefault(p.PessoaId) ?? "", null, null, p.Total, p.Lancamentos))]);
    }

    private static PaginaDto<T> Paginar<T>(IReadOnlyList<T> itens, int pagina)
    {
        pagina = Math.Max(pagina, 1);
        return new PaginaDto<T>(
            [.. itens.Skip((pagina - 1) * ItensPorPagina).Take(ItensPorPagina)], pagina, ItensPorPagina, itens.Count);
    }

    private sealed record DetalheDaEntidade(
        IReadOnlyList<RecebidoNoAnoDto> PorAno,
        IReadOnlyList<ParlamentarQueMandouDto> Parlamentares,
        IReadOnlyList<ColetivoQueMandouDto> Coletivos,
        CotaDaEntidadeDto? NaCota,
        IReadOnlyList<ConvenioDaEntidadeDto> Convenios);
}
