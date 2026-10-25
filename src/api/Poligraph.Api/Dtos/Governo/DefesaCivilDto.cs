namespace Poligraph.Api.Dtos;

/// <summary>
/// O gasto com o Cartão de Pagamento da Defesa Civil no período: dinheiro federal que estados e
/// municípios atingidos por desastre gastam com o cartão.
/// </summary>
/// <remarks>
/// <para>Não se soma ao cartão corporativo de <see cref="SigiloDto"/>: lá quem compra é o órgão federal; aqui, o ente local.</para>
/// <para><see cref="NaoInformado"/> é o gasto que o Portal publica sem executor nem UF: está em <see cref="Total"/> e fora de <see cref="PorUf"/>.</para>
/// <para><see cref="MesesSemArquivo"/> são os meses, dentro dos anos com dado, para os quais o Portal não publicou extrato (<c>"2023-01"</c>). O total do ano deles é menor do que o gasto foi.</para>
/// </remarks>
public record DefesaCivilDto(
    decimal Total,
    decimal Estadual,
    decimal NaoInformado,
    int Transacoes,
    int Executores,
    IReadOnlyList<DefesaCivilNoAnoDto> PorAno,
    IReadOnlyList<DefesaCivilNaUfDto> PorUf,
    IReadOnlyList<string> MesesSemArquivo);

/// <summary>O gasto de um ano, com quantos meses de extrato entraram.</summary>
public record DefesaCivilNoAnoDto(int AnoDoExtrato, decimal Valor, int Meses);

/// <summary>O gasto feito em uma UF no período, pelo governo do estado e pelos municípios.</summary>
public record DefesaCivilNaUfDto(string Uf, decimal Valor, int Executores);
