namespace Poligraph.Api.Services;

/// <summary>Como o parlamentar se posicionou na afirmação de uma pergunta.</summary>
/// <param name="VotoModel">+1 sim · -1 não · 0 abstenção · null ausente.</param>
/// <param name="Polaridade">+1 "Sim" aprova a afirmação · -1 "Sim" a rejeita.</param>
public readonly record struct PosicaoParlamentar(short? VotoModel, short Polaridade);
