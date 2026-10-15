namespace Poligraph.Data;

/// <summary>Como o autor de uma emenda foi resolvido para uma pessoa.</summary>
public enum TipoMetodoDeAutor
{
    AUTOMATICO,
    MANUAL,

    /// <summary> Registrado, não descartado: a lacuna é resultado, não sujeira.</summary>
    NAO_RESOLVIDO,
}
