using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// Onde o cidadão cai no grafo.
///
/// Centroide ponderado dos parlamentares com quem ele mais concordou — ou seja, ele
/// é posicionado ENTRE as pessoas com quem se parece, que é a leitura honesta.
///
/// `BaseDeVotacoes` existe para a tela poder ser franca: a posição do cidadão vale
/// sobre as perguntas que ele respondeu (dezenas), a de cada deputado sobre a
/// legislatura inteira (mais de mil). Não é a mesma medida com o mesmo nome, e
/// esconder isso seria afirmar uma precisão que o dado não tem.
/// </summary>
public record PosicaoDoCidadaoDto(
    float EixoX,
    float EixoY,
    short? Comunidade,
    int VizinhosUsados,
    int BaseDeVotacoes);
