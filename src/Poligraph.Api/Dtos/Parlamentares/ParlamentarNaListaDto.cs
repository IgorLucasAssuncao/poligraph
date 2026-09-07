using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record ParlamentarNaListaDto(
    long Id, string Nome, TipoCasa? Casa, string Partido, string Uf, int NVotacoes, string? UrlFoto);
