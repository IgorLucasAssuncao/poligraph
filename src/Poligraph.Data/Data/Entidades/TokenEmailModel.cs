namespace Poligraph.Data;

/// <summary>
/// Token de descadastro de e-mail. NÃO expira, de propósito: link morto num e-mail
/// antigo transforma "quero sair" em "vou marcar como spam" — e a reputação do domínio cai.
/// </summary>
public class TokenEmailModel
{
    /// <summary>32 bytes aleatórios, base64url.</summary>
    public required string Token { get; set; }

    public long UsuarioId { get; set; }
    public UsuarioModel? Usuario { get; set; }

    public TipoPropositoDeToken Proposito { get; set; }

    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset? UsadoEm { get; set; }
}
