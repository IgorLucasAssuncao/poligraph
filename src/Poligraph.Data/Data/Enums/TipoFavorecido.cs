namespace Poligraph.Data;

/// <summary>
/// Quem recebeu o dinheiro de uma emenda, como o Portal o classifica, com uma exceção.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="PESSOA"/> reúne pessoa física, inscrição genérica e empresário individual.
/// As três trazem nome de pessoa: a primeira com o CPF já mascarado, a segunda num código
/// que não é CPF, a terceira dentro da razão social. Nenhuma identificação delas é
/// guardada, nem em hash: a máscara não serve de chave, e a ficha só precisa do total.
/// </para>
/// </remarks>
public enum TipoFavorecido
{
    PESSOA_JURIDICA,
    UNIDADE_GESTORA,
    PESSOA,
    SEM_INFORMACAO,
}
