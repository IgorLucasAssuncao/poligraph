using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// As emendas do parlamentar num ano.
///
/// <para>
/// <b>Empenhado ≠ pago, e a distância entre os dois é a informação.</b> Empenhar é
/// reservar; pagar é o dinheiro sair. Mostrar só um responderia metade da pergunta — e
/// seria a metade que favorece quem só anuncia.
/// </para>
/// <para>
/// <c>PagoDepois</c> são os restos a pagar pagos: empenho do ano pago nos anos seguintes. A ficha
/// mostrava só <c>Pago</c>, e uma emenda de 2024 com 98% pago aparecia com 54% (2026-10-03).
/// </para>
/// </summary>
public record EmendasDoParlamentarDto(
    int AnoDaEmenda,
    decimal Empenhado,
    decimal Pago,
    decimal PagoDepois,
    int Quantidade,
    IReadOnlyList<EmendaPorDestinoDto> PorDestino,
    IReadOnlyList<EmendaPorFuncaoDto> PorFuncao,
    FavorecidosDaEmendaDto Favorecidos,
    IReadOnlyList<PagamentoPorMesDto> PagamentosPorMes,
    ConveniosDaEmendaDto Convenios,
    CidadesDaEmendaDto Cidades,
    IReadOnlyList<CaminhoDaEmendaDto> Caminhos);

/// <summary>
/// As cidades que receberam, pela sede de quem recebeu — CNPJ → TOM → IBGE, chave forte.
/// </summary>
/// <remarks>
/// <para>
/// Responde "para onde foi" melhor que a localidade DECLARADA na emenda, que em boa parte
/// diz "MÚLTIPLO", o estado inteiro ou "Nacional". A declarada continua nos detalhes.
/// </para>
/// </remarks>
public record CidadesDaEmendaDto(int Quantidade, IReadOnlyList<RecebidoNaCidadeDto> Maiores);

public record RecebidoNaCidadeDto(MunicipioDto Municipio, decimal Recebido);
