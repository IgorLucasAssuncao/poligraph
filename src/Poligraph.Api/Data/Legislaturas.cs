using Microsoft.EntityFrameworkCore;

namespace Poligraph.Api.Data;

/// <summary>
/// 🔴 **PL35 — de qual legislatura o site está falando.**
///
/// [`plano/06 §3`](../../../docs/plano/06-perguntas-lote-1.md) decidiu **só a legislatura
/// 57**, com quatro motivos medidos. ⛔ Mas a decisão vivia só no documento: `Legislatura`
/// existia na entidade, era indexada, e **nenhuma consulta de afinidade ou de ficha a
/// usava**. Passava porque o banco tinha uma legislatura só.
///
/// ⚠️ **É o mesmo formato do bug de polaridade: ⛔ não quebra a tela.** Com a 58ª no
/// banco, o painel do questionário mostraria *"480 de 900"* — um número plausível, sem
/// exceção nenhuma, contando deputados que nunca votaram aquelas votações.
///
/// ⏳ E tem prazo: a 57ª termina em **janeiro de 2027**.
///
/// ⭐ **Aqui a legislatura é DERIVADA, ⛔ nunca configurada.** Dado repetido em
/// `appsettings` seria mais uma coisa a esquecer de virar na posse da 58ª — e o erro
/// apareceria como número plausível, de novo.
/// </summary>
public static class Legislaturas
{
    /// <summary>
    /// A legislatura corrente: a **maior** que existe em `votacoes`.
    ///
    /// ⚠️ Devolve `null` quando ⛔ não há votação nenhuma — base recém-criada, antes do
    /// primeiro ETL. Quem chama decide o que fazer; ⛔ inventar 57 aqui esconderia uma
    /// base vazia atrás de um número que parece certo.
    /// </summary>
    public static async Task<short?> CorrenteAsync(PoligraphDb db, CancellationToken ct) =>
        await db.Votacoes.AsNoTracking().MaxAsync(v => (short?)v.Legislatura, ct);

    /// <summary>
    /// As legislaturas das perguntas **ativas** do questionário.
    ///
    /// 🔴 O denominador do painel sai daqui, ⛔ não de <see cref="CorrenteAsync"/>. A
    /// diferença importa na virada: se a 58ª já está no banco mas as perguntas ainda são
    /// da 57ª, contar deputados da 58ª daria um denominador que ⛔ **não** corresponde às
    /// votações mostradas.
    ///
    /// ⭐ Devolve conjunto, ⛔ não valor único: um pool que atravesse duas legislaturas é
    /// possível, e nesse caso o denominador correto é a união — ⛔ não "a primeira".
    /// </summary>
    public static async Task<List<short>> DasPerguntasAtivasAsync(
        PoligraphDb db, CancellationToken ct) =>
        await db.Perguntas.AsNoTracking()
            .Where(p => p.Ativa)
            .Select(p => p.Votacao!.Legislatura)
            .Distinct()
            .ToListAsync(ct);
}
