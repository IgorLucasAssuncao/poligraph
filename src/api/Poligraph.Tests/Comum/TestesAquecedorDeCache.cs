using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Poligraph.Api.Services;

namespace Poligraph.Tests;

/// <summary>
/// O aquecimento do cache na partida: calcula as páginas mais pedidas uma vez, contra o banco, e
/// registra quanto levou. Desligado por configuração, não faz nada.
/// </summary>
public class TestesAquecedorDeCache(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task Ligado_AqueceUmaVez_EDizQuantoLevou()
    {
        ExigeDocker();
        await DadosDeTeste.SemearAsync(Db);
        var registro = new RegistroDeLog();

        await RodarAsync(aquecer: true, registro);

        var entrada = Assert.Single(registro.Entradas);
        Assert.Equal(LogLevel.Information, entrada.Nivel);
        Assert.StartsWith("Cache aquecido em", entrada.Texto);
    }

    [SkippableFact]
    public async Task Desligado_NaoCalculaNada()
    {
        ExigeDocker();
        var registro = new RegistroDeLog();

        await RodarAsync(aquecer: false, registro);

        Assert.Empty(registro.Entradas);
    }

    private async Task RodarAsync(bool aquecer, RegistroDeLog registro)
    {
        await using var fabrica = new FabricaApi(ConnectionString);
        var configuracao = new ConfigurationBuilder()
            .AddInMemoryCollection([new("Cache:Aquecer", aquecer ? "true" : "false")])
            .Build();
        using var aquecedor = new AquecedorDeCache(fabrica.Services.GetRequiredService<IServiceScopeFactory>(), configuracao, registro);

        await aquecedor.StartAsync(CancellationToken.None);
        for (var espera = 0; espera < 100 && registro.Entradas.Count == 0 && aquecer; espera++)
        {
            await Task.Delay(100);
        }

        await aquecedor.StopAsync(CancellationToken.None);
    }

    /// <summary>Um logger que guarda as entradas para o teste ler.</summary>
    private sealed class RegistroDeLog : ILogger<AquecedorDeCache>
    {
        public List<(LogLevel Nivel, string Texto)> Entradas { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entradas.Add((logLevel, formatter(state, exception)));
    }
}
