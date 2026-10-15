namespace Poligraph.Api.Dtos;

/// <summary>
/// O perfil do governo federal num período: quem governa, de onde veio o dinheiro e para onde foi.
/// </summary>
/// <remarks>
/// <para>
/// Sem período, todos os anos carregados: ir de ano em ano obrigava a somar de cabeça. Os
/// totais somam o período; <see cref="PorAno"/> traz os três números de cada ano, para a
/// comparação não depender de trocar o filtro.
/// </para>
/// <para>
/// <see cref="EmAndamento"/> é o ano do período cujos arquivos foram gerados dentro dele:
/// os valores dele ainda crescem, e a tela avisa. Nulo quando todos estão fechados.
/// </para>
/// <para><see cref="GestoesDisponiveis"/> são todas as gestões com dado, independentes do período: a tela oferece uma por uma como atalho, e comparar gestões medidas do mesmo jeito é o que mostra que a página não é sobre uma delas.</para>
/// <para><see cref="Sigilo"/> é nulo enquanto a carga do gasto sigiloso ainda não rodou para o período.</para>
/// <para><see cref="ComprasCentralizadas"/> é nulo enquanto a carga do CPCC não rodou para o período.</para>
/// <para><see cref="DefesaCivil"/> é nulo enquanto a carga do cartão da Defesa Civil ainda não rodou para o período.</para>
/// </remarks>
public record GovernoDto(
    IReadOnlyList<GestaoDto> Gestoes,
    PeriodoDto Periodo,
    DateOnly GeradoEm,
    int? EmAndamento,
    IReadOnlyList<int> AnosDisponiveis,
    ArrecadacaoDto Arrecadacao,
    DespesaDto Despesa,
    SigiloDto? Sigilo,
    DefesaCivilDto? DefesaCivil,
    ComprasCentralizadasDto? ComprasCentralizadas,
    IReadOnlyList<GovernoNoAnoDto> PorAno,
    IReadOnlyList<GestaoDto> GestoesDisponiveis);

/// <summary>Os três números de um ano, lado a lado com os dos outros.</summary>
/// <remarks>
/// <para><see cref="Gastou"/> é o que se pagou nas áreas, nos repasses a estados e municípios e na dívida — não a rolagem, que é dívida paga com dívida.</para>
/// </remarks>
public record GovernoNoAnoDto(int AnoDoOrcamento, decimal Arrecadou, decimal Gastou, decimal PegouEmprestado, bool Fechado);
