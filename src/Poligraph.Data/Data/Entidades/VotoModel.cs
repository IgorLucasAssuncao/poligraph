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
}
