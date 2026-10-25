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

    /// <summary>População residente estimada pelo IBGE (SIDRA, tabela 6579), recarregada pelo comando <c>populacao</c>.</summary>
    /// <remarks>
    /// <para>Serve ao mapa "por habitante": em reais absolutos, SP e MG ficam no topo só por serem grandes (2026-10-03).</para>
    /// </remarks>
    public int? Populacao { get; set; }

    /// <summary>O ano da estimativa de <see cref="Populacao"/>.</summary>
    public short? PopulacaoAno { get; set; }

    /// <summary>O arquivo do IBGE de onde veio a população. A linha tem duas fontes: o código e o nome vêm da Receita (<see cref="CargaId"/>), a população do IBGE.</summary>
    public long? PopulacaoCargaId { get; set; }

    /// <summary>A tabela de municípios (TOM e IBGE) que gravou a linha por último; a população tem fonte própria.</summary>
    public long? CargaId { get; set; }
}
