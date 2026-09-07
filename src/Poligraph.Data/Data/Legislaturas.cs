using Microsoft.EntityFrameworkCore;

namespace Poligraph.Data;

/// <summary>
/// De qual legislatura o site está falando — <b>derivado do dado, nunca configurado</b>.
///
/// <para>
/// <b>PL35.</b> A decisão "só a 57ª" vivia no documento e não no código: nenhuma
/// consulta filtrava por legislatura, e passava porque o banco tinha uma só. Com a 58ª,
/// o painel do questionário mostraria <i>"480 de 900"</i> — número plausível, tela
/// intacta, mesmo formato do bug de polaridade. A 57ª termina em janeiro de 2027.
/// </para>
///
/// <para>
/// Configurar em <c>appsettings</c> seria mais uma coisa a esquecer de virar na posse
/// da 58ª, e o erro reapareceria como número plausível.
/// </para>
/// </summary>
public static class Legislaturas
{
    /// <summary>
    /// A legislatura corrente: a maior que existe em <c>votacoes</c>.
    ///
    /// <para>
    /// Devolve <c>null</c> em base sem votação — antes do primeiro ETL. Inventar 57
    /// aqui esconderia uma base vazia atrás de um número que parece certo.
    /// </para>
    /// </summary>
    public static async Task<short?> CorrenteAsync(PoligraphDb db, CancellationToken ct) =>
        await db.Votacoes.AsNoTracking().MaxAsync(votacao => (short?)votacao.Legislatura, ct);

    /// <summary>
    /// As legislaturas das perguntas <b>ativas</b> — o denominador do painel sai daqui.
    ///
    /// <para>
    /// Não é <see cref="CorrenteAsync"/>, e a diferença aparece na virada: se a 58ª
    /// já está no banco mas as perguntas ainda são da 57ª, contar deputados da 58ª daria
    /// um denominador que não corresponde às votações mostradas.
    /// </para>
    ///
    /// <para>
    /// Conjunto, não valor único: um pool que atravesse duas legislaturas é
    /// possível, e aí o denominador correto é a união.
    /// </para>
    /// </summary>
    public static async Task<List<short>> DasPerguntasAtivasAsync(
        PoligraphDb db, CancellationToken ct) =>
        await db.Perguntas.AsNoTracking()
            .Where(pergunta => pergunta.Ativa)
            .Select(pergunta => pergunta.Votacao!.Legislatura)
            .Distinct()
            .ToListAsync(ct);
}
