namespace Poligraph.Data;

/// <summary>Pontes entre enumerações que compartilham tokens mas ⛔ não são a mesma coisa.</summary>
public static class ExtensoesDeEnums
{
    /// <summary>
    /// A fonte de identificador correspondente a uma casa.
    ///
    /// <para>
    /// ⚠️ <see cref="TipoCasa"/> e <see cref="TipoFonteDeIdentificador"/> compartilham os
    /// tokens <c>CAMARA</c> e <c>SENADO</c>, e enquanto as duas eram <c>string</c> o
    /// código as comparava diretamente — o que funcionava por coincidência de texto.
    /// São conceitos diferentes: <c>TSE</c> é fonte e ⛔ não é casa. A tradução agora é
    /// explícita, e ⛔ não existe caminho de volta: nem toda fonte tem casa.
    /// </para>
    /// </summary>
    public static TipoFonteDeIdentificador ComoFonte(this TipoCasa casa) => casa switch
    {
        TipoCasa.CAMARA => TipoFonteDeIdentificador.CAMARA,
        TipoCasa.SENADO => TipoFonteDeIdentificador.SENADO,
        _ => throw new ArgumentOutOfRangeException(nameof(casa)),
    };
}
