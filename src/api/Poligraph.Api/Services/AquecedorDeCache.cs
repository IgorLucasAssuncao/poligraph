using Poligraph.Data;
using Poligraph.Api.Textos;

namespace Poligraph.Api.Services;

/// <summary>
/// Calcula as respostas mais pesadas na subida da API e uma vez por <see cref="CacheDeLeitura.Validade"/>, para nenhum
/// visitante pagar a consulta a frio.
/// </summary>
/// <remarks>
/// <para>Roda logo depois de cada entrada vencer (<see cref="CacheDeLeitura.Validade"/> mais uma folga), então recalcula em vez de ler o que ainda está guardado.</para>
/// <para>Falha não derruba a API: o aquecimento é ganho de tempo, e a próxima requisição calcula o que faltar.</para>
/// <para>MEDIDO (2026-10-24, banco local, sem cache): as fitas do mapa de emendas levavam 1,5 s, a lista de entidades 2,1 s e a primeira ficha de cada legislatura até 0,95 s, pela mediana de presença da casa. As três entraram aqui.</para>
/// <para>Desligado com <c>Cache:Aquecer = false</c>. Os testes de integração desligam: eles semeiam o banco depois de subir a API, e o aquecedor guardaria a base vazia.</para>
/// </remarks>
public sealed class AquecedorDeCache(
    IServiceScopeFactory escopos, IConfiguration configuracao, ILogger<AquecedorDeCache> logger) : BackgroundService
{
    private readonly IServiceScopeFactory _escopos = escopos;
    private readonly IConfiguration _configuracao = configuracao;
    private readonly ILogger<AquecedorDeCache> _logger = logger;

    private static readonly TimeSpan Folga = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_configuracao.GetValue("Cache:Aquecer", true))
        {
            return;
        }

        while (!ct.IsCancellationRequested)
        {
            await AquecerAsync(ct);
            await Task.Delay(CacheDeLeitura.Validade + Folga, ct);
        }
    }

    private async Task AquecerAsync(CancellationToken ct)
    {
        var inicio = TimeProvider.System.GetTimestamp();

        try
        {
            await using var escopo = _escopos.CreateAsyncScope();
            var servicos = escopo.ServiceProvider;

            await servicos.GetRequiredService<ServicoPanorama>().ObterAsync(null, ct);
            await servicos.GetRequiredService<ServicoPanorama>().LegislaturasAsync(ct);
            await servicos.GetRequiredService<ServicoGrafo>().ObterAsync(TipoCasa.CAMARA, null, ct);
            await servicos.GetRequiredService<ServicoGrafo>().ObterAsync(TipoCasa.SENADO, null, ct);
            await servicos.GetRequiredService<ServicoParlamentares>().ParlamentaresDeTodasAsync(ct);
            await servicos.GetRequiredService<ServicoQuestionario>().ObterAsync(ct);
            await servicos.GetRequiredService<ServicoAfinidade>().AquecerFichasAsync(ct);
            await servicos.GetRequiredService<ServicoMetodologia>().ObterAsync(ct);
            await servicos.GetRequiredService<ServicoGoverno>().ObterAsync(default, ct);
            await servicos.GetRequiredService<ServicoMapaDeEmendas>().ObterBrasilAsync(default, ct);
            await servicos.GetRequiredService<ServicoMapaDeEmendas>().ObterCaminhosAsync(default, ct);
            await servicos.GetRequiredService<ServicoEntidades>().ListarAsync(null, null, 1, ct);
            await servicos.GetRequiredService<ServicoParlamentares>().AquecerMedianasAsync(ct);
            await servicos.GetRequiredService<ServicoBusca>().BuscarAsync("aquecer", ct);

            if (_logger.IsEnabled(LogLevel.Information))
            {
                _logger.LogInformation(MensagensDaApi.CacheAquecido, TimeProvider.System.GetElapsedTime(inicio));
            }
        }
        catch (Exception erro) when (erro is not OperationCanceledException)
        {
            _logger.LogWarning(erro, MensagensDaApi.CacheNaoAquecido);
        }
    }
}
