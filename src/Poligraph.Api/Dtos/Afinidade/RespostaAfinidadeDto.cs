using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// O resultado completo — uma lista por casa.
///
/// <para>
/// O cidadão responde um fluxo único e nunca escolhe entre Câmara e Senado (RNF-28):
/// escolher exigiria justamente o conhecimento que ele não tem. As duas casas votam
/// matérias diferentes (achado #7), então o resultado se separa <b>depois</b> do
/// questionário, em "Deputados mais próximos" e "Senadores mais próximos" — o que é
/// autoexplicativo e não exige decisão prévia.
/// </para>
/// </summary>
public record RespostaAfinidadeDto(
    int TotalPerguntasRespondidas,
    IReadOnlyList<ResultadoPorCasaDto> PorCasa);
