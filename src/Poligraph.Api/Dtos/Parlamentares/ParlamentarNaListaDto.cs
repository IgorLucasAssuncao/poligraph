using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <param name="Legislatura">
/// A última legislatura em que a pessoa votou. Igual à corrente para quem está em
/// exercício; menor para quem já saiu, que só aparece quando a lista os pede.
/// </param>
/// <param name="NVotacoes">Votos com posição NAQUELA legislatura, nunca a soma de mandatos.</param>
/// <param name="EmExercicio">Se está na lista oficial de quem está em exercício (<see cref="EmExercicioNaBase"/>): só esses podem ser seguidos. Preenchido na página da lista; nas listas internas fica falso.</param>
public record ParlamentarNaListaDto(
    long IdPessoa, string Nome, TipoCasa? Casa, string Partido, string Uf, int NVotacoes, string? UrlFoto,
    short Legislatura,
    bool EmExercicio = false);
