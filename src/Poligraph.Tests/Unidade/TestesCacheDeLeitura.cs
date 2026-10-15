using Microsoft.Extensions.Caching.Memory;
using Poligraph.Api.Services;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// O cache de leitura: calcula uma vez por hora, e não guarda o "não achei".
/// </summary>
public class TestesCacheDeLeitura
{
    [Fact]
    public async Task SegundaLeitura_NaoCalculaDeNovo()
    {
        var leitura = new CacheDeLeitura(new MemoryCache(new MemoryCacheOptions()));
        var calculos = 0;

        Task<string> Calcular()
        {
            calculos++;
            return Task.FromResult("grafo");
        }

        await leitura.ObterAsync("grafo", Calcular);
        await leitura.ObterAsync("grafo", Calcular);

        Assert.Equal(1, calculos);
    }

    [Fact]
    public async Task ChavesDiferentes_SaoCalculadasSeparadas()
    {
        var leitura = new CacheDeLeitura(new MemoryCache(new MemoryCacheOptions()));

        var camara = await leitura.ObterAsync(("grafo", "CAMARA"), () => Task.FromResult("camara"));
        var senado = await leitura.ObterAsync(("grafo", "SENADO"), () => Task.FromResult("senado"));

        Assert.Equal("camara", camara);
        Assert.Equal("senado", senado);
    }

    /// <summary>"Não achei" pode deixar de ser verdade na próxima carga do ETL.</summary>
    [Fact]
    public async Task Nulo_NaoEGuardado()
    {
        var leitura = new CacheDeLeitura(new MemoryCache(new MemoryCacheOptions()));
        var calculos = 0;

        Task<string?> Calcular()
        {
            calculos++;
            return Task.FromResult<string?>(null);
        }

        await leitura.ObterAsync("ficha", Calcular);
        await leitura.ObterAsync("ficha", Calcular);

        Assert.Equal(2, calculos);
    }

    /// <summary>MEDIDO (2026-10-10): toda ficha era calculada duas vezes ao mesmo tempo.</summary>
    [Fact]
    public async Task RequestsSimultaneos_CalculamUmaVezSo()
    {
        var leitura = new CacheDeLeitura(new MemoryCache(new MemoryCacheOptions()));
        var liberar = new TaskCompletionSource();
        var calculos = 0;

        async Task<string> Calcular()
        {
            Interlocked.Increment(ref calculos);
            await liberar.Task;
            return "ficha";
        }

        var primeiro = leitura.ObterAsync("ficha", Calcular);
        var segundo = leitura.ObterAsync("ficha", Calcular);
        liberar.SetResult();

        Assert.Equal(["ficha", "ficha"], await Task.WhenAll(primeiro, segundo));
        Assert.Equal(1, calculos);
    }

    /// <summary>Quem esperava recebe o erro de quem calculou, e o request seguinte tenta de novo.</summary>
    [Fact]
    public async Task Falha_ChegaAQuemEsperava_EOProximoCalculaDeNovo()
    {
        var leitura = new CacheDeLeitura(new MemoryCache(new MemoryCacheOptions()));
        var liberar = new TaskCompletionSource();

        async Task<string> Falhar()
        {
            await liberar.Task;
            throw new InvalidOperationException("banco fora");
        }

        var primeiro = leitura.ObterAsync("ficha", Falhar);
        var segundo = leitura.ObterAsync("ficha", Falhar);
        liberar.SetResult();

        await Assert.ThrowsAsync<InvalidOperationException>(() => primeiro);
        await Assert.ThrowsAsync<InvalidOperationException>(() => segundo);
        Assert.Equal("ficha", await leitura.ObterAsync("ficha", () => Task.FromResult("ficha")));
    }

    [Fact]
    public void Validade_EDeUmaHora() =>
        Assert.Equal(TimeSpan.FromHours(1), CacheDeLeitura.Validade);
}
