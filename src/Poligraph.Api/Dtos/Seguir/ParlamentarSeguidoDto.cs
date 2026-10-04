using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record ParlamentarSeguidoDto(
    long IdPessoa, string Nome, TipoCasa? Casa, string Partido, string Uf);
