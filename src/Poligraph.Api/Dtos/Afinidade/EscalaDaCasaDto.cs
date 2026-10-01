namespace Poligraph.Api.Dtos;

/// <summary>
/// Onde o resultado do cidadão cai entre todos os parlamentares da casa.
/// </summary>
/// <remarks>
/// <para>
/// "8 de 11" é honesto, mas não diz se é muito. O parlamentar do meio da lista dá a
/// régua: se o mediano votou como você em 5 de 11, o 8 do primeiro é alto. Vai como
/// contagem, com a base, e não como percentual (RF-29).
/// </para>
/// </remarks>
public record EscalaDaCasaDto(int Comparados, int MedianoAcordos, int MedianoComparaveis);
