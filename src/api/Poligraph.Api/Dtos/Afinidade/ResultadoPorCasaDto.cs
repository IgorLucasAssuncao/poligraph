using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// O resultado de UMA casa.
///
/// <para>
/// <b>O piso de comparáveis vale por casa, e não sobre o total.</b> Com 21 perguntas da
/// Câmara e 7 do Senado, um piso de 60% sobre as 28 daria 17 — e um senador tem no
/// máximo 7 comparáveis. Todo senador seria filtrado, e a lista do Senado nasceria
/// vazia para sempre, sem erro nenhum.
/// </para>
///
/// <para>
/// <c>PerguntasRespondidas</c> é o denominador honesto desta casa: quantas perguntas
/// dela o cidadão respondeu. É o número que a tela usa em "concordaram em 4 de 6".
/// </para>
/// </summary>
public record ResultadoPorCasaDto(
    TipoCasa Casa,
    int PerguntasRespondidas,
    IReadOnlyList<ParlamentarAfimDto> MaisProximos,
    IReadOnlyList<ParlamentarAfimDto> MaisDistantes,
    PosicaoDoCidadaoDto? PosicaoNoGrafo,
    EscalaDaCasaDto Escala,
    short? Legislatura = null);
