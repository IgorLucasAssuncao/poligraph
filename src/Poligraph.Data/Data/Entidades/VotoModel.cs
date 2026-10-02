namespace Poligraph.Data;

/// <summary>
/// O voto de uma pessoa numa votação.
/// `PartidoNoVoto` e `UfNoVoto` são desnormalizados DE PROPÓSITO: são registro histórico.
/// </summary>
public class VotoModel
{
    public required string VotacaoId { get; set; }
    public VotacaoModel? Votacao { get; set; }

    public long PessoaId { get; set; }
    public PessoaModel? Pessoa { get; set; }

    /// <summary>+1 sim · -1 não · 0 abstenção · NULL fora do cálculo — RN-03.</summary>
    public short? Valor { get; set; }

    public required string PartidoNoVoto { get; set; }
    public required string UfNoVoto { get; set; }

    /// <summary>A carga de onde a linha saiu (PL72). Nula nas linhas gravadas antes dela.</summary>
    public long? CargaId { get; set; }

    /// <summary>
    /// Se o parlamentar estava na votação — não o mesmo que ter posição: votar secreto e
    /// obstruir são presença sem posição.
    /// </summary>
    /// <remarks>
    /// <para>
    /// As casas registram a ausência de jeitos diferentes. O Senado lista todo senador em
    /// exercício, com a sigla da ausência ("NCom", "LS", "MIS"); a Câmara lista só quem votou,
    /// e o ausente não tem linha. Por isso a Câmara só tem <see cref="PresencaNoVoto.PRESENTE"/>,
    /// e a ausência dela se conta pela falta da linha.
    /// </para>
    /// <para>Nulo quando a sigla não diz nada sobre presença ("NA", não aplicável).</para>
    /// </remarks>
    public PresencaNoVoto? Presenca { get; set; }
}

public enum PresencaNoVoto
{
    PRESENTE,

    /// <summary>Licença, missão oficial ou ausência justificada — só o Senado publica.</summary>
    AUSENTE_JUSTIFICADO,

    /// <summary>Não compareceu, sem justificativa registrada.</summary>
    AUSENTE,
}
