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
    IReadOnlyList<EmendaPorFuncaoDto> PorFuncao);
