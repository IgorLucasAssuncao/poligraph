using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// <c>Legislatura</c> pode vir nula, e a tela precisa disso: base sem votação é o
/// estado real antes do primeiro ETL, e inventar 57 esconderia isso atrás de um número
/// que parece certo.
/// </summary>
/// <param name="PerguntasAtivas">O poço: todas as perguntas curadas e ativas.</param>
/// <param name="PerguntasNoQuestionario">
/// Quantas o cidadão responde, tiradas do poço. Poço e questionário não são a mesma coisa:
/// a página inicial dizia "49 perguntas" e o questionário mostrava "1 de 24".
/// </param>
public record PanoramaDto(
    short? Legislatura,
    int PerguntasAtivas,
    IReadOnlyList<PanoramaDaCasaDto> PorCasa,
    int PerguntasNoQuestionario = 0);
