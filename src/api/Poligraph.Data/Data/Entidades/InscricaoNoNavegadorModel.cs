namespace Poligraph.Data;

/// <summary>
/// Um navegador que aceitou receber avisos (Pendência 89): o endereço que o serviço de push do
/// fabricante deu a ele e as duas chaves com que o aviso é cifrado.
/// </summary>
/// <remarks>
/// <para>RISCO: ligada ao usuário, diz que ele segue alguém. Sai com a conta (cascade), com a revogação do consentimento e quando o fabricante responde que o navegador não existe mais.</para>
/// </remarks>
public class InscricaoNoNavegadorModel
{
    public long Id { get; set; }

    public long UsuarioId { get; set; }

    /// <summary>O endereço do serviço de push (Google, Mozilla, Apple) para este navegador.</summary>
    public required string Endereco { get; set; }

    /// <summary>A chave pública do navegador (P-256), em base64url.</summary>
    public required string P256dh { get; set; }

    /// <summary>O segredo de autenticação do navegador, em base64url.</summary>
    public required string Auth { get; set; }

    public DateTimeOffset CriadaEm { get; set; }
}
