namespace Poligraph.Api.Configuracao;

/// <summary>Avisos de configuração emitidos uma vez, na subida.</summary>
public static partial class DiagnosticoDeSubida
{
    /// <summary>
    /// Diz na subida se o login com Google está ligado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Sem isto, a única evidência seria um 401 no endpoint de login — que é exatamente
    /// o mesmo código devolvido para token inválido. Um Client ID ausente ficaria
    /// indistinguível de um token forjado, e a investigação começaria pelo lugar errado.
    /// </para>
    /// <para>
    /// Só o final do Client ID vai ao log. Ele é público, mas log não é lugar de
    /// despejar configuração inteira por hábito.
    /// </para>
    /// </remarks>
    public static WebApplication AvisarSeOLoginEstaDesligado(this WebApplication app)
    {
        var clientId = app.Configuration["Google:ClientId"];
        var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Poligraph");

        if (string.IsNullOrWhiteSpace(clientId))
        {
            Avisos.LoginDesligado(log);
            return app;
        }

        // Um Client ID do Google tem ~72 caracteres, mas um valor curto de teste faria
        // o corte estourar com ArgumentOutOfRangeException na subida.
        Avisos.LoginLigado(log, clientId.Length <= 24 ? clientId : clientId[^24..]);

        return app;
    }

    /// <summary>
    /// Delegados gerados em tempo de compilação: o argumento só é formatado se o nível
    /// estiver habilitado.
    /// </summary>
    private static partial class Avisos
    {
        [LoggerMessage(
            Level = LogLevel.Warning,
            Message = "Login com Google DESLIGADO: Google:ClientId não configurado. "
                    + "O site funciona; entrar não. Ver docs/plano/08-obter-as-chaves.md")]
        public static partial void LoginDesligado(ILogger logger);

        [LoggerMessage(
            Level = LogLevel.Information,
            Message = "Login com Google ligado (Client ID ...{Final}).")]
        public static partial void LoginLigado(ILogger logger, string final);
    }
}
