using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record ParlamentarSeguidoDto(
    long PessoaId, string Nome, TipoCasa? Casa, string Partido, string Uf);
