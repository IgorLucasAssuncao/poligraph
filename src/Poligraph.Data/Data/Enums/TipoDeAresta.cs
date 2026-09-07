namespace Poligraph.Data;

/// <summary>
/// A camada de uma aresta.
///
/// São naturezas diferentes e nunca se somam num desenho só: comissão comum mede
/// convivência, coautoria mede colaboração. Só a primeira é o grafo do título.
/// </summary>
public enum TipoDeAresta
{
    SIMILARIDADE_VOTO,

    /// <summary> Prevista no schema; ainda sem origem de dado.</summary>
    COMISSAO_COMUM,

    /// <summary> Prevista no schema; ainda sem origem de dado.</summary>
    COAUTORIA,
}
