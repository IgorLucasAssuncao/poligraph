namespace Poligraph.Data;

/// <summary>
/// Um parlamentar que saiu da lista de seguidos de alguém porque deixou o mandato, guardado só até
/// a pessoa ver o aviso no site.
/// </summary>
/// <remarks>
/// <para>RISCO: diz quem a pessoa seguia, que é dado sensível (LGPD art. 5º, II). Sai quando ela fecha o aviso, com a conta (cascade), e depois de 90 dias pela limpeza do worker.</para>
/// </remarks>
public class SeguidoEncerradoModel
{
    public long UsuarioId { get; set; }

    public long PessoaId { get; set; }

    public DateTimeOffset EncerradoEm { get; set; }
}
