using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record ParlamentarSeguidoDto(
    long PessoaId, string Nome, Casa? Casa, string Partido, string Uf);
