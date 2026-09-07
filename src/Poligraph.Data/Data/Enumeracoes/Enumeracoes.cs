namespace Poligraph.Data;

/// <summary>Pontes entre enumerações que compartilham tokens mas ⛔ não são a mesma coisa.</summary>
public static class Enumeracoes
{
    /// <summary>
    /// A fonte de identificador correspondente a uma casa.
    ///
    /// <para>
    /// ⚠️ <see cref="Casa"/> e <see cref="FonteDeIdentificador"/> compartilham os
    /// tokens <c>CAMARA</c> e <c>SENADO</c>, e enquanto as duas eram <c>string</c> o
    /// código as comparava diretamente — o que funcionava por coincidência de texto.
    /// São conceitos diferentes: <c>TSE</c> é fonte e ⛔ não é casa. A tradução agora é
    /// explícita, e ⛔ não existe caminho de volta: nem toda fonte tem casa.
    /// </para>
    /// </summary>
    public static FonteDeIdentificador ComoFonte(this Casa casa) => casa switch
    {
        Casa.CAMARA => FonteDeIdentificador.CAMARA,
        Casa.SENADO => FonteDeIdentificador.SENADO,
        _ => throw new ArgumentOutOfRangeException(nameof(casa)),
    };
}
