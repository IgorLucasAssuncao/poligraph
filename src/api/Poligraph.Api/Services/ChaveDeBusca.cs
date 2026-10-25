using System.Globalization;
using System.Text;

namespace Poligraph.Api.Services;

/// <summary>
/// O texto como a busca compara: sem acento e em maiúsculas, para comparar com <see cref="StringComparison.Ordinal"/>.
/// </summary>
/// <remarks>
/// <para>MEDIDO em 2026-10-23: a busca do cabeçalho levava de 250 a 450 ms com o cache quente, porque comparava cada um dos
/// 62 mil políticos e das 50 mil entidades com <see cref="CompareInfo.IndexOf(string, string, CompareOptions)"/> da cultura
/// pt-BR, a cada letra digitada. A chave sai uma vez, na montagem do índice.</para>
/// </remarks>
public static class ChaveDeBusca
{
    public static string De(string texto) =>
        new string([.. texto.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)])
            .ToUpperInvariant();
}
