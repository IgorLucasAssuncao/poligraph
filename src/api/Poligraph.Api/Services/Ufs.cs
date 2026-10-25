namespace Poligraph.Api.Services;

/// <summary>As 27 unidades da federação, pela sigla. Para validar o que chega na requisição.</summary>
public static class Ufs
{
    public static readonly IReadOnlySet<string> Todas = new HashSet<string>
    {
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
        "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
    };
}
