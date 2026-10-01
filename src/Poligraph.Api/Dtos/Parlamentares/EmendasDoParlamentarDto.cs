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
/// </summary>
public record EmendasDoParlamentarDto(
    int Ano,
    decimal Empenhado,
    decimal Pago,
    int Quantidade,
    IReadOnlyList<EmendaPorDestinoDto> PorDestino,
    IReadOnlyList<EmendaPorFuncaoDto> PorFuncao,
    FavorecidosDaEmendaDto Favorecidos,
    IReadOnlyList<PagamentoPorMesDto> PagamentosPorMes,
    ConveniosDaEmendaDto Convenios,
    CidadesDaEmendaDto Cidades);

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
