namespace Poligraph.Data;

/// <summary>
/// Conta do cidadão. Guarda o perfil completo do Google em claro — decisão de 2026-08-25,
/// que revogou a minimização. Nenhum token é armazenado: nem id_token, nem
/// refresh_token, nem sessão. A sessão é um cookie assinado.
/// </summary>
public class UsuarioModel
{
    public long Id { get; set; }

    /// <summary>O `sub` do Google, em claro. É a chave — nunca o e-mail, que muda.</summary>
    public required string GoogleSub { get; set; }

    public required string Email { get; set; }
    public bool EmailVerificado { get; set; }

    public string? Nome { get; set; }
    public string? PrimeiroNome { get; set; }
    public string? Sobrenome { get; set; }

    /// <summary> A URL do Google expira. Tratar 404 no front com avatar padrão.</summary>
    public string? FotoUrl { get; set; }

    public string? Locale { get; set; }

    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset VistoEm { get; set; }

    /// <summary> +1 invalida todos os cookies desta pessoa — "sair de todos os aparelhos".</summary>
    public short SessaoVersao { get; set; }

    public List<SegueModel> Segue { get; set; } = [];
    public List<ConsentimentoModel> Consentimentos { get; set; } = [];
}
