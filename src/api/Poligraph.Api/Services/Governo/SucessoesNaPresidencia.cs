namespace Poligraph.Api.Services;

/// <summary>
/// As trocas de presidente no meio do mandato, que o TSE não registra: ele publica a chapa eleita, e só.
/// </summary>
/// <remarks>
/// <para>DECISÃO (autor, 2026-10-23): uma exceção escrita para o impeachment de 2016. Sem ela, os anos de 2015 a 2018 diziam
/// que Dilma Rousseff governou até 2018, e por isso o orçamento desses anos ficava fora da base. É a única entrada da base que
/// não sai de fonte periódica (regra 6): é um fato fechado, com data e fonte oficial, e não envelhece.</para>
/// <para>ATENÇÃO: o orçamento é anual. O ano da troca (2016) entra nas duas gestões, e a tela diz isso.</para>
/// </remarks>
public static class SucessoesNaPresidencia
{
    /// <summary>A troca: a eleição da chapa, o dia em que o titular foi afastado e o vice assumiu, a posse definitiva e a fonte.</summary>
    public sealed record Sucessao(int AnoDaEleicao, DateOnly Afastamento, DateOnly Posse, TipoDeSucessao Motivo, string UrlDaFonte);

    public static readonly IReadOnlyList<Sucessao> Todas =
    [
        new(2014, new DateOnly(2016, 5, 12), new DateOnly(2016, 8, 31), TipoDeSucessao.IMPEACHMENT, FontesOficiais.ImpeachmentDe2016),
    ];

    /// <summary>A troca na chapa eleita nesse ano, ou nulo.</summary>
    public static Sucessao? DaEleicao(int anoDaEleicao) => Todas.FirstOrDefault(s => s.AnoDaEleicao == anoDaEleicao);
}

/// <summary>Por que o vice assumiu.</summary>
public enum TipoDeSucessao
{
    IMPEACHMENT,
}
