namespace Poligraph.Api.Data;

/// <summary>
/// Conta do cidadão. Guarda o perfil completo do Google em claro — decisão de 2026-08-25,
/// que revogou a minimização. ⛔ Nenhum token é armazenado: nem id_token, nem
/// refresh_token, nem sessão. A sessão é um cookie assinado.
/// </summary>
public class UsuarioModel
{
    public long Id { get; set; }

    /// <summary>O `sub` do Google, em claro. É a chave — ⛔ nunca o e-mail, que muda.</summary>
    public required string GoogleSub { get; set; }

    public required string Email { get; set; }
    public bool EmailVerificado { get; set; }

    public string? Nome { get; set; }
    public string? PrimeiroNome { get; set; }
    public string? Sobrenome { get; set; }

    /// <summary>⚠️ A URL do Google expira. Tratar 404 no front com avatar padrão.</summary>
    public string? FotoUrl { get; set; }

    public string? Locale { get; set; }

    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset VistoEm { get; set; }

    /// <summary>⭐ +1 invalida todos os cookies desta pessoa — "sair de todos os aparelhos".</summary>
    public short SessaoVersao { get; set; }

    public List<SegueModel> Segue { get; set; } = [];
    public List<ConsentimentoModel> Consentimentos { get; set; } = [];
}

/// <summary>
/// 🔴 Esta tabela é registro de CONVICÇÃO POLÍTICA — LGPD art. 5º, II.
/// Toda mudança aqui exige consentimento específico (RNF-12b).
/// </summary>
public class SegueModel
{
    public long UsuarioId { get; set; }
    public UsuarioModel? Usuario { get; set; }

    public long PessoaId { get; set; }
    public PessoaModel? Pessoa { get; set; }

    public DateTimeOffset CriadoEm { get; set; }
}

/// <summary>
/// 🔴 LGPD art. 8º §2: o ônus da prova do consentimento é do controlador.
/// `Versao` é o que faz a tabela valer alguma coisa — sem ela não dá para responder
/// "consentiu com o quê, exatamente" depois de reescrever o texto.
/// </summary>
public class ConsentimentoModel
{
    public long Id { get; set; }

    public long UsuarioId { get; set; }
    public UsuarioModel? Usuario { get; set; }

    public FinalidadeDeConsentimento Finalidade { get; set; }

    /// <summary>Hash ou versão do TEXTO que a pessoa aceitou.</summary>
    public required string Versao { get; set; }

    public DateTimeOffset AceitoEm { get; set; }
    public DateTimeOffset? RevogadoEm { get; set; }
}

/// <summary>
/// Token de descadastro de e-mail. ⚠️ NÃO expira, de propósito: link morto num e-mail
/// antigo transforma "quero sair" em "vou marcar como spam" — e a reputação do domínio cai.
/// </summary>
public class TokenEmailModel
{
    /// <summary>32 bytes aleatórios, base64url.</summary>
    public required string Token { get; set; }

    public long UsuarioId { get; set; }
    public UsuarioModel? Usuario { get; set; }

    public PropositoDeToken Proposito { get; set; }

    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset? UsadoEm { get; set; }
}
