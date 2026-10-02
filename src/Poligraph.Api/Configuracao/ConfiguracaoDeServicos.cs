using Poligraph.Api.Services;

namespace Poligraph.Api.Configuracao;

/// <summary> Sem interface enquanto houver uma implementação só — ver skill `arquitetura` §4.2.</summary>
public static class ConfiguracaoDeServicos
{
    /// <remarks>
    /// <para>Compressão das respostas: o grafo da Câmara tem 581 KB de JSON e cai para 155 KB com o Brotli no nível padrão, o mais rápido (medido em 2026-10-01). No nível ótimo, ver o relatório de desempenho. Sem o Cloudflare na frente, como no desenvolvimento, era o maior peso da página inicial.</para>
    /// <para>Enum vai para o JSON como TEXTO. O padrão de System.Text.Json é o ordinal: sem esta linha `"casa": "CAMARA"` viraria `"casa": 0`, o front compararia com a string e nenhuma comparação daria certo — sem erro em lugar nenhum.</para>
    /// </remarks>
    public static IServiceCollection AdicionarServicos(this IServiceCollection servicos)
    {
        servicos.ConfigureHttpJsonOptions(opcoes =>
            opcoes.SerializerOptions.Converters.Add(
                new System.Text.Json.Serialization.JsonStringEnumConverter()));

        servicos.AddMemoryCache();
        servicos.AddSingleton<CacheDeLeitura>();
        servicos.AddHostedService<AquecedorDeCache>();

        servicos.AddResponseCompression(opcoes =>
        {
            opcoes.EnableForHttps = true;
            opcoes.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
            opcoes.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
        });
        servicos.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(
            opcoes => opcoes.Level = System.IO.Compression.CompressionLevel.Optimal);
        servicos.Configure<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProviderOptions>(
            opcoes => opcoes.Level = System.IO.Compression.CompressionLevel.Optimal);
        servicos.AddScoped<IValidadorGoogle, ValidadorGoogle>();
        servicos.AddScoped<ServicoContas>();
        servicos.AddScoped<ServicoParlamentares>();
        servicos.AddScoped<ServicoGastosDeCota>();
        servicos.AddScoped<ServicoEmendas>();
        servicos.AddScoped<ServicoFinanciamento>();
        servicos.AddScoped<ServicoAfinidade>();
        servicos.AddScoped<ServicoQuestionario>();
        servicos.AddScoped<ServicoGrafo>();
        servicos.AddScoped<ServicoPanorama>();
        servicos.AddScoped<ServicoGoverno>();
        servicos.AddScoped<ServicoMetodologia>();
        servicos.AddScoped<ServicoAutoresDeEmenda>();
        servicos.AddScoped<ServicoMapaDeEmendas>();
        servicos.AddScoped<ServicoEntidades>();
        servicos.AddScoped<ServicoBusca>();

        return servicos;
    }
}
