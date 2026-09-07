using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// <c>Legislatura</c> pode vir nula, e a tela precisa disso: base sem votação é o
/// estado real antes do primeiro ETL, e inventar 57 esconderia isso atrás de um número
/// que parece certo.
/// </summary>
public record PanoramaDto(
    short? Legislatura,
    int PerguntasAtivas,
    IReadOnlyList<PanoramaDaCasaDto> PorCasa);
