using Scalar.AspNetCore;

namespace Poligraph.Api.Configuracao;

public static class ConfiguracaoDaDocumentacao
{
    // ⭐ `/scalar` — a documentação navegável, com "experimente" em cada rota.
    //
    // ⚠️ Só em desenvolvimento. Em produção ela expõe a superfície inteira da API a
    // quem passar, incluindo as rotas de conta e de exclusão (LGPD art. 18).
    //
    // 🔴 Ela lê o MESMO documento que o teste de contrato confere
    // (`TestesContratoOpenApi`): se a documentação e o front discordarem, o teste
    // quebra antes de alguém abrir a página.
    public static WebApplication MapearDocumentacao(this WebApplication app)
    {
        // ⚠️ Só em desenvolvimento. Em produção ela expõe a superfície inteira da API a
        // quem passar, incluindo as rotas de conta e de exclusão (LGPD art. 18).
        if (!app.Environment.IsDevelopment()) return app;

        app.MapOpenApi();
        app.MapScalarApiReference(opcoes => opcoes
            .WithTitle("Registro Aberto — API")
            .WithTheme(ScalarTheme.BluePlanet));

        return app;
    }
}
