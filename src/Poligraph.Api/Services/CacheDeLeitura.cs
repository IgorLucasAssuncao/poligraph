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
/// </remarks>
public sealed class CacheDeLeitura(IMemoryCache cache)
{
    private readonly IMemoryCache _cache = cache;

    /// <summary>Quanto tempo uma resposta vale. O aquecedor recalcula logo depois disso.</summary>
    public static readonly TimeSpan Validade = TimeSpan.FromHours(1);

    /// <summary>A resposta guardada, ou a calculada agora e guardada por <see cref="Validade"/>.</summary>
    public async Task<T> ObterAsync<T>(object chave, Func<Task<T>> calcular)
    {
        if (_cache.TryGetValue(chave, out T? guardado) && guardado is not null)
        {
            return guardado;
        }

        var calculado = await calcular();
        if (calculado is not null)
        {
            _cache.Set(chave, calculado, Validade);
        }

        return calculado;
    }
}
