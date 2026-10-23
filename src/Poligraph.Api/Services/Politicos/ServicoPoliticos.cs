using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// Os políticos eleitos que o TSE publica, de todos os cargos da base: a lista com filtro por nível, cargo, UF e município (Pendência 90, fase 2).
/// </summary>
/// <remarks>
/// <para>O índice cabe na memória: MEDIDO em 2026-10-21, 73 mil mandatos de 2000 a 2024 (1998 entrou depois, com mais 1.599). Ele é montado uma vez por <see cref="CacheDeLeitura.Validade"/>, e cada filtro roda sobre ele.</para>
/// <para>DECISÃO: o mandato mostrado é o mais recente que passa no filtro. Quem foi prefeito e depois deputado aparece como prefeito ao filtrar por município, e como deputado sem filtro.</para>
/// </remarks>
public class ServicoPoliticos(PoligraphDb db, CacheDeLeitura leitura, ServicoParlamentares parlamentares)
{
    public const int ItensPorPagina = 20;

    private static readonly CompareInfo Comparacao = CultureInfo.GetCultureInfo("pt-BR").CompareInfo;
    private const CompareOptions SemCaixaNemAcento = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;

    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;
    private readonly ServicoParlamentares _parlamentares = parlamentares;

    /// <summary>A lista filtrada, do mandato mostrado mais recente ao mais antigo; no mesmo ano, do nível federal ao municipal.</summary>
    public async Task<PaginaDto<PoliticoNaListaDto>> ListarAsync(FiltroDePoliticos filtro, int pagina, CancellationToken ct)
    {
        pagina = Math.Max(pagina, 1);
        var filtrados = Filtrar(await IndiceAsync(ct), filtro)
            .OrderByDescending(p => p.Mandato.UltimoAno)
            .ThenBy(p => p.Mandato.Nivel)
            .ToList();

        return new PaginaDto<PoliticoNaListaDto>(
            [.. filtrados.Skip((pagina - 1) * ItensPorPagina).Take(ItensPorPagina)],
            pagina, ItensPorPagina, filtrados.Count);
    }

    /// <summary>Os primeiros pelo nome, para a busca do cabeçalho: quem começa com o termo, depois o nível mais alto e o mandato mais recente. Parlamentares ficam fora: o cabeçalho já tem o grupo deles.</summary>
    public async Task<IReadOnlyList<PoliticoNaListaDto>> BuscarAsync(string busca, int quantos, CancellationToken ct) =>
        [.. Filtrar(await IndiceAsync(ct), new FiltroDePoliticos(busca, null, null, null, null))
            .Where(p => !p.Parlamentar)
            .OrderBy(p => Comparacao.IsPrefix(p.Nome, busca, SemCaixaNemAcento) ? 0 : 1)
            .ThenBy(p => p.Mandato.Nivel)
            .ThenByDescending(p => p.Mandato.UltimoAno)
            .Take(quantos)];

    /// <summary>A ficha pelos mandatos: quem é, cada mandato e as redes. Nulo para quem não existe ou não tem mandato no TSE, e o endpoint responde 404.</summary>
    public async Task<FichaDoPoliticoDto?> ObterFichaAsync(IdPessoa idPessoa, CancellationToken ct)
    {
        var politico = (await IndiceAsync(ct)).FirstOrDefault(p => p.IdPessoa == idPessoa.Valor);
        if (politico is null)
        {
            return null;
        }

        var nomeCivil = await _db.Pessoas.AsNoTracking()
            .Where(p => p.Id == idPessoa.Valor)
            .Select(p => p.NomeCivil)
            .FirstOrDefaultAsync(ct);

        return new FichaDoPoliticoDto(
            politico.IdPessoa, politico.Nome, nomeCivil, politico.UrlFoto, politico.Parlamentar,
            politico.Mandatos, await _parlamentares.RedesSociaisAsync(idPessoa.Valor, ct));
    }

