using Poligraph.Api.Dtos;
using Poligraph.Api.Services;

namespace Poligraph.Tests;

/// <summary>
/// O impeachment de 2016: a chapa eleita em 2014 vira duas gestões, a da titular até o afastamento e a do vice depois dele.
/// </summary>
[Trait("Tipo", "Unidade")]
public class TestesSucessoesNaPresidencia
{
    private static readonly GestaoDto ChapaDe2014 = new(
        2014, 2015, 2018,
        new PessoaDaGestaoDto("DILMA VANA ROUSSEFF", "DILMA", "PT"),
        new PessoaDaGestaoDto("MICHEL MIGUEL ELIAS TEMER LULIA", "MICHEL TEMER", "PMDB"),
        "COM A FORÇA DO POVO");

    [Fact]
    public void ChapaDe2014_ViraDuasGestoes_NoDiaDoAfastamento()
    {
        var gestoes = GestoesDoPeriodo.Dividida(ChapaDe2014, SucessoesNaPresidencia.DaEleicao(2014));

        Assert.Collection(
            gestoes,
            titular =>
            {
                Assert.Equal(("DILMA", 2015, 2016), (titular.Presidente.NomeDeUrna, titular.PrimeiroAno, titular.UltimoAno));
                Assert.Equal(new DateOnly(2016, 5, 12), titular.Ate);
                Assert.Equal("MICHEL TEMER", titular.Vice?.NomeDeUrna);
            },
            vice =>
            {
                Assert.Equal(("MICHEL TEMER", 2016, 2018), (vice.Presidente.NomeDeUrna, vice.PrimeiroAno, vice.UltimoAno));
                Assert.Equal(new DateOnly(2016, 5, 12), vice.Desde);
                Assert.Null(vice.Vice);
            });
        Assert.All(gestoes, g => Assert.Equal(new DateOnly(2016, 8, 31), g.Sucessao?.Posse));
    }

    [Fact]
    public void ChapaSemTroca_FicaInteira() =>
        Assert.Equal([ChapaDe2014 with { AnoDaEleicao = 2018 }], GestoesDoPeriodo.Dividida(ChapaDe2014 with { AnoDaEleicao = 2018 }, SucessoesNaPresidencia.DaEleicao(2018)));

    [Fact]
    public void Fonte_EAResolucaoDoSenado() =>
        Assert.StartsWith("https://www.lexml.gov.br/urn/urn:lex:br:senado.federal:resolucao:2016-08-31", SucessoesNaPresidencia.DaEleicao(2014)!.UrlDaFonte);
}
