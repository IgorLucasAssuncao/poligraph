namespace Poligraph.Api.Dtos;

/// <summary>
/// O que saiu no ano: as áreas de governo de um lado, a dívida e as transferências de outro.
/// </summary>
/// <remarks>
/// <para>
/// Cada valor pago soma o pago do próprio ano com os restos a pagar, a despesa de anos
/// anteriores paga neste. Em 2025 são R$ 234,6 bi, e em Urbanismo, mais que o triplo do
/// pago do exercício.
/// </para>
/// </remarks>
public record DespesaDto(
    decimal EmpenhadoAcimaDaDotacao,
    IReadOnlyList<AreaDaDespesaDto> Areas,
    IReadOnlyList<EncargoDto> Encargos);

/// <summary>
/// Uma função do orçamento (saúde, educação...).
/// </summary>
/// <remarks>
/// <para><see cref="DotacaoCompleta"/> é falso quando se empenhou além da dotação publicada: ela não é a que autorizou o gasto, e a razão entre pago e dotação não pode ser mostrada.</para>
/// </remarks>
public record AreaDaDespesaDto(
    string CodigoDaFuncao,
    string Nome,
    decimal DotacaoAtualizada,
    decimal Empenhado,
    decimal Pago,
    decimal RestosAPagarPagos,
    bool DotacaoCompleta);

/// <summary>Uma parte de Encargos especiais, somada pelas subfunções do grupo.</summary>
public record EncargoDto(TipoGrupoDeEncargo Grupo, decimal Pago, decimal RestosAPagarPagos);
