namespace Poligraph.Api.Services;

/// <summary>
/// Em quais perguntas o parlamentar concordou com o cidadão, e em quais não.
/// As duas listas somadas dão <c>Comparaveis</c>, nunca o total respondido.
/// </summary>
public readonly record struct DetalheDaAfinidade(
    IReadOnlyList<string> Acordou, IReadOnlyList<string> Discordou);
