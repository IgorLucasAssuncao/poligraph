namespace Poligraph.Data;

/// <summary>
/// De onde veio o identificador externo de uma pessoa.
///
/// ⚠️ <c>TSE</c> aparece aqui e ⛔ não em <see cref="Casa"/>: o Tribunal é fonte de
/// dado, não casa legislativa. Eram a mesma coluna de texto e nada impedia confundir.
/// </summary>
public enum FonteDeIdentificador
{
    CAMARA,
    SENADO,
    TSE,
}
