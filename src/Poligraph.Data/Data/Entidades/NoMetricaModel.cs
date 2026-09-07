namespace Poligraph.Data;

public class NoMetricaModel
{
    public long ExecucaoId { get; set; }
    public long PessoaId { get; set; }

    public short? Comunidade { get; set; }

    /// <summary>Posição no DESENHO — layout de molas. ⛔ Sem interpretação.</summary>
    public float? EixoX { get; set; }
    public float? EixoY { get; set; }

    /// <summary>
    /// 1ª componente principal (SVD) — ⭐ o eixo que SIGNIFICA alguma coisa.
    ///
    /// ⚠️ Convive com `EixoX` de propósito (PL43): molas desenham bem, componentes
    /// interpretam. Qual das duas a tela usa é decisão em aberto.
    /// </summary>
    public float? Componente1 { get; set; }

    /// <summary>2ª componente principal.</summary>
    public float? Componente2 { get; set; }

    /// <summary>⚠️ NULL no Senado — não existe orientação de bancada.</summary>
    public float? Governismo { get; set; }

    /// <summary>⚠️ NULL no Senado — idem.</summary>
    public float? Disciplina { get; set; }

    public int NVotacoes { get; set; }
}
