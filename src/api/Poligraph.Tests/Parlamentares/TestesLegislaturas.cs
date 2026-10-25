using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// As contas de período de <see cref="Legislaturas"/>. Um ano a mais ou a menos não quebra
/// tela nenhuma: mostra o dinheiro do mandato vizinho.
/// </summary>
[Trait("Tipo", "Unidade")]
public class TestesLegislaturas
{
    /// <summary>A emenda de um ano é do mandato anterior à posse daquele ano (achado #24).</summary>
    [Theory]
    [InlineData(2019, 55)]
    [InlineData(2020, 56)]
    [InlineData(2023, 56)]
    [InlineData(2024, 57)]
    [InlineData(2027, 57)]
    [InlineData(2028, 58)]
    public void DoAnoDeEmenda_EhOInversoDeAnosDeEmenda(int ano, short legislatura)
    {
        Assert.Equal(legislatura, Legislaturas.DoAnoDeEmenda(ano));

        var (de, ate) = Legislaturas.AnosDeEmenda(legislatura);
        Assert.InRange(ano, de, ate);
    }
}
