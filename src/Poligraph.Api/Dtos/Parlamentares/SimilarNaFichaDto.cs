using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record SimilarNaFichaDto(long PessoaId, string Nome, string Partido, float Valor, int Comuns);
