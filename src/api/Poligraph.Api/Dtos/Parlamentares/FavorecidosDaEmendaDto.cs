namespace Poligraph.Api.Dtos;

/// <summary>
/// Quem recebeu o dinheiro das emendas do ano, somado desde o primeiro pagamento.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Recebido"/> inclui resto a pagar quitado nos anos seguintes, e por isso
/// pode passar do pago no próprio ano. <see cref="UltimoMes"/> diz até quando vai a soma.
/// </para>
/// <para>
/// O que passou por intermediário, o que foi a pessoas e o que veio sem identificação
/// ficam fora de <see cref="Maiores"/>, com o valor declarado ao lado: somem da lista,
/// não da conta.
/// </para>
/// <para>
/// <see cref="Identificados"/> é quantos favorecidos a lista teria inteira: a ficha mostra
/// os primeiros, e o resto vem em páginas.
/// </para>
/// </remarks>
public record FavorecidosDaEmendaDto(
    decimal Recebido,
    decimal ViaIntermediario,
    decimal APessoas,
    decimal SemIdentificacao,
    DateOnly? UltimoMes,
    int Identificados,
    IReadOnlyList<FavorecidoDaEmendaDto> Maiores);
