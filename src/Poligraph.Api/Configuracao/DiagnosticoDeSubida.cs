namespace Poligraph.Api.Configuracao;

public static class DiagnosticoDeSubida
{
/// <summary>
/// Diz na subida se o login está ligado.
/// Sem isto, a única evidência seria um 401 no endpoint de login — que é exatamente o
/// mesmo código devolvido para token inválido. Um Client ID ausente ficaria
/// indistinguível de um token forjado, e a investigação começaria pelo lugar errado.
/// </summary>
    /// <remarks>
    /// <para>Só o final: o Client ID é público, mas log não é lugar de despejar configuração inteira por hábito.</para>
    /// </remarks>
    public static WebApplication AvisarSeOLoginEstaDesligado(this WebApplication app)
    {
    var clientId = app.Configuration["Google:ClientId"];
    var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Poligraph");

    if (string.IsNullOrWhiteSpace(clientId))
    {
        log.LogWarning(
            "Login com Google DESLIGADO: Google:ClientId não configurado. "
            + "O site funciona; entrar não. Ver docs/plano/08-obter-as-chaves.md");
    }
    else
    {
        log.LogInformation(
            "Login com Google ligado (Client ID …{Final}).",
            clientId[^24..]);
    }

        return app;
    }
}
