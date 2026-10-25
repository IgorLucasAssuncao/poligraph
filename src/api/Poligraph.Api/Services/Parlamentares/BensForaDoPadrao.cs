namespace Poligraph.Api.Services;

/// <summary>
/// As declarações de bens com valor fora do padrão: provável erro de digitação na fonte, que a ficha mostra em vermelho e com aviso.
/// </summary>
/// <remarks>
/// <para>
/// DECISÃO (autor, 2026-10-23): o número não some nem é corrigido, porque o site não confere o que o candidato declarou. Ele
/// aparece como veio, com o aviso ao lado (regra 5).
/// </para>
/// <para>
/// MEDIDO (2026-10-23, 2006 a 2026): 11 declarações passam a regra, de 11 pessoas. O formato é o de vírgula esquecida: o
/// valor salta mais de 100 vezes em relação às declarações vizinhas da mesma pessoa. Exemplos: R$ 400 mi depois de uma
/// declaração de R$ 315 mil, e R$ 1,35 bi em "outros bens" de quem só declarou uma vez.
/// </para>
/// </remarks>
public static class BensForaDoPadrao
{
    /// <summary>Abaixo disto o salto pode ser herança ou venda de empresa, e não marca.</summary>
    public const decimal MinimoParaMarcar = 10_000_000m;

    /// <summary>Acima disto marca mesmo sem outra declaração para comparar.</summary>
    public const decimal TetoSemComparacao = 1_000_000_000m;

    /// <summary>Quantas vezes a declaração vale a vizinha para ser salto.</summary>
    public const decimal Salto = 100m;

    /// <summary>
    /// Os anos de eleição cuja declaração está fora do padrão, de uma pessoa só.
    /// </summary>
    /// <remarks>
    /// A vizinha é a declaração anterior e a seguinte, as que existirem. Duas declarações altas seguidas não marcam: um
    /// patrimônio grande que se repete é patrimônio, e não erro.
    /// </remarks>
    public static IReadOnlySet<int> CalcularAnos(IEnumerable<(int AnoEleicao, decimal Total)> declaracoes)
    {
        var ordenadas = declaracoes.OrderBy(d => d.AnoEleicao).ToList();
        var anos = new HashSet<int>();

        for (var i = 0; i < ordenadas.Count; i++)
        {
            var total = ordenadas[i].Total;
            if (total < MinimoParaMarcar)
            {
                continue;
            }

            List<decimal> vizinhas = [];
            if (i > 0)
            {
                vizinhas.Add(ordenadas[i - 1].Total);
            }
            if (i < ordenadas.Count - 1)
            {
                vizinhas.Add(ordenadas[i + 1].Total);
            }

            var foraDoPadrao = vizinhas.Count == 0
                ? total >= TetoSemComparacao
                : total >= TetoSemComparacao || vizinhas.All(v => total >= Salto * v);
            if (foraDoPadrao)
            {
                anos.Add(ordenadas[i].AnoEleicao);
            }
        }

        return anos;
    }
}
