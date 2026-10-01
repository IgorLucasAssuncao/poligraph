namespace Poligraph.Api.Dtos;

/// <summary>Os convênios que as emendas do ano financiam.</summary>
public record ConveniosDaEmendaDto(int Quantidade, IReadOnlyList<ConvenioDaEmendaDto> Maiores);
