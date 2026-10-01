namespace Poligraph.Api.Dtos;

/// <summary>
/// O gasto do ano que o Portal publica sem dizer em quê, por sigilo.
/// </summary>
/// <remarks>
/// <para>
/// Duas origens, que ⛔ se somam: no cartão corporativo, a compra sigilosa mostra só o
/// valor — ⛔ quem comprou, de quem nem quando; na ação de caráter sigiloso, o valor
/// aparece e a finalidade ⛔. Cada uma vem com a sua base: o cartão sigiloso ao lado do
/// cartão inteiro.
/// </para>
/// <para>É só o que o Portal MARCA. Órgão de inteligência também gasta em ação de nome comum, e esse gasto ⛔ está aqui.</para>
/// <para><see cref="Meses"/> diz quantos meses entraram: no ano corrente, menos de 12.</para>
/// </remarks>
public record SigiloDto(
    decimal CartaoSigiloso,
    decimal CartaoTotal,
    int TransacoesSigilosas,
    decimal AcaoSigilosa,
    int Meses,
    IReadOnlyList<SigiloDoOrgaoDto> PorOrgao);

/// <summary>Um órgão com gasto sigiloso no ano, em cada origem.</summary>
public record SigiloDoOrgaoDto(string Orgao, decimal Cartao, decimal CartaoTotal, decimal Acao);
