using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record SimilarNaFichaDto(long IdPessoa, string Nome, string Partido, float Valor, int Comuns, string? UrlFoto = null, string Uf = "");
