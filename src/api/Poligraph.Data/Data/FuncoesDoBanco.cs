namespace Poligraph.Data;

/// <summary>
/// Funções do Postgres usadas dentro de consultas LINQ. O mapeamento fica em
/// <see cref="PoligraphDb"/>; chamadas fora de uma consulta não têm o que executar.
/// </summary>
public static class FuncoesDoBanco
{
    /// <summary>
    /// <c>regexp_like(texto, padrao, opcoes)</c>, do Postgres 15 em diante. A expressão roda no
    /// banco, sob o tempo limite do comando, e nunca no .NET.
    /// </summary>
    /// <remarks>
    /// <para>DECISÃO: substitui <c>Regex.IsMatch</c> dentro das consultas. O Npgsql traduzia as duas formas para o mesmo operador do Postgres, mas a do .NET parecia rodar na API e pedia um tempo limite que a tradução não aceita.</para>
    /// </remarks>
    public static bool CasaComPadrao(string texto, string padrao, string opcoes) =>
        throw new InvalidOperationException($"{nameof(CasaComPadrao)} só existe dentro de uma consulta ao banco.");
}
