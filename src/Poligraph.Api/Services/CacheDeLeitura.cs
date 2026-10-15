using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace Poligraph.Api.Services;

/// <summary>
/// Cache em memória, por instância, das respostas de leitura que custam caro e mudam só
/// quando o ETL roda.
/// </summary>
/// <remarks>
/// <para>Validade de uma hora, decisão do autor: os dados mudam pouco, e a consulta mais pesada (a lista com as legislaturas anteriores) leva 32 s a frio. Uma carga do ETL aparece na tela em até uma hora; reiniciar a API mostra na hora.</para>
/// <para>Por instância, sem Redis: com uma instância só no VPS, um cache distribuído seria uma peça a mais sem ganho.</para>
/// <para>Só para o que é igual para todo visitante. Nada que dependa da sessão passa por aqui: a chave seria a mesma para duas pessoas diferentes.</para>
/// <para><c>null</c> não entra: "não achei" pode deixar de ser verdade na próxima carga, e guardá-lo esconderia o dado novo por uma hora.</para>
/// <para>DECISÃO (2026-10-10): um cálculo só por chave. Requests iguais que chegam antes de o primeiro terminar esperam o mesmo cálculo. MEDIDO no mesmo dia: toda ficha de parlamentar era calculada duas vezes ao mesmo tempo, de 3 a 5 s cada a frio.</para>
/// <para>ATENÇÃO: quem espera herda o cancelamento de quem começou. Se o primeiro request for cancelado, os outros recebem o cancelamento e o próximo request calcula de novo.</para>
/// </remarks>
public sealed class CacheDeLeitura(IMemoryCache cache)
{
    private readonly IMemoryCache _cache = cache;
    private readonly ConcurrentDictionary<object, Task<object?>> _emAndamento = new();

    /// <summary>Quanto tempo uma resposta vale. O aquecedor recalcula logo depois disso.</summary>
    public static readonly TimeSpan Validade = TimeSpan.FromHours(1);

    /// <summary>A resposta guardada, a que já está sendo calculada, ou a calculada agora e guardada por <see cref="Validade"/>.</summary>
    public async Task<T> ObterAsync<T>(object chave, Func<Task<T>> calcular)
    {
        if (_cache.TryGetValue(chave, out T? guardado) && guardado is not null)
        {
            return guardado;
        }

        var pedido = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var emAndamento = _emAndamento.GetOrAdd(chave, pedido.Task);
        if (emAndamento != pedido.Task)
        {
            return (T)(await emAndamento)!;
        }

        try
        {
            var calculado = await calcular();
            if (calculado is not null)
            {
                _cache.Set(chave, calculado, Validade);
            }

            pedido.SetResult(calculado);
            return calculado;
        }
        catch (Exception erro)
        {
            pedido.SetException(erro);
            throw;
        }
        finally
        {
            _emAndamento.TryRemove(new KeyValuePair<object, Task<object?>>(chave, pedido.Task));
        }
    }
}
