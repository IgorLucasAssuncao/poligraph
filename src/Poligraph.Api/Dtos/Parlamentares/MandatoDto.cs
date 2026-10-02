using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma legislatura em que a pessoa votou, numa casa. Sai dos votos, não de cadastro:
/// mandato sem voto registrado não tem o que a ficha mostrar.
/// </summary>
/// <param name="Partido">Do último voto DENTRO da legislatura — a sigla de então.</param>
/// <param name="AnoInicial">Ano da posse da legislatura, que dura quatro anos.</param>
public record MandatoDto(
    short Legislatura,
    TipoCasa Casa,
    int AnoInicial,
    string Partido,
    string Uf,
    int NRegistrosDeVoto);
