using Scalar.AspNetCore;
using Poligraph.Api.Textos;

namespace Poligraph.Api.Configuracao;

public static class ConfiguracaoDaDocumentacao
{
    /// <summary>
    /// Publica o documento OpenAPI e o <c>/scalar</c>, e apenas em desenvolvimento:
    /// em produção a página exporia a superfície inteira da API, incluindo as rotas
    /// de conta e de exclusão (LGPD art. 18).
    /// </summary>
    /// <remarks>
    /// É o mesmo documento que <c>TestesContratoOpenApi</c> confere contra o front.
    /// </remarks>
    public static WebApplication MapearDocumentacao(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            return app;
        }

        app.MapOpenApi();
        app.MapScalarApiReference(opcoes => opcoes
            .WithTitle(MensagensDaApi.TituloDaDocumentacao)
            .WithTheme(ScalarTheme.BluePlanet));

        return app;
    }
}
