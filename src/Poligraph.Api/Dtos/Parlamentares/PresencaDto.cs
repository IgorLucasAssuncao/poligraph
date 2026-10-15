namespace Poligraph.Api.Dtos;

/// <summary>
/// Em quantas votações de plenário o parlamentar estava — a resposta a "ele vai às votações?".
/// </summary>
/// <remarks>
/// <para>
/// Sempre com a base: <see cref="Presente"/> de <see cref="Votacoes"/>, não percentual solto.
/// Estar presente não é ter posição: votar secreto ou obstruir contam como presença.
/// </para>
/// <para>
/// As casas registram de jeitos diferentes, e a tela diz isso. O Senado publica a ausência e
/// a justificativa dela (licença, missão), e <see cref="JustificativaPublicada"/> é verdadeiro.
/// A Câmara lista só quem votou: a ausência é a falta da linha, contada contra as votações
/// entre o primeiro e o último voto do deputado — e licença para ser ministro conta como
/// ausência, porque o registro não a separa.
/// </para>
/// </remarks>
public record PresencaDto(
    int Presente,
    int Votacoes,
    int Ausente,
    int? AusenteJustificado,
    bool JustificativaPublicada,
    DateOnly Desde,
    DateOnly Ate,
    double? MedianaDaCasa = null);
