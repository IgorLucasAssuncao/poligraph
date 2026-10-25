namespace Poligraph.Api.Dtos;

/// <summary>
/// Os contratos que o Executivo federal publicou no período: quanto, de que modo e com quem.
/// </summary>
/// <remarks>
/// <para>A medida é o valor final de cada contrato, salvo quando ele e o inicial divergem mais de 100 vezes: um dos dois é erro de digitação na fonte, e entra o menor. <see cref="Divergentes"/> e <see cref="ValorDescartado"/> dizem quantos e quanto ficou de fora.</para>
/// <para><see cref="SemModalidade"/> é a parte publicada com modalidade <c>Sem Informação</c>: a maior parte dos contratos, e a tela diz isso.</para>
/// <para>Republicação de contrato entra de novo, como o Portal publica.</para>
/// </remarks>
public record ComprasDoGovernoDto(
    PeriodoDto Periodo,
    IReadOnlyList<int> AnosDisponiveis,
    IReadOnlyList<GestaoDto> GestoesDisponiveis,
    int Contratos,
    decimal Valor,
    int Sigilosos,
    decimal ValorSigiloso,
    decimal SemModalidade,
    int Divergentes,
    decimal ValorDescartado,
    IReadOnlyList<ComprasNoAnoDto> PorAno,
    IReadOnlyList<ComprasPorModalidadeDto> PorModalidade,
    IReadOnlyList<ComprasDoOrgaoDto> PorOrgao,
    IReadOnlyList<ContratadoDto> Contratados);

/// <summary>Um ano de contratos.</summary>
public record ComprasNoAnoDto(int AnoDaPublicacao, int Contratos, decimal Valor);

/// <summary>Uma modalidade de compra no período.</summary>
public record ComprasPorModalidadeDto(string Modalidade, int Contratos, decimal Valor);

/// <summary>Um órgão superior no período.</summary>
public record ComprasDoOrgaoDto(string Orgao, int Contratos, decimal Valor, int Sigilosos);

/// <summary>Uma empresa contratada no período, pelo CNPJ.</summary>
public record ContratadoDto(string Cnpj, string Nome, int Contratos, decimal Valor);
