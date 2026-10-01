namespace Poligraph.Data;

/// <summary>
/// Um município, com o código do IBGE e o da Receita Federal (TOM).
/// </summary>
/// <remarks>
/// <para>
/// Vem da tabela de municípios da própria Receita, que traz os dois códigos lado a lado.
/// É a ponte por chave forte entre o cadastro de CNPJ, que usa o código TOM, e a malha do
/// IBGE, que desenha o mapa. Nome e UF ficam para a tela, e nunca servem de chave.
/// </para>
/// </remarks>
public class MunicipioModel
{
    /// <summary>Sete dígitos; os dois primeiros são o código da UF.</summary>
    public required string CodigoIbge { get; set; }

    /// <summary>O código de município da Receita Federal, usado no cadastro de CNPJ.</summary>
    public required string CodigoTom { get; set; }

    public required string Nome { get; set; }

    public required string Uf { get; set; }
}
