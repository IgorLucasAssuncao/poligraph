namespace Poligraph.Api.Dtos;

/// <summary>Quem saiu da lista de seguidos por ter deixado o mandato, para o aviso do site.</summary>
/// <param name="NovaLegislatura">A legislatura que começou, quando a saída foi na virada (até 120 dias depois da posse); nula quando foi renúncia, cassação ou licença no meio do mandato.</param>
public record SeguidosEncerradosDto(short? NovaLegislatura, IReadOnlyList<SeguidoEncerradoDto> Parlamentares);

/// <summary>Um parlamentar que saiu da lista.</summary>
public record SeguidoEncerradoDto(long IdPessoa, string Nome);
