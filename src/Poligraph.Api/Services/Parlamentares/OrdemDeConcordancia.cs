namespace Poligraph.Api.Services;

/// <summary>
/// A ordem de "Quem vota parecido": pela proporção de votos iguais, descontada a incerteza da base.
/// </summary>
/// <remarks>
/// <para>Ordenar pela proporção pura punha "31 de 31" acima de "132 de 135" (2026-10-03): com base pequena, 100% sai fácil. O limite inferior do intervalo de Wilson a 95% é a menor proporção compatível com o que se observou, e cai quanto menor for a base.</para>
/// <para>Só muda a ORDEM da lista. O número na tela continua "votaram igual em X de Y".</para>
/// </remarks>
public static class OrdemDeConcordancia
{
    /// <summary>O z de 95% bicaudal.</summary>
    public const double Z = 1.96;

    /// <summary>Limite inferior de Wilson para <paramref name="iguais"/> em <paramref name="base"/>. Zero sem base.</summary>
    public static double LimiteInferior(int iguais, int @base)
    {
        if (@base <= 0) return 0;

        var p = (double)iguais / @base;
        var z2 = Z * Z;
        var centro = p + z2 / (2 * @base);
        var margem = Z * Math.Sqrt(p * (1 - p) / @base + z2 / (4.0 * @base * @base));

        return (centro - margem) / (1 + z2 / @base);
    }
}
