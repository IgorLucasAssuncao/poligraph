namespace Poligraph.Data;

/// <summary>
/// O gasto com o Cartão de Pagamento da Defesa Civil (CPDC) num mês, por quem executou: o
/// município ou o governo do estado atingido por desastre.
/// </summary>
/// <remarks>
/// <para>O dinheiro é federal, repassado pela Secretaria Nacional de Proteção e Defesa Civil; quem compra com o cartão é o ente local. Não é o cartão corporativo dos órgãos federais (<see cref="GastoSigilosoModel"/>), e as telas não somam os dois.</para>
/// <para>MEDIDO (2026-10-09): R$ 1.444,7 mi de 2023 a ago/2026, em 17.934 transações, contra R$ 397,2 mi do cartão corporativo no mesmo período. O Portal não publicou os extratos de jan/2023 e nov/2025.</para>
/// <para>Uma linha soma as transações do mês do extrato. Estorno entra negativo e fica na soma.</para>
/// <para>MEDIDO (2026-10-09): em 2019 o Portal publica transações com executor <c>Sem informação / -1</c>, em convênio do próprio Ministério. Elas entram com esfera <c>NAO_INFORMADA</c> e sem UF: ficam no total e fora da soma por estado.</para>
/// </remarks>
public class GastoDaDefesaCivilModel
{
    public long Id { get; set; }

    /// <summary>Ano do extrato do cartão.</summary>
    public short Ano { get; set; }

    /// <summary>Mês do extrato do cartão.</summary>
    public short Mes { get; set; }

    /// <summary>O nome que o Portal dá ao executor, sem a UF: o município, <c>GOVERNO DO ESTADO</c> ou <c>Sem informação</c>.</summary>
    public required string Executor { get; set; }

    /// <summary>Nula só quando o Portal não informa o executor.</summary>
    public string? Uf { get; set; }

    /// <summary><c>MUNICIPAL</c>, <c>ESTADUAL</c> ou <c>NAO_INFORMADA</c>, pelo nome do executor.</summary>
    public required string Esfera { get; set; }

    /// <summary>CNPJ do convenente, a prefeitura ou o órgão do estado: liga ao cadastro de CNPJs sem casar nome de cidade.</summary>
    public required string CnpjConvenente { get; set; }

    public decimal Valor { get; set; }

    public int Transacoes { get; set; }

    /// <summary>O arquivo do Portal de onde veio a linha, para o modo auditoria.</summary>
    public long? CargaId { get; set; }
}
