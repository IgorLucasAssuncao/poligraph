namespace Poligraph.Worker;

/// <summary>
/// O par de chaves VAPID e o contato que identificam o servidor diante do serviço de push do
/// fabricante do navegador (Pendência 89). Seção <c>Avisos</c> da configuração.
/// </summary>
/// <remarks>
/// <para>RISCO: a chave privada é segredo. No dev vem do parâmetro <c>avisos-chave-privada</c> do AppHost (user-secrets); em produção, da variável <c>Avisos__ChavePrivada</c> no Coolify. Nunca em <c>appsettings.json</c>.</para>
/// <para>A pública não é segredo: a API a entrega ao navegador, que precisa dela para se inscrever. As duas têm de ser do mesmo par, senão o fabricante recusa todo aviso com 403.</para>
/// </remarks>
public class OpcoesDosAvisos
{
    public const string Secao = "Avisos";

    /// <summary>A chave pública P-256, 65 bytes em base64url.</summary>
    public string ChavePublica { get; set; } = "";

    /// <summary>A chave privada P-256, 32 bytes em base64url.</summary>
    public string ChavePrivada { get; set; } = "";

    /// <summary>O contato que o fabricante usa se o servidor se comportar mal: <c>mailto:</c> ou <c>https:</c>.</summary>
    public string Assunto { get; set; } = "https://registroaberto.org";

    /// <summary>Se as duas chaves vieram.</summary>
    public bool Completas => ChavePublica.Length > 0 && ChavePrivada.Length > 0;
}
