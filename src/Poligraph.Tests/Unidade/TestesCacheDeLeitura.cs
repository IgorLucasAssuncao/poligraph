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

    [Fact]
    public void Validade_EDeUmaHora() =>
        Assert.Equal(TimeSpan.FromHours(1), CacheDeLeitura.Validade);
}
