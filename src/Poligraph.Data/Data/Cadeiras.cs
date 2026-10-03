namespace Poligraph.Data;

/// <summary>
/// Quantas cadeiras cada casa tem: o máximo de parlamentares que pode votar numa mesma votação.
/// </summary>
/// <remarks>
/// <para>Câmara: 513 (Lei Complementar 78/1993, pela Constituição, art. 45). Senado: 81, três por estado e pelo DF (art. 46).</para>
/// <para>É o denominador do painel (2026-10-03). Antes era quem votou na legislatura, 643 na 57ª da Câmara porque conta os suplentes que passaram pela cadeira, e o painel dizia "466 de 643" numa votação em que cabiam 513.</para>
/// </remarks>
public static class Cadeiras
{
    public const int Camara = 513;
    public const int Senado = 81;

    public static int Da(TipoCasa casa) => casa == TipoCasa.CAMARA ? Camara : Senado;
}
