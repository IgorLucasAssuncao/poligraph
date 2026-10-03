namespace Poligraph.Api.Dtos;

/// <summary>
/// O caminho do dinheiro de emenda num período (Pendência 83): quem mandou, quem recebeu e a cidade
/// da sede de quem recebeu, como grafo direcionado em três colunas.
/// </summary>
/// <remarks>
/// <para>O total dos nós de cada coluna é o mesmo, e é o pago no período (no estado, o pago a quem tem sede nele). O que não tem cidade, o repasse por banco e o pago a pessoas aparecem como nós próprios: nada some do desenho.</para>
/// </remarks>
public record FluxoDeEmendasDto(
    PeriodoDto Periodo, string? Uf, decimal Total,
    IReadOnlyList<NoDoFluxoDto> Nos, IReadOnlyList<ArestaDoFluxoDto> Arestas);

/// <summary>Um nó: <c>Coluna</c> 0 é quem mandou, 1 quem recebeu, 2 a cidade. <c>Destino</c> é o endereço no site, quando há.</summary>
public record NoDoFluxoDto(string Id, string Rotulo, int Coluna, string Tipo, decimal Valor, string? Destino);

public record ArestaDoFluxoDto(string De, string Para, decimal Valor);
