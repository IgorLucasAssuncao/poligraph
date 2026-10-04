using System.Globalization;
using Microsoft.AspNetCore.Http;
using Poligraph.Api.Tipos;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// Os tipos que a API lê da URL. Valor fora do formato é recusado na entrada: o endpoint responde
/// 400 antes de chegar ao serviço.
/// </summary>
public class TestesTiposDeDominio
{
    [Theory]
    [InlineData("2025", true)]
    [InlineData("1988", true)]
    [InlineData("2100", true)]
    [InlineData("1987", false)]
    [InlineData("2101", false)]
    [InlineData("+2025", false)]
    [InlineData("20x5", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Ano_SoQuatroDigitosNaFaixaDoDadoPublico(string? texto, bool valido)
    {
        Assert.Equal(valido, AnoDaEmenda.TryParse(texto, CultureInfo.InvariantCulture, out _));
        Assert.Equal(valido, AnoDaDespesa.TryParse(texto, CultureInfo.InvariantCulture, out _));
        Assert.Equal(valido, AnoDaEleicao.TryParse(texto, CultureInfo.InvariantCulture, out _));
        Assert.Equal(valido, AnoDoOrcamento.TryParse(texto, CultureInfo.InvariantCulture, out _));
        Assert.Equal(valido, AnoDaReconciliacao.TryParse(texto, CultureInfo.InvariantCulture, out _));
    }

    [Fact]
    public void Ano_ParseDevolveOValor_OuRecusaComFormatException()
    {
        Assert.Equal(2025, AnoDaEmenda.Parse("2025", null).Valor);
        Assert.Equal("2025", AnoDaDespesa.Parse("2025", null).ToString());
        Assert.Equal(2022, AnoDaEleicao.Parse("2022", null).Valor);
        Assert.Equal(2024, AnoDoOrcamento.Parse("2024", null).Valor);
        Assert.Equal(2016, AnoDaReconciliacao.Parse("2016", null).Valor);
        Assert.Throws<FormatException>(() => AnoDaEmenda.Parse("1500", null));
    }

    [Fact]
    public async Task Periodo_DeEAte_DaOsAnosEOTexto()
    {
        var periodo = (await Periodo<AnoDaEmenda>.BindAsync(Contexto("?de=2023&ate=2025")))!.Value;

        Assert.True(periodo.Completo);
        Assert.Equal([2023, 2024, 2025], periodo.Anos);
        Assert.Equal("de 2023 a 2025", periodo.Texto);
    }

    [Fact]
    public async Task Periodo_AnoSozinho_EAsDuasPontas()
    {
        var periodo = (await Periodo<AnoDoOrcamento>.BindAsync(Contexto("?ano=2024")))!.Value;

        Assert.True(periodo.Completo);
        Assert.Equal("de 2024", periodo.Texto);
    }

    [Fact]
    public async Task Periodo_SemParametro_FicaAberto_EForaDoFormatoEhNulo()
    {
        var aberto = (await Periodo<AnoDaEmenda>.BindAsync(Contexto("")))!.Value;
        var soInicio = (await Periodo<AnoDaEmenda>.BindAsync(Contexto("?de=2023")))!.Value;

        Assert.False(aberto.Completo);
        Assert.False(soInicio.Completo);
        Assert.Null(await Periodo<AnoDaEmenda>.BindAsync(Contexto("?de=abc")));
        Assert.Null(await Periodo<AnoDaEmenda>.BindAsync(Contexto("?ate=1900")));
        Assert.Null(await Periodo<AnoDaEmenda>.BindAsync(Contexto("?ano=x")));
    }

    [Theory]
    [InlineData("12", true)]
    [InlineData("0", false)]
    [InlineData("-1", false)]
    [InlineData("abc", false)]
    public void IdPessoa_SoInteiroPositivo(string texto, bool valido)
    {
        Assert.Equal(valido, IdPessoa.TryParse(texto, null, out var idPessoa));
        if (valido)
        {
            Assert.Equal(texto, idPessoa.ToString());
        }
    }

    [Theory]
    [InlineData("57", true)]
    [InlineData("1", true)]
    [InlineData("0", false)]
    [InlineData("100", false)]
    public void Legislatura_DeUmANoventaENove(string texto, bool valido)
    {
        Assert.Equal(valido, Legislatura.TryParse(texto, null, out var legislatura));
        if (valido)
        {
            Assert.Equal(texto, legislatura.ToString());
        }
    }

    [Fact]
    public void Uf_ViraMaiuscula_EDesconhecidaERecusada()
    {
        Assert.True(Uf.TryParse(" pr ", null, out var uf));
        Assert.Equal("PR", uf.ToString());
        Assert.False(Uf.TryParse("XX", null, out _));
        Assert.Throws<FormatException>(() => Uf.Parse("XX", null));
    }

    [Theory]
    [InlineData("12345678000190", true)]
    [InlineData("1234567800019", false)]
    [InlineData("12.345.678/0001-90", false)]
    public void Cnpj_QuatorzeDigitos(string texto, bool valido)
    {
        Assert.Equal(valido, Cnpj.TryParse(texto, null, out _));
    }

    [Theory]
    [InlineData("4106902", true)]
    [InlineData("410690", false)]
    [InlineData("41069o2", false)]
    public void CodigoIbge_SeteDigitos(string texto, bool valido)
    {
        Assert.Equal(valido, CodigoIbge.TryParse(texto, null, out _));
    }

    [Fact]
    public void CategoriaDeDespesa_VaziaERecusada()
    {
        Assert.True(CategoriaDeDespesa.TryParse("COMBUSTÍVEIS", null, out var categoria));
        Assert.Equal("COMBUSTÍVEIS", categoria.ToString());
        Assert.False(CategoriaDeDespesa.TryParse("  ", null, out _));
    }

    [Fact]
    public void Contexto_NomeDaUrl_IdaEVolta()
    {
        foreach (var (nome, tipo) in ContextoDeProcedencia.Nomes)
        {
            var contexto = ContextoDeProcedencia.Parse(nome, null);
            Assert.Equal(tipo, contexto.Tipo);
            Assert.Equal(nome, contexto.ToString());
        }

        Assert.Throws<FormatException>(() => ContextoDeProcedencia.Parse("inventado", null));
    }

    private static DefaultHttpContext Contexto(string consulta)
    {
        var contexto = new DefaultHttpContext();
        contexto.Request.QueryString = new QueryString(consulta);
        return contexto;
    }
}
