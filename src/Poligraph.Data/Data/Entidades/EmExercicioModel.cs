namespace Poligraph.Data;

/// <summary>
/// Quem está em exercício hoje, pela lista oficial de cada casa: a Câmara (<c>/api/v2/deputados</c>)
/// e o Senado (<c>/senador/lista/atual</c>). Um retrato: a ETL troca a casa inteira a cada carga.
/// </summary>
/// <remarks>
/// <para>DECISÃO do autor (2026-10-18): é a lista oficial, e não "votou na legislatura corrente", que decide quem pode ser seguido e quem sai da lista de seguidos. Pelo voto, um reeleito que ainda não votou na legislatura nova pareceria fora do mandato nos primeiros dias.</para>
/// <para>MEDIDO em 2026-10-19: 513 deputados, todos da 57ª, e 81 senadores em exercício; licenciados, 9 na Câmara e 4 no Senado.</para>
/// </remarks>
public class EmExercicioModel
{
    public long PessoaId { get; set; }

    public TipoCasa Casa { get; set; }

    /// <summary>A legislatura que a casa informa na lista. O Senado não informa uma só (o mandato cobre duas), e fica nula.</summary>
    public short? Legislatura { get; set; }

    /// <summary>
    /// Licenciado: o titular saiu por licença ou para ser ministro ou secretário, e o suplente ocupa a
    /// cadeira. Continua seguível (decisão do autor, 2026-10-19): o mandato é dele, e ele volta.
    /// </summary>
    public bool Licenciado { get; set; }

    public long CargaId { get; set; }
}
