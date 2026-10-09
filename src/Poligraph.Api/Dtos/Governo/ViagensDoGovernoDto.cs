namespace Poligraph.Api.Dtos;

/// <summary>
/// As viagens a serviço do Executivo federal num período: quanto custaram, quem viajou mais e para onde.
/// </summary>
/// <remarks>
/// <para>Os valores são os pagos (arquivo de pagamentos do Portal). Hospedagem não tem valor próprio: a diária paga hospedagem, alimentação e deslocamento urbano.</para>
/// <para><see cref="Sigiloso"/> é o que o Portal publica com o órgão <c>Sigiloso</c>; está em <see cref="PorOrgao"/> como as outras linhas.</para>
/// <para><see cref="Destinos"/> conta chegadas (trechos), não pessoas: uma viagem de ida e volta chega a dois lugares.</para>
/// </remarks>
public record ViagensDoGovernoDto(
    PeriodoDto Periodo,
    IReadOnlyList<int> AnosDisponiveis,
    decimal Total,
    decimal Diarias,
    decimal Passagens,
    decimal Restituicao,
    decimal Seguro,
    int Viagens,
    int Urgentes,
    int NaoRealizadas,
    decimal Sigiloso,
    IReadOnlyList<ViagensNoAnoDto> PorAno,
    IReadOnlyList<ViagensDoOrgaoDto> PorOrgao,
    IReadOnlyList<DestinoDeViagemDto> Destinos,
    IReadOnlyList<DestinoDeViagemDto> DestinosNoExterior);

/// <summary>Um ano de viagens.</summary>
public record ViagensNoAnoDto(int AnoDaViagem, decimal Diarias, decimal Passagens, decimal Total, int Viagens);

/// <summary>Um órgão superior no período.</summary>
public record ViagensDoOrgaoDto(string Orgao, decimal Total, decimal Diarias, decimal Passagens, int Viagens, int Urgentes);

/// <summary>Um destino no período. <see cref="Uf"/> por extenso, nula fora do Brasil.</summary>
public record DestinoDeViagemDto(string Pais, string? Uf, string Cidade, int Chegadas);
