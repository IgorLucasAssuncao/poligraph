using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// O bloco de abertura mais o TAMANHO do questionário completo.
///
/// <para>
/// 🔴 <c>Total</c> existe por causa da barra de progresso. As perguntas de desempate só
/// podem ser escolhidas depois das respostas de base, então a primeira resposta traz
/// menos perguntas do que o questionário terá. Sem declarar o total, a tela mostraria
/// "Pergunta 9 de 17" e o denominador saltaria para 24 no meio — quem estava quase
/// terminando voltaria a estar pela metade.
/// </para>
/// </summary>
public record QuestionarioDto(IReadOnlyList<PerguntaPublicaDto> Perguntas, int Total);
