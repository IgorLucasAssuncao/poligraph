namespace Poligraph.Api.Dtos;

/// <summary>
/// O que entrou no ano, separado entre arrecadação e dívida.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Arrecadado"/> são as receitas correntes: impostos, contribuições, receita
/// patrimonial, serviços. <see cref="EmissaoDeDivida"/> é a operação de crédito, dinheiro
/// emprestado. Em 2025 as duas quase se igualam, e somá-las faria a arrecadação parecer o
/// dobro. As intra-orçamentárias, em que o governo paga a si mesmo, não entram em nenhuma.
/// </para>
/// </remarks>
public record ArrecadacaoDto(
    decimal Arrecadado,
    IReadOnlyList<OrigemDaReceitaDto> PorOrigem,
    decimal EmissaoDeDivida,
    decimal OutrasReceitasDeCapital);

public record OrigemDaReceitaDto(string Origem, decimal Prevista, decimal Realizada);
