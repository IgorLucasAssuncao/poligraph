namespace Poligraph.Data;

/// <summary>
/// Presidente e vice eleitos, e os anos do mandato.
/// </summary>
/// <remarks>
/// <para>
/// Vem do cadastro de candidatos do TSE, e não de texto fixo: um nome escrito no código
/// continuaria na tela depois da próxima posse.
/// </para>
/// <para>
/// O mandato é contado em anos, e não em datas: a posse passou de 1º para 5 de janeiro,
/// e um dia de fim gravado arriscaria uma data errada.
/// </para>
/// </remarks>
public class GestaoModel
{
    public short Eleicao { get; set; }

    public short PrimeiroAno { get; set; }

    public short UltimoAno { get; set; }

    public required string PresidenteNome { get; set; }

    public required string PresidenteNomeDeUrna { get; set; }

    public required string PresidentePartido { get; set; }

    public required string ViceNome { get; set; }

    public required string ViceNomeDeUrna { get; set; }

    public required string VicePartido { get; set; }

    public string? Coligacao { get; set; }

    /// <summary>O arquivo de candidatos do TSE que gravou a linha.</summary>
    public long? CargaId { get; set; }
}
