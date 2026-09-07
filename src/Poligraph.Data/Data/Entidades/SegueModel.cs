namespace Poligraph.Data;

/// <summary>
/// Esta tabela é registro de CONVICÇÃO POLÍTICA — LGPD art. 5º, II.
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
