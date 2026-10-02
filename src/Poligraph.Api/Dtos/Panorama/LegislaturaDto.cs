using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma legislatura que a base tem, para o seletor do site. Sai das votações: legislatura
/// sem votação ingerida não aparece.
/// </summary>
/// <param name="Corrente">A maior da base — a que o site mostra quando ninguém escolhe outra.</param>
/// <param name="Casas">As casas com votação naquela legislatura.</param>
public record LegislaturaDto(
    short Numero,
    int AnoInicial,
    int AnoFinal,
    bool Corrente,
    IReadOnlyList<TipoCasa> Casas);
