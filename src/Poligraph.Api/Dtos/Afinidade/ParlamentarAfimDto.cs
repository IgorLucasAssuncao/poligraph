using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// ⛔ Sem percentual — a tela monta "concordou em X de Y" (RF-29).
///
/// <para>
/// ⭐ <c>Acordou</c> e <c>Discordou</c> são os ids das perguntas que produziram esse
/// "X de Y". Sem eles o número ⛔ não é conferível: o cidadão ⛔ não tem como saber se
/// os 14 acordos foram nas perguntas que ele considera importantes ou nas de data
/// comemorativa.
/// </para>
///
/// <para>
/// ⚠️ Id, ⛔ não texto — o front acabou de mostrar os enunciados e já os tem.
/// </para>
/// </summary>
public record ParlamentarAfimDto(
    long PessoaId,
    string Nome,
    string Partido,
    string Uf,
    int Acordos,
    int Comparaveis,
    IReadOnlyList<string> Acordou,
    IReadOnlyList<string> Discordou);
