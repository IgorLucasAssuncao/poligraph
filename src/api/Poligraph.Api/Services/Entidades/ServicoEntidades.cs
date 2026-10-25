using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Tipos;
using Poligraph.Api.Constantes;

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
    PoligraphDb db, CacheDeLeitura leitura, ServicoAutoresDeEmenda autores, ServicoParlamentares parlamentares)
{
    public const int ItensPorPagina = 20;
    public const int ResultadosDaBusca = 5;


    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;
    private readonly ServicoAutoresDeEmenda _autores = autores;
    private readonly ServicoParlamentares _parlamentares = parlamentares;

    /// <summary>A lista, do maior recebedor ao menor, com filtro por grupo e por nome ou CNPJ.</summary>
    public async Task<PaginaDto<EntidadeNaListaDto>> ListarAsync(
        string? busca, GrupoDeEntidade? grupo, int pagina, CancellationToken ct)
    {
        pagina = Math.Max(pagina, 1);

        var filtradas = Filtrar(await IndiceComChavesAsync(ct), busca)
            .Where(e => grupo is null || e.Grupo == grupo)
            .ToList();

        return new PaginaDto<EntidadeNaListaDto>(
            [.. filtradas.Skip((pagina - 1) * ItensPorPagina).Take(ItensPorPagina)],
            pagina, ItensPorPagina, filtradas.Count);
    }

    /// <summary>Os primeiros resultados para a busca do cabeçalho.</summary>
    public async Task<IReadOnlyList<EntidadeNaListaDto>> BuscarAsync(string busca, CancellationToken ct) =>
        [.. Filtrar(await IndiceComChavesAsync(ct), busca).Take(ResultadosDaBusca)];

    /// <summary>A página da entidade. Nulo para CNPJ sem emenda, sem contrato federal e sem sanção, e o endpoint responde 404.</summary>
    /// <remarks>
    /// <para>Empresa que só contratou com o governo, ou só foi sancionada, também tem página: a lista de compras e a sanção levam a ela. MEDIDO (2026-10-10): 4 das 15 maiores contratadas não receberam emenda, e o link dava 404.</para>
    /// </remarks>
    public async Task<EntidadeDto?> ObterAsync(Cnpj cnpj, CancellationToken ct)
    {
        var entidade = await CalculadaAsync(cnpj.Digitos, ct);
        if (entidade is null)
        {
            return await SemEmendaAsync(cnpj.Digitos, ct);
        }

        var (lista, detalhe) = entidade.Value;
        return new EntidadeDto(
            lista.Cnpj, lista.Nome, lista.NaturezaJuridica, lista.Grupo, lista.Sede,
            FontesOficiais.PessoaJuridica(lista.Cnpj),
            lista.Recebido, lista.Emendas, detalhe.PorAno,
            DeParlamentares: detalhe.Parlamentares.Sum(p => p.Recebido),
            Parlamentares: Paginar(detalhe.Parlamentares, 1),
            Coletivos: detalhe.Coletivos,
            NaCota: detalhe.NaCota,
            Convenios: Paginar(detalhe.Convenios, 1),
            Sancoes: await SancoesAsync(cnpj.Digitos, ct),
            ComOGoverno: await ContratosComOGovernoAsync(cnpj.Digitos, ct));
    }

    /// <summary>A página de quem não recebeu emenda: só os contratos com o governo e as sanções. Nulo quando não há nenhum dos dois.</summary>
    private async Task<EntidadeDto?> SemEmendaAsync(string cnpj, CancellationToken ct)
    {
        var sancoes = await SancoesAsync(cnpj, ct);
        var contratos = await ContratosComOGovernoAsync(cnpj, ct);
        if (sancoes.Count == 0 && contratos is null)
        {
            return null;
        }

        var nome = await _db.ContratadosDoGoverno.AsNoTracking().Where(c => c.Cnpj == cnpj)
                       .OrderByDescending(c => c.Ano).Select(c => c.Nome).FirstOrDefaultAsync(ct)
                   ?? await _db.SancoesDeEmpresas.AsNoTracking().Where(s => s.Cnpj == cnpj)
                       .Select(s => s.Nome).FirstOrDefaultAsync(ct)
                   ?? cnpj;

        return new EntidadeDto(
            cnpj, nome, null, GrupoDeEntidade.EMPRESA, null, FontesOficiais.PessoaJuridica(cnpj),
            0, 0, [], DeParlamentares: 0, Parlamentares: new PaginaDto<ParlamentarQueMandouDto>([], 1, ItensPorPagina, 0),
            Coletivos: [], NaCota: null, Convenios: new PaginaDto<ConvenioDaEntidadeDto>([], 1, ItensPorPagina, 0),
            Sancoes: sancoes, ComOGoverno: contratos);
    }

    /// <summary>As sanções do CEIS e do CNEP à entidade, da mais recente. Vigente quando não tem fim ou o fim não passou.</summary>
    private async Task<IReadOnlyList<SancaoDaEntidadeDto>> SancoesAsync(string cnpj, CancellationToken ct)
    {
        var hoje = DateOnly.FromDateTime(TimeProvider.System.GetUtcNow().UtcDateTime);
        var linhas = await _db.SancoesDeEmpresas.AsNoTracking()
            .Where(s => s.Cnpj == cnpj)
            .OrderByDescending(s => s.Inicio)
            .ToListAsync(ct);

        return [.. linhas.Select(s => new SancaoDaEntidadeDto(
            s.Cadastro, s.Categoria, s.Inicio, s.Fim, s.Fim is null || s.Fim >= hoje, s.OrgaoSancionador,
            s.Esfera, s.FundamentacaoLegal, s.ValorDaMulta))];
    }

    /// <summary>Os contratos da entidade com o Executivo federal. Nulo quando não tem nenhum.</summary>
    private async Task<ContratosComOGovernoDto?> ContratosComOGovernoAsync(string cnpj, CancellationToken ct)
    {
        var anos = await _db.ContratadosDoGoverno.AsNoTracking().Where(c => c.Cnpj == cnpj).ToListAsync(ct);
        return anos.Count == 0
            ? null
            : new ContratosComOGovernoDto(anos.Sum(a => a.Contratos), anos.Sum(a => a.Valor), anos.Min(a => a.Ano), anos.Max(a => a.Ano));
    }

    /// <summary>Os convênios da entidade, em páginas. A primeira é a da página.</summary>
    public async Task<PaginaDto<ConvenioDaEntidadeDto>?> ListarConveniosAsync(Cnpj cnpj, int pagina, CancellationToken ct) =>
        await CalculadaAsync(cnpj.Digitos, ct) is { } entidade ? Paginar(entidade.Detalhe.Convenios, pagina) : null;

    /// <summary>Os deputados e senadores que mandaram dinheiro para a entidade, em páginas. A primeira é a da página.</summary>
    public async Task<PaginaDto<ParlamentarQueMandouDto>?> ListarParlamentaresAsync(
        Cnpj cnpj, int pagina, CancellationToken ct) =>
        await CalculadaAsync(cnpj.Digitos, ct) is { } entidade ? Paginar(entidade.Detalhe.Parlamentares, pagina) : null;

    /// <summary>
    /// O grupo que a pessoa reconhece, a partir da natureza jurídica da Receita.
    /// </summary>
    /// <remarks>
    /// <para>Pelas palavras da natureza, e não por uma tabela das 35: uma natureza nova cai no grupo certo quando segue o padrão, e em <see cref="GrupoDeEntidade.OUTRO"/> quando não segue.</para>
    /// </remarks>
    public static GrupoDeEntidade GrupoDe(string? natureza) => natureza switch
    {
        null or "" => GrupoDeEntidade.OUTRO,
        _ when natureza.Contains(VocabularioDasFontes.ConsorcioPublico, StringComparison.OrdinalIgnoreCase) => GrupoDeEntidade.OUTRO,
        _ when natureza == VocabularioDasFontes.Municipio
            || natureza.EndsWith(VocabularioDasFontes.SufixoMunicipal, StringComparison.OrdinalIgnoreCase) =>
            GrupoDeEntidade.MUNICIPIO,
        _ when natureza.StartsWith(VocabularioDasFontes.EstadoOuDistritoFederal, StringComparison.OrdinalIgnoreCase)
            || natureza.Contains(VocabularioDasFontes.PalavraEstadual, StringComparison.OrdinalIgnoreCase) => GrupoDeEntidade.ESTADO,
        _ when ComecaCom(natureza, VocabularioDasFontes.InicioSemFinsLucrativos) => GrupoDeEntidade.SEM_FINS_LUCRATIVOS,
        _ when ComecaCom(natureza, VocabularioDasFontes.InicioDeEmpresa) => GrupoDeEntidade.EMPRESA,
        _ => GrupoDeEntidade.OUTRO,
    };

    private static bool ComecaCom(string natureza, IReadOnlyList<string> inicios) =>
        inicios.Any(inicio => natureza.StartsWith(inicio, StringComparison.OrdinalIgnoreCase));

    /// <summary>Por CNPJ, quando a busca tem dígitos que bastem; por nome, sem caixa e sem acento, no resto.</summary>
    /// <remarks>
    /// <para>Quem começa pelo termo vem antes de quem só o contém; dentro de cada parte, o maior recebedor primeiro.</para>
    /// </remarks>
    private static IEnumerable<EntidadeNaListaDto> Filtrar(IndiceDeEntidades comChaves, string? busca)
    {
        var indice = comChaves.Itens;
        if (string.IsNullOrWhiteSpace(busca))
        {
            return indice;
        }

        var termo = busca.Trim();
        var digitos = new string([.. termo.Where(char.IsDigit)]);
        if (digitos.Length >= 8 && digitos.Length == termo.Count(c => !char.IsWhiteSpace(c) && c is not ('.' or '/' or '-')))
        {
            return indice.Where(e => e.Cnpj.StartsWith(digitos, StringComparison.Ordinal));
        }

        var chave = ChaveDeBusca.De(termo);
        var chaves = comChaves.Chaves;
        return indice
            .Select((e, i) => new { Entidade = e, Posicao = chaves[i].IndexOf(chave, StringComparison.Ordinal) })
            .Where(e => e.Posicao >= 0)
            .OrderBy(e => e.Posicao == 0 ? 0 : 1)
            .ThenByDescending(e => e.Entidade.Recebido)
            .Select(e => e.Entidade);
    }

    /// <summary>A <see cref="ChaveDeBusca"/> do nome de cada entidade, na ordem do índice, calculada uma vez por índice.</summary>
    /// <remarks>ATENÇÃO: presa à instância do índice, e não a uma entrada de cache própria: com validades separadas, as chaves
    /// de um índice antigo ficariam alinhadas com as linhas do novo, e a busca acharia a entidade errada.</remarks>
    /// <summary>Todas as pessoas jurídicas que receberam emenda, com a sede e a <see cref="ChaveDeBusca"/> de cada nome. Em cache: ~31 mil linhas.</summary>
    /// <remarks>ATENÇÃO: a chave mora no mesmo objeto guardado: numa entrada de cache própria, com validade própria, as chaves
    /// de um índice antigo ficariam alinhadas com as linhas do novo, e a busca acharia a entidade errada.</remarks>
    private async Task<IndiceDeEntidades> IndiceComChavesAsync(CancellationToken ct) =>
        await _leitura.ObterAsync("entidades:indice", async () =>
        {
            var itens = await CalcularIndiceAsync(ct);
            return new IndiceDeEntidades(itens, [.. itens.Select(e => ChaveDeBusca.De(e.Nome))]);
        });

    private async Task<IReadOnlyList<EntidadeNaListaDto>> IndiceAsync(CancellationToken ct) => (await IndiceComChavesAsync(ct)).Itens;

    private sealed record IndiceDeEntidades(IReadOnlyList<EntidadeNaListaDto> Itens, string[] Chaves);

    private async Task<IReadOnlyList<EntidadeNaListaDto>> CalcularIndiceAsync(CancellationToken ct)
    {

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
    }

    /// <summary>A entidade calculada inteira uma vez e guardada: as páginas das listas leem daqui.</summary>
    private async Task<(EntidadeNaListaDto Lista, DetalheDaEntidade Detalhe)?> CalculadaAsync(string cnpj, CancellationToken ct)
    {
        var lista = (await IndiceAsync(ct)).FirstOrDefault(e => e.Cnpj == cnpj);
        if (lista is null)
        {
            return null;
        }

        var detalhe = await _leitura.ObterAsync($"entidades:{cnpj}", async () =>
        {
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
            .OrderBy(a => a.AnoDaEmenda)
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

        if (porPessoa.Count == 0)
        {
            return null;
        }

        var legislatura = (await _parlamentares.ParlamentaresDaLegislaturaAsync(ct)).ToDictionary(p => p.IdPessoa);
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
