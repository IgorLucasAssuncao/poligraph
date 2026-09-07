using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record NoticiaNaFichaDto(
    long Id, string Url, string Titulo, string Veiculo,
    DateTimeOffset PublicadaEm, string? Trecho);
