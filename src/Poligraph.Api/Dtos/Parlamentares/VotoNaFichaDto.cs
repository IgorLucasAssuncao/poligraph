using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// Um voto da ficha, com o que a bancada do Governo pediu naquela votação.
///
/// <para>
/// ⭐ <c>OrientacaoDoGoverno</c> é o que transforma o voto em informação. "Votou Sim"
/// sozinho ⛔ não diz nada; "votou Sim quando o Governo pediu Não" diz.
/// </para>
///
/// <para>
/// ⚠️ Nula com frequência, e por três motivos diferentes que a tela ⛔ não deve
/// confundir: o Governo ⛔ não orientou aquela votação, orientou <c>Obstrução</c> ou
/// <c>Liberado</c> — que ⛔ não são posição de mérito —, ou a casa é o Senado, que ⛔ não
/// publica orientação.
/// </para>
/// </summary>
/// <summary>
/// Um voto na ficha do parlamentar.
///
/// <para>
/// 🔴 <c>Descricao</c> sozinha ⛔ NÃO diz sobre o que era a votação. Ela é o registro
/// processual — <i>"Aprovado o Substitutivo ao Projeto de Lei nº 4.133, de 2023,
/// adotado pelo relator da Comissão de Ciência, Tecnologia e Inovação"</i> — e informa o
/// NÚMERO do projeto, ⛔ não o assunto.
/// </para>
///
/// <para>
/// ⭐ <c>Ementa</c> é o que o projeto propõe, e é o que torna o voto legível para quem
/// ⛔ não acompanha o Congresso. Veio com a PL40; a ficha era o lugar que ainda ⛔ não a
/// usava.
/// </para>
///
/// <para>
/// ⚠️ Nula em <b>todo o Senado</b> e em parte da Câmara — a ingestão de proposições é só
/// da Câmara, e lá cobre 263 das 266 substantivas. A tela mostra a descrição quando
/// falta, ⛔ nunca um espaço em branco.
/// </para>
///
/// <para>
/// 🔴 <b><c>Categoria</c> ⛔ não é enfeite — sem ela a ementa MENTE.</b> 📐 Medido em
/// 2026-08-29: <b>43,2%</b> das linhas desta lista são <c>PROCEDIMENTAL</c>. Nelas a
/// ementa é do projeto em pauta, mas o voto foi num <i>requerimento</i> — e a linha
/// <i>"Institui o Imposto sobre Bens e Serviços"</i> ao lado de um "Sim" faria o leitor
/// concluir que a pessoa votou a favor da reforma tributária, quando ela votou sobre
/// rito. ⭐ É o modo de falha que este projeto persegue: plausível e errado.
/// </para>
/// </summary>
public record VotoNaFichaDto(
    string VotacaoId,
    DateOnly Data,
    string? Descricao,
    short? Valor,
    string? OrientacaoDoGoverno,
    string? Ementa,
    string? Materia,
    CategoriaDeVotacao Categoria);
