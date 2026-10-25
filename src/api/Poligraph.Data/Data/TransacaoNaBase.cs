using Microsoft.EntityFrameworkCore;

namespace Poligraph.Data;

/// <summary>
/// Várias gravações que valem juntas ou não valem: a transação dentro da estratégia de execução do EF.
/// </summary>
/// <remarks>
/// <para>RISCO: com a nova tentativa do Aspire ligada, <c>BeginTransactionAsync</c> solto é recusado pelo EF. Por isso a transação abre dentro de <c>CreateExecutionStrategy().ExecuteAsync</c>, que repete o bloco inteiro.</para>
/// <para>ATENÇÃO: numa repetição, o que o bloco anterior deixou no rastreador do EF é descartado, para um <c>Add</c> não entrar duas vezes. O bloco deve buscar de novo o que precisar.</para>
/// </remarks>
public static class TransacaoNaBase
{
    /// <summary>Roda <paramref name="trabalho"/> numa transação: ou tudo grava, ou nada.</summary>
    public static Task EmTransacaoAsync(this PoligraphDb db, Func<CancellationToken, Task> trabalho, CancellationToken ct)
    {
        var tentativa = 0;
        return db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            tentativa++;
            if (tentativa > 1)
            {
                db.ChangeTracker.Clear();
            }

            await using var transacao = await db.Database.BeginTransactionAsync(ct);
            await trabalho(ct);
            await transacao.CommitAsync(ct);
        });
    }
}
