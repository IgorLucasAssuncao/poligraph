namespace Poligraph.Data;

/// <summary>SimilaridadeModel entre dois parlamentares da MESMA casa. Escrita pelo Python.</summary>
public class SimilaridadeModel
{
    public long ExecucaoId { get; set; }
    public long PessoaA { get; set; }
    public long PessoaB { get; set; }

    public TipoMetrica Metrica { get; set; }

    public float Valor { get; set; }

    /// <summary>🔴 Mínimo de 20 — RN-02. Abaixo disso o par é descartado.</summary>
    public int NVotacoesComuns { get; set; }
}
