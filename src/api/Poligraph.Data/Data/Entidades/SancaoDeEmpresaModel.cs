namespace Poligraph.Data;

/// <summary>
/// Uma sanção a empresa, do Cadastro de Empresas Inidôneas e Suspensas (CEIS) ou do Cadastro Nacional
/// de Empresas Punidas (CNEP): quem puniu, por quê e por quanto tempo.
/// </summary>
/// <remarks>
/// <para>Fonte: <c>download-de-dados/ceis/AAAAMMDD</c> e <c>cnep/AAAAMMDD</c>, retrato do dia. A carga troca a tabela inteira.</para>
/// <para>RISCO: os dois cadastros trazem também pessoa física, com CPF sem máscara (MEDIDO 2026-10-09: 9.101 linhas no CEIS, 40 no CNEP). Só entra CNPJ; o CPF não chega ao banco.</para>
/// <para>Liga à página da entidade pelo CNPJ: a empresa que recebeu emenda, foi paga pela cota ou contratou com o governo.</para>
/// </remarks>
public class SancaoDeEmpresaModel
{
    /// <summary><c>CEIS</c> ou <c>CNEP</c>.</summary>
    public required string Cadastro { get; set; }

    /// <summary>O código da sanção no cadastro.</summary>
    public required string CodigoDaSancao { get; set; }

    public required string Cnpj { get; set; }

    public required string Nome { get; set; }

    /// <summary>Como o Portal publica: <c>Inidoneidade</c>, <c>Multa</c>, <c>Impedimento/proibição de contratar...</c></summary>
    public required string Categoria { get; set; }

    public DateOnly? Inicio { get; set; }

    /// <summary>Nula quando a sanção não tem prazo (multa, inidoneidade sem data).</summary>
    public DateOnly? Fim { get; set; }

    public required string OrgaoSancionador { get; set; }

    /// <summary><c>FEDERAL</c>, <c>ESTADUAL</c> ou <c>MUNICIPAL</c>, como o Portal publica.</summary>
    public string? Esfera { get; set; }

    public string? FundamentacaoLegal { get; set; }

    /// <summary>Só no CNEP, quando a sanção é multa.</summary>
    public decimal? ValorDaMulta { get; set; }

    public long? CargaId { get; set; }
}
