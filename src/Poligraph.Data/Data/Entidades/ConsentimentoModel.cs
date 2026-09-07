namespace Poligraph.Data;

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

    public TipoFinalidadeDeConsentimento Finalidade { get; set; }

    /// <summary>Hash ou versão do TEXTO que a pessoa aceitou.</summary>
    public required string Versao { get; set; }

    public DateTimeOffset AceitoEm { get; set; }
    public DateTimeOffset? RevogadoEm { get; set; }
}
