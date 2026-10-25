namespace Poligraph.Api.Dtos;

/// <summary>
/// O dinheiro de emenda recebido em cada UF num período, pela sede de quem recebeu.
/// </summary>
/// <remarks>
/// <para>
/// A UF sai da cadeia CNPJ → código TOM → código IBGE, toda por chave forte. O que não /// entra no mapa fica declarado ao lado: o que passou pelo Banco do Brasil, que repassa, e
/// o pago a pessoa ou sem identificação, que não tem sede. Somem do mapa, não da conta.
/// </para>
/// </remarks>
public record MapaDoBrasilDto(
    PeriodoDto Periodo,
    IReadOnlyList<int> AnosDisponiveis,
    decimal Recebido,
    decimal NoMapa,
    decimal ViaIntermediario,
    decimal SemSede,
    IReadOnlyList<RecebidoNaUfDto> PorUf,
    int? AnoDaPopulacao = null,
    IReadOnlyList<RecebidoNoAnoDaEmendaDto>? PorAno = null);

/// <summary>O recebido pelas emendas de um ano, em todos os anos carregados, independente do período.</summary>
/// <remarks>
/// <para>Por ano da emenda, como o resto da página: o pagamento de 2024 de uma emenda de 2020 conta em 2020.</para>
/// </remarks>
public record RecebidoNoAnoDaEmendaDto(int AnoDaEmenda, decimal Recebido);

/// <summary>
/// Os anos das emendas consideradas, inclusive nas duas pontas. O ano é o da emenda, e não /// o do pagamento.
/// </summary>
/// <remarks>
/// <para>Sem dado carregado, <c>(0, 0)</c>.</para>
/// </remarks>
public record PeriodoDto(int PrimeiroAno, int UltimoAno);

/// <summary>Uma UF: o código IBGE dela, que liga à malha do mapa, e quanto recebeu.</summary>
/// <remarks>
/// <para><c>Populacao</c> é a soma da estimativa do IBGE nos municípios da UF, o divisor do mapa por habitante. Nula sem a carga <c>populacao</c>.</para>
/// </remarks>
public record RecebidoNaUfDto(string Uf, string CodigoUf, decimal Recebido, int Municipios, long? Populacao = null);

/// <summary>
/// As cidades de uma UF, TODAS, com o código IBGE que liga à malha. A que nada recebeu vem com zero.
/// </summary>
public record MapaDoEstadoDto(
    string Uf, PeriodoDto Periodo, decimal Recebido, IReadOnlyList<RecebidoNoMunicipioDto> PorMunicipio);

public record RecebidoNoMunicipioDto(string CodigoIbge, string Nome, decimal Recebido, int? Populacao = null);

/// <summary>Um município para a busca "sua cidade". A escolha vira o código IBGE, chave forte.</summary>
public record MunicipioDto(string CodigoIbge, string Nome, string Uf);
