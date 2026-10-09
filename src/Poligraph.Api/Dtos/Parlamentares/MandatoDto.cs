using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma legislatura em que a pessoa votou, numa casa. Sai dos votos, não de cadastro:
/// mandato sem voto registrado não tem o que a ficha mostrar.
/// </summary>
/// <param name="Partido">Do último voto DENTRO da legislatura — a sigla de então.</param>
/// <param name="AnoInicial">Ano da posse da legislatura, que dura quatro anos.</param>
/// <param name="PrimeiroVoto">Data do primeiro voto registrado na legislatura.</param>
/// <param name="UltimoVoto">Data do último voto registrado na legislatura. Quem saiu antes do fim (para ser prefeito, ministro) ou entrou depois (suplente) não votou a legislatura inteira.</param>
public record MandatoDto(
    short Legislatura,
    TipoCasa Casa,
    int AnoInicial,
    string Partido,
    string Uf,
    int NRegistrosDeVoto,
    DateOnly PrimeiroVoto,
    DateOnly UltimoVoto);
