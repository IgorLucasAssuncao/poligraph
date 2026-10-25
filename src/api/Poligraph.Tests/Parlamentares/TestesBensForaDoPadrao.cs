using Poligraph.Api.Services;

namespace Poligraph.Tests;

/// <summary>A declaração de bens que salta fora do padrão da própria pessoa, com os casos medidos na base.</summary>
[Trait("Tipo", "Unidade")]
public class TestesBensForaDoPadrao
{
    [Fact]
    public void Salto_de_cem_vezes_sobre_a_declaracao_anterior_marca()
    {
        var anos = BensForaDoPadrao.CalcularAnos([(2018, 300_000m), (2022, 315_000m), (2026, 400_000_000m)]);

        Assert.Equal([2026], anos);
    }

    [Fact]
    public void Patrimonio_alto_que_se_repete_nao_marca()
    {
        var anos = BensForaDoPadrao.CalcularAnos([(2018, 500_000m), (2022, 158_000_000m), (2026, 154_000_000m)]);

        Assert.Empty(anos);
    }

    [Fact]
    public void Salto_pequeno_em_reais_nao_marca_mesmo_sendo_cem_vezes()
    {
        var anos = BensForaDoPadrao.CalcularAnos([(2020, 10_000m), (2024, 5_000_000m)]);

        Assert.Empty(anos);
    }

    [Fact]
    public void Declaracao_unica_so_marca_acima_de_um_bilhao()
    {
        Assert.Equal([2008], BensForaDoPadrao.CalcularAnos([(2008, 1_350_955_500m)]));
        Assert.Empty(BensForaDoPadrao.CalcularAnos([(2018, 239_709_825m)]));
    }

    [Fact]
    public void Salto_no_meio_precisa_ser_maior_que_as_duas_vizinhas()
    {
        Assert.Equal([2012], BensForaDoPadrao.CalcularAnos([(2008, 900_000m), (2012, 150_000_000m), (2016, 970_000m)]));
        Assert.Empty(BensForaDoPadrao.CalcularAnos([(2008, 900_000m), (2012, 150_000_000m), (2016, 140_000_000m)]));
    }
}
