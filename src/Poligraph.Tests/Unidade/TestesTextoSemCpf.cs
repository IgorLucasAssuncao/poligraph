using Poligraph.Api.Services;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// O CPF que vem dentro do nome empresarial de MEI não sai da API.
/// </summary>
public class TestesTextoSemCpf
{
    [Theory]
    [InlineData("FULANO DE TAL 12345678900", "FULANO DE TAL")]
    [InlineData("FULANO DE TAL 123.456.789-00", "FULANO DE TAL")]
    [InlineData("12345678900 - FULANO DE TAL", "FULANO DE TAL")]
    [InlineData("POSTO EXEMPLO LTDA", "POSTO EXEMPLO LTDA")]
    [InlineData("EMPRESA 12345678000190", "EMPRESA 12345678000190")]
    public void Limpar_TiraOCpfEPreservaOCnpj(string bruto, string esperado) =>
        Assert.Equal(esperado, TextoSemCpf.Limpar(bruto));
}
