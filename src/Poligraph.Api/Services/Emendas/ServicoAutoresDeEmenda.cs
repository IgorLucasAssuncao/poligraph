using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Constantes;

namespace Poligraph.Api.Services;

/// <summary>
/// Quem mandou um dinheiro de emenda: os deputados e senadores, de um lado; as bancadas e
/// comissões, do outro.
/// </summary>
/// <remarks>
/// <para>
/// A emenda tem três autores possíveis (CF, art. 166), e só o individual é uma pessoa.
/// Separá-los é regra de tela, e não de uma tela só: o mapa e a página da entidade usam esta
/// mesma divisão, e uma cópia em cada uma divergiria no primeiro ajuste.
/// </para>
/// </remarks>
public class ServicoAutoresDeEmenda(PoligraphDb db, ServicoParlamentares parlamentares)
{
    private readonly PoligraphDb _db = db;
    private readonly ServicoParlamentares _parlamentares = parlamentares;

    /// <summary>Agrupa o recebido de cada emenda pelo autor dela.</summary>
    /// <remarks>
    /// <para>O autor sai da própria emenda, pelo código. Uma emenda ocupa várias linhas, mas o autor é o mesmo em todas: basta uma.</para>
    /// <para>Partido, casa, UF e foto vêm da lista da legislatura, a mesma da página de parlamentares.</para>
    /// </remarks>
    public async Task<(IReadOnlyList<ParlamentarQueMandouDto> Parlamentares, IReadOnlyList<ColetivoQueMandouDto> Coletivos)> AgruparAsync(
        IReadOnlyList<(string Codigo, decimal Recebido)> porEmenda, CancellationToken ct)
    {
        var codigos = porEmenda.Select(e => e.Codigo).ToList();
        var autores = (await _db.Emendas.AsNoTracking()
                .Where(e => codigos.Contains(e.CodigoEmenda))
                .Select(e => new { e.CodigoEmenda, e.CodigoAutor, e.NomeAutor, e.PessoaId, e.Tipo })
                .ToListAsync(ct))
            .GroupBy(e => e.CodigoEmenda)
            .ToDictionary(g => g.Key, g => g.First());

        var pessoas = (await _parlamentares.ParlamentaresDaLegislaturaAsync(ct)).ToDictionary(p => p.Id);
        var comAutor = porEmenda.Where(e => autores.ContainsKey(e.Codigo)).ToList();

        var individuais = comAutor
            .Where(e => ColetivoDe(autores[e.Codigo].Tipo) is null)
            .GroupBy(e => autores[e.Codigo].PessoaId?.ToString(CultureInfo.InvariantCulture) ?? autores[e.Codigo].CodigoAutor)
            .Select(g =>
            {
                var autor = autores[g.First().Codigo];
                var pessoa = autor.PessoaId is { } id ? pessoas.GetValueOrDefault(id) : null;
                return new ParlamentarQueMandouDto(
                    autor.PessoaId, pessoa?.Nome ?? autor.NomeAutor, pessoa?.Partido, pessoa?.Uf, pessoa?.Casa,
                    pessoa?.UrlFoto, g.Sum(e => e.Recebido), g.Count());
            })
            .OrderByDescending(a => a.Recebido)
            .ToList();

        var coletivos = comAutor
            .Where(e => ColetivoDe(autores[e.Codigo].Tipo) is not null)
            .GroupBy(e => autores[e.Codigo].CodigoAutor)
            .Select(g =>
            {
                var autor = autores[g.First().Codigo];
                return new ColetivoQueMandouDto(
                    ColetivoDe(autor.Tipo)!.Value, autor.NomeAutor, g.Sum(e => e.Recebido), g.Count());
            })
            .OrderByDescending(a => a.Recebido)
            .ToList();

        return (individuais, coletivos);
    }

    /// <summary>Nulo para a emenda individual, que é de uma pessoa; o tipo do coletivo nas outras.</summary>
    internal static TipoAutorColetivo? ColetivoDe(string? tipo) => tipo switch
    {
        null => null,
        _ when tipo.StartsWith(VocabularioDasFontes.EmendaIndividual, StringComparison.OrdinalIgnoreCase) => null,
        _ when tipo.Contains(VocabularioDasFontes.PalavraBancada, StringComparison.OrdinalIgnoreCase) => TipoAutorColetivo.BANCADA,
        _ when tipo.Contains(VocabularioDasFontes.InicioComissao, StringComparison.OrdinalIgnoreCase) => TipoAutorColetivo.COMISSAO,
        _ => TipoAutorColetivo.OUTRO,
    };
}
