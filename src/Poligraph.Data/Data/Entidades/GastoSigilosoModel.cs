namespace Poligraph.Data;

/// <summary>
/// O gasto que o Portal da Transparência publica sem detalhe, por sigilo, num ano e órgão.
/// </summary>
/// <remarks>
/// <para>
/// Duas origens, que não se somam sem dizer: o cartão corporativo, em que a transação
/// sigilosa esconde portador, favorecido e data e mostra só o valor; e as ações
/// orçamentárias de caráter sigiloso, em que o valor aparece e a finalidade não .
/// </para>
/// <para>
/// É só o que o próprio Portal marca como sigiloso. Órgão de inteligência também gasta em
/// ação de nome comum, e esse gasto não está aqui.
/// </para>
/// </remarks>
public class GastoSigilosoModel
{
    /// <summary>No cartão, o ano do extrato — não o da compra, que o sigilo esconde.</summary>
    public short Ano { get; set; }

    public OrigemDoSigilo Origem { get; set; }

    public required string OrgaoSuperior { get; set; }

    public decimal Sigiloso { get; set; }

    /// <summary>
    /// O total da origem no órgão, para o sigiloso ter base: no cartão, tudo o que o órgão
    /// gastou nele; na ação sigilosa, igual a <see cref="Sigiloso"/>.
    /// </summary>
    public decimal Total { get; set; }

    /// <summary>Quantas transações sigilosas; nulo na ação, que não tem transação.</summary>
    public int? Lancamentos { get; set; }

    /// <summary>Quantos meses do ano entraram — no ano corrente, menos de 12.</summary>
    public short Meses { get; set; }

    /// <summary>O arquivo do Portal de onde veio a linha (Pendência 72), para o modo auditoria.</summary>
    public long? CargaId { get; set; }
}

public enum OrigemDoSigilo
{
    CARTAO_CORPORATIVO,
    ACAO_SIGILOSA,
}
