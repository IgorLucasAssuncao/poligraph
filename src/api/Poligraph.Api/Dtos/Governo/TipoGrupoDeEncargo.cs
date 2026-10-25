namespace Poligraph.Api.Dtos;

/// <summary>
/// As quatro partes de Encargos especiais que se leem separadas.
/// </summary>
/// <remarks>
/// <para>A tradução das subfunções está em <c>ServicoGoverno.GrupoDaSubfuncao</c>.</para>
/// </remarks>
public enum TipoGrupoDeEncargo
{
    /// <summary>A estados e municípios, por obrigação constitucional: FPM, FPE, complemento do FUNDEB.</summary>
    TRANSFERENCIAS,

    /// <summary>Juros e amortização da dívida pública.</summary>
    SERVICO_DA_DIVIDA,

    /// <summary>Dívida antiga paga com dívida nova. Entra e sai sem virar serviço.</summary>
    REFINANCIAMENTO,

    OUTROS,
}
