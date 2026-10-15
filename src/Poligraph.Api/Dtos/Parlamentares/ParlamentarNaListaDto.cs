using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <param name="Legislatura">
/// A última legislatura em que a pessoa votou. Igual à corrente para quem está em
/// exercício; menor para quem já saiu, que só aparece quando a lista os pede.
/// </param>
/// <param name="NVotacoes">Votos com posição NAQUELA legislatura, nunca a soma de mandatos.</param>
public record ParlamentarNaListaDto(
    long IdPessoa, string Nome, TipoCasa? Casa, string Partido, string Uf, int NVotacoes, string? UrlFoto,
    short Legislatura);
