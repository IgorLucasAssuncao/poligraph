namespace Poligraph.Api.Dtos;

/// <summary>
/// As viagens a serviço do Executivo federal num período: quanto custaram, quem viajou mais e para onde.
/// </summary>
/// <remarks>
/// <para>Os valores são os pagos (arquivo de pagamentos do Portal). Hospedagem não tem valor próprio: a diária paga hospedagem, alimentação e deslocamento urbano.</para>
/// <para><see cref="Sigiloso"/> é o que continua sem órgão: o Portal publica <c>Sigiloso</c> no pagamento e também na viagem. O que a viagem publica aberto foi para o órgão dela, e a soma está em <see cref="PagoComOrgaoSigiloso"/>.</para>
/// <para>Com <see cref="Orgao"/>, totais, anos e destinos são só desse órgão; <see cref="PorOrgao"/> continua com todos, para a escolha.</para>
/// <para><see cref="Destinos"/> conta chegadas (trechos), não pessoas: uma viagem de ida e volta chega a dois lugares.</para>
/// </remarks>
public record ViagensDoGovernoDto(
    PeriodoDto Periodo,
    IReadOnlyList<int> AnosDisponiveis,
    IReadOnlyList<GestaoDto> GestoesDisponiveis,
    string? Orgao,
    decimal Total,
    decimal Diarias,
    decimal Passagens,
    decimal Restituicao,
    decimal Seguro,
    int Viagens,
    int Urgentes,
    int NaoRealizadas,
    decimal Sigiloso,
    decimal PagoComOrgaoSigiloso,
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
