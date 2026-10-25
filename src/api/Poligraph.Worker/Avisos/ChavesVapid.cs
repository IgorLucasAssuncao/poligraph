using System.Buffers.Text;
using System.Security.Cryptography;

namespace Poligraph.Worker;

/// <summary>
/// Gera um par de chaves VAPID (P-256) em base64url, o formato que o navegador e o fabricante esperam.
/// </summary>
/// <remarks>
/// <para>Uso: <c>dotnet run --project src/api/Poligraph.Worker -- gerar-chaves</c>. Imprime as duas linhas no terminal de quem rodou, para colar no Coolify (<c>Avisos__ChavePublica</c> e <c>Avisos__ChavePrivada</c>) ou no user-secrets do AppHost.</para>
/// <para>RISCO: trocar o par desfaz todas as inscrições: o navegador se inscreveu com a chave pública antiga, e o fabricante recusa o aviso assinado com a nova. Gere uma vez por ambiente.</para>
/// </remarks>
public static class ChavesVapid
{
    public const string Comando = "gerar-chaves";

    public static (string Publica, string Privada) Gerar()
    {
        using var chave = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parametros = chave.ExportParameters(includePrivateParameters: true);
        byte[] publica = [0x04, .. parametros.Q.X!, .. parametros.Q.Y!];
        return (Base64Url.EncodeToString(publica), Base64Url.EncodeToString(parametros.D!));
    }

    public static void Imprimir(TextWriter saida)
    {
        var (publica, privada) = Gerar();
        saida.WriteLine($"Avisos__ChavePublica={publica}");
        saida.WriteLine($"Avisos__ChavePrivada={privada}");
    }
}
