using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>O que aconteceu num ano da vida pública de uma pessoa, do ano mais recente ao mais antigo (Pendência 92).</summary>
public record LinhaDoTempoDto(IReadOnlyList<AnoNaLinhaDoTempoDto> Anos);

/// <summary>Os marcos de um ano, na ordem: eleição, partido, voto, bens, cota e emendas.</summary>
public record AnoNaLinhaDoTempoDto(int Ano, IReadOnlyList<MarcoDto> Marcos);

/// <summary>Os tipos de marco. Cada um tem a sua fonte, que a tela diz.</summary>
public enum TipoDeMarco
{
    ELEITO,
    TROCOU_DE_PARTIDO,
    VOTOU,
    DECLAROU_BENS,
    GASTOU_NA_COTA,
    EMENDAS_PAGAS,
}

/// <summary>Um marco. Só os campos do tipo vêm preenchidos.</summary>
/// <param name="Mandato">Em <see cref="TipoDeMarco.ELEITO"/>.</param>
/// <param name="Partido">O partido novo em <see cref="TipoDeMarco.TROCOU_DE_PARTIDO"/>.</param>
/// <param name="PartidoAnterior">Em <see cref="TipoDeMarco.TROCOU_DE_PARTIDO"/>.</param>
/// <param name="Quantidade">Votações com registro em <see cref="TipoDeMarco.VOTOU"/>; bens em <see cref="TipoDeMarco.DECLAROU_BENS"/>.</param>
/// <param name="Valor">Em reais: bens, cota ou, nas emendas, o empenhado.</param>
/// <param name="Pago">Só nas emendas: o pago das emendas apresentadas no ano.</param>
public record MarcoDto(
    TipoDeMarco Tipo,
    MandatoNoTseDto? Mandato = null,
    string? Partido = null,
    string? PartidoAnterior = null,
    int? Quantidade = null,
    decimal? Valor = null,
    decimal? Pago = null);
