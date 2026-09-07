namespace Poligraph.Data;

/// <summary>Como uma pessoa foi ligada ao identificador de uma fonte.</summary>
public enum MetodoDeVinculo
{
    /// <summary>⭐ Hash de CPF — determinístico.</summary>
    CPF,

    /// <summary>⚠️ Semelhança de nome. Carrega <c>confianca</c> menor que 1.</summary>
    FUZZY,

    MANUAL,
}
