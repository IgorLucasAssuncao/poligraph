using Poligraph.Api.Services;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// A ordem de "Quem vota parecido" (2026-10-03): a ficha abria com "31 de 31" e "21 de 21"
/// acima de "132 de 135".
/// </summary>
public class TestesOrdemDeConcordancia
{
    [Fact]
    public void BaseGrande_FicaAcimaDe100PorCentoComBasePequena()
    {
        Assert.True(OrdemDeConcordancia.LimiteInferior(132, 135) > OrdemDeConcordancia.LimiteInferior(31, 31));
        Assert.True(OrdemDeConcordancia.LimiteInferior(31, 31) > OrdemDeConcordancia.LimiteInferior(21, 21));
    }

    [Fact]
    public void ComAMesmaBase_AOrdemEADaProporcao()
    {
        Assert.True(OrdemDeConcordancia.LimiteInferior(90, 100) > OrdemDeConcordancia.LimiteInferior(80, 100));
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(0, 50)]
    [InlineData(50, 50)]
    [InlineData(37, 50)]
    public void FicaEntreZeroEUm_EAbaixoDaProporcao(int iguais, int @base)
    {
        var limite = OrdemDeConcordancia.LimiteInferior(iguais, @base);

        Assert.InRange(limite, 0, 1);
        if (@base > 0) Assert.True(limite <= (double)iguais / @base);
    }
}
