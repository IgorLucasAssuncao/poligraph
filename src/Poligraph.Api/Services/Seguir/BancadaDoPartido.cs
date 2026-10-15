using System.Text;

namespace Poligraph.Api.Services;

/// <summary>
/// Qual bancada orientou o partido numa votação: a regra da disciplina (achado #36), a mesma
/// de <c>orientacoes.bancada_do_partido</c> na ETL.
/// </summary>
/// <remarks>
/// <para>A própria sigla vence, sem diferença de caixa ou acento; nome cortado pela fonte casa com a sigla que ele começa, a partir de 6 letras. A federação conta como o partido (Lei 14.208/2021). Bloco não conta.</para>
/// <para>RISCO: são duas implementações da mesma regra. Os casos de <c>src/etl/tests/casos/bancada_do_partido.json</c> rodam nas duas suítes de teste, e uma divergência quebra as duas.</para>
/// </remarks>
public static class BancadaDoPartido
{
    private const int MinimoParaNomeCortado = 6;

    /// <summary>A bancada que representa o partido entre as publicadas, ou nulo.</summary>
    public static string? Achar(string? partido, IEnumerable<string> bancadas)
    {
        var partidoNormalizado = Normal(partido);
        if (partidoNormalizado.Length == 0)
        {
            return null;
        }

        string? daFederacao = null;
        foreach (var bancada in bancadas)
        {
            var nome = Normal(bancada);
            if (MesmaSigla(nome, partidoNormalizado))
            {
                return bancada;
            }

            if (nome.StartsWith("FDR ", StringComparison.Ordinal)
                && nome[4..].Split('-').Any(membro => MesmaSigla(membro, partidoNormalizado)))
            {
                daFederacao = bancada;
            }
        }

        return daFederacao;
    }

    /// <summary>Caixa alta, sem acento, sem as reticências do nome cortado, espaço colapsado.</summary>
    private static string Normal(string? texto)
    {
        var decomposto = (texto ?? "").Normalize(NormalizationForm.FormKD);
        var semAcento = new StringBuilder(decomposto.Length);
        foreach (var c in decomposto)
        {
            if (c < 128)
            {
                semAcento.Append(c);
            }
        }

        var partes = semAcento.ToString().ToUpperInvariant().Replace("...", "")
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', partes);
    }

    private static bool MesmaSigla(string publicada, string partido) =>
        publicada == partido
        || (publicada.Length >= MinimoParaNomeCortado && partido.StartsWith(publicada, StringComparison.Ordinal));
}
