namespace Poligraph.Api.Services;

/// <summary>Resposta do cidadão a uma pergunta.</summary>
/// <param name="PerguntaId">Ex.: "q1" — ⚠️ nunca o idVotacao.</param>
/// <param name="Valor">+1 concordo · -1 discordo · 0 não sei.</param>
public readonly record struct RespostaCidadao(string PerguntaId, short Valor);
