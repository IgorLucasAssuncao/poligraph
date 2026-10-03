using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// `TotalVotos` é o comparecimento na votação — quantos deputados se posicionaram.
/// `TotalPossivel` é o número de cadeiras da casa (<see cref="Cadeiras"/>), o denominador.
///
/// De propósito NÃO é a divisão (quantos Sim, quantos Não). Mostrar o placar antes
/// de a pessoa responder induziria conformidade: "a maioria votou Sim, então voto Sim
/// também" — e o instrumento passaria a medir adesão à maioria, não posição própria.
/// O comparecimento dá contexto sem revelar direção.
///
/// Os dois números juntos são o que a tela desenha como "painel": uma marca por
/// parlamentar, cheia para quem se posicionou. Sem o denominador, 300 e 480 marcas
/// seriam indistinguíveis a olho.
/// </summary>
public record PerguntaPublicaDto(
    string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);
