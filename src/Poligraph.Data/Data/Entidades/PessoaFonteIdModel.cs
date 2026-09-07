namespace Poligraph.Data;

/// <summary>
/// Liga a pessoa ao ID dela em cada fonte. `Metodo` e `Confianca` não são enfeite:
/// são o resultado do objetivo específico #2, reportável no TCC.
/// </summary>
public class PessoaFonteIdModel
{
    public long PessoaId { get; set; }
    public PessoaModel? Pessoa { get; set; }

    public FonteDeIdentificador Fonte { get; set; }
    public required string IdExterno { get; set; }
    public MetodoDeVinculo Metodo { get; set; }
    public float? Confianca { get; set; }
}
