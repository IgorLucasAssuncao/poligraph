using System.Globalization;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Services;

/// <summary>
/// A busca do cabeçalho: um nome, e a resposta nos três lugares onde ele pode estar.
/// </summary>
/// <remarks>
/// <para>
/// Quem chega com um nome não sabe se é de parlamentar, cidade ou entidade — "São Paulo" é
/// as três coisas. A busca responde nos três, cada um no seu grupo, e a pessoa escolhe.
/// </para>
/// <para>Cada grupo reusa a busca da própria página: o resultado do cabeçalho é o mesmo que a página daria.</para>
/// </remarks>
public class ServicoBusca(ServicoParlamentares parlamentares, ServicoMapaDeEmendas mapa, ServicoEntidades entidades)
{
    public const int PorGrupo = 5;
    public const int TamanhoMinimo = 2;

    private static readonly CompareInfo Comparacao = CultureInfo.GetCultureInfo("pt-BR").CompareInfo;
    private const CompareOptions SemCaixaNemAcento = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;

    private readonly ServicoParlamentares _parlamentares = parlamentares;
    private readonly ServicoMapaDeEmendas _mapa = mapa;
    private readonly ServicoEntidades _entidades = entidades;

    public async Task<BuscaDto> BuscarAsync(string? termo, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(termo) || termo.Trim().Length < TamanhoMinimo) return new BuscaDto([], [], []);

        var busca = termo.Trim();

        var todos = await _parlamentares.ParlamentaresDeTodasAsync(ct);
        var parlamentares = todos
            .Select(p => new { Parlamentar = p, Posicao = Comparacao.IndexOf(p.Nome, busca, SemCaixaNemAcento) })
            .Where(p => p.Posicao >= 0)
            .OrderBy(p => p.Posicao == 0 ? 0 : 1)
            .ThenByDescending(p => p.Parlamentar.Legislatura)
            .ThenByDescending(p => p.Parlamentar.NVotacoes)
            .Take(PorGrupo)
            .Select(p => p.Parlamentar)
            .ToList();

        return new BuscaDto(
            parlamentares,
            [.. (await _mapa.BuscarAsync(busca, ct)).Take(PorGrupo)],
            await _entidades.BuscarAsync(busca, ct),
            todos.Count > 0 ? todos[0].Legislatura : null);
    }
}