    private static IEnumerable<PoliticoNaListaDto> Filtrar(IReadOnlyList<PoliticoNoIndice> indice, FiltroDePoliticos filtro)
    {
        var busca = filtro.Busca?.Trim();
        foreach (var politico in indice)
        {
            if (!string.IsNullOrEmpty(busca) && Comparacao.IndexOf(politico.Nome, busca, SemCaixaNemAcento) < 0)
            {
                continue;
            }

            var mandato = politico.Mandatos.FirstOrDefault(m => filtro.Aceita(m));
            if (mandato is not null)
            {
                yield return new PoliticoNaListaDto(
                    politico.IdPessoa, politico.Nome, politico.UrlFoto, mandato, politico.Mandatos.Count, politico.Parlamentar);
            }
        }
    }

    /// <summary>Todo político com mandato, do último ano de mandato mais recente ao mais antigo, e os mandatos de cada um na mesma ordem.</summary>
    private Task<IReadOnlyList<PoliticoNoIndice>> IndiceAsync(CancellationToken ct) =>
        _leitura.ObterAsync("politicos:indice", () => CalcularIndiceAsync(ct));

    private async Task<IReadOnlyList<PoliticoNoIndice>> CalcularIndiceAsync(CancellationToken ct)
    {
        var mandatos = await _db.Mandatos.AsNoTracking()
            .Select(m => new { m.PessoaId, m.Cargo, m.AnoEleicao, m.PrimeiroAno, m.UltimoAno, m.Uf, m.CodigoMunicipioIbge, m.Partido })
            .ToListAsync(ct);

        var municipios = await _db.Municipios.AsNoTracking()
            .Where(mu => _db.Mandatos.Any(m => m.CodigoMunicipioIbge == mu.CodigoIbge))
            .Select(mu => new MunicipioDto(mu.CodigoIbge, mu.Nome, mu.Uf))
            .ToDictionaryAsync(mu => mu.CodigoIbge, ct);

        var pessoas = await _db.Pessoas.AsNoTracking()
            .Where(p => _db.Mandatos.Any(m => m.PessoaId == p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                p.UrlFoto,
                Parlamentar = _db.Votos.Any(v => v.PessoaId == p.Id),
            })
            .ToDictionaryAsync(p => p.Id, ct);

        var nome = StringComparer.Create(CultureInfo.GetCultureInfo("pt-BR"), CompareOptions.IgnoreCase);
        return [.. mandatos
            .Where(m => pessoas.ContainsKey(m.PessoaId))
            .GroupBy(m => m.PessoaId)
            .Select(g =>
            {
                var pessoa = pessoas[g.Key];
                List<MandatoNoTseDto> daPessoa = [.. g
                    .DistinctBy(m => (m.Cargo, m.AnoEleicao, m.Uf, m.CodigoMunicipioIbge))
                    .OrderByDescending(m => m.UltimoAno)
                    .ThenBy(m => m.Cargo)
                    .Select(m => new MandatoNoTseDto(
                        m.Cargo, m.Cargo.Nivel(), m.AnoEleicao, m.PrimeiroAno, m.UltimoAno, m.Uf,
                        m.CodigoMunicipioIbge is null ? null : municipios.GetValueOrDefault(m.CodigoMunicipioIbge),
                        m.Partido))];
                return new PoliticoNoIndice(pessoa.Id, pessoa.NomeExibicao, pessoa.UrlFoto, daPessoa, pessoa.Parlamentar);
            })
            .OrderByDescending(p => p.Mandatos[0].UltimoAno)
            .ThenBy(p => p.Nome, nome)];
    }

    private sealed record PoliticoNoIndice(
        long IdPessoa, string Nome, string? UrlFoto, IReadOnlyList<MandatoNoTseDto> Mandatos, bool Parlamentar);
}

/// <summary>Os filtros da lista de políticos; nulo é "todos".</summary>
public record FiltroDePoliticos(string? Busca, TipoNivel? Nivel, TipoCargo? Cargo, Uf? Uf, CodigoIbge? Municipio)
{
    /// <summary>O mandato passa em todos os filtros de ente e cargo. O nome é filtrado à parte, por pessoa.</summary>
    public bool Aceita(MandatoNoTseDto mandato) =>
        (Nivel is null || mandato.Nivel == Nivel)
        && (Cargo is null || mandato.Cargo == Cargo)
        && (Uf is null || mandato.Uf == Uf.Value.Sigla)
        && (Municipio is null || mandato.Municipio?.CodigoIbge == Municipio.Value.Digitos);
}
