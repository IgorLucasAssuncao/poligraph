using System.Text.RegularExpressions;

namespace Poligraph.Api.Services;

/// <summary>
/// Tira CPF de um nome antes de ele sair da API.
/// </summary>
/// <remarks>
/// <para>
/// O nome empresarial de MEI é o nome do dono seguido do CPF dele, e é assim que a Câmara
/// publica o fornecedor da cota: "FULANO DE TAL 12345678900". Medido em 2026-09-25: 3.310
/// lançamentos, R$ 9,70 mi, e a ficha os mostrava.
/// </para>
/// <para>
/// É a segunda barreira: o ETL já limpa na carga (<c>normalizacao.sem_cpf</c>). Esta cobre
/// o que foi gravado antes da correção e o que uma fonte nova trouxer sem aviso.
/// </para>
/// <para>Casa exatamente 11 dígitos, com ou sem pontuação, fora de uma sequência maior: os 14 dígitos de um CNPJ ⛔ são cortados.</para>
/// </remarks>
public static partial class TextoSemCpf
{
    public static string Limpar(string texto) =>
        Espacos().Replace(Cpf().Replace(texto, " "), " ").Trim(' ', '-', '/');

    public static string? LimparOuNulo(string? texto) => texto is null ? null : Limpar(texto);

    [GeneratedRegex(@"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)")]
    private static partial Regex Cpf();

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex Espacos();
}
