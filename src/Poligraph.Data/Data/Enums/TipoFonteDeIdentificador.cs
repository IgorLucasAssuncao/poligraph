namespace Poligraph.Data;

/// <summary>
/// De onde veio o identificador externo de uma pessoa.
///
/// ⚠️ <c>TSE</c> aparece aqui e ⛔ não em <see cref="TipoCasa"/>: o Tribunal é fonte de
/// dado, não casa legislativa. Eram a mesma coluna de texto e nada impedia confundir.
/// </summary>
public enum TipoFonteDeIdentificador
{
    CAMARA,
    SENADO,
    TSE,
}
