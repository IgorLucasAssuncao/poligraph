using Poligraph.Worker;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// O texto do aviso no navegador (Pendência 89). Aparece na tela de bloqueio, então só conta:
/// nenhum nome de parlamentar, nenhuma sigla de partido.
/// </summary>
public class TestesTextoDosAvisos
{
    [Fact]
    public void SoVoto_DizQuantas()
    {
        Assert.Equal("2 novidades de quem você segue.", AvisadorDoUsuario.Corpo(["A2:x-1:7", "A3:7:2030-01-09"]));
        Assert.Equal("1 novidade de quem você segue.", AvisadorDoUsuario.Corpo(["A2:x-1:7"]));
    }

    [Fact]
    public void SoOMes_DizOResumo()
    {
        Assert.Equal("Os gastos e as emendas de 09/2026 de quem você segue chegaram.", AvisadorDoUsuario.Corpo(["A4:2026-09", "A5:2026-09"]));
    }

    [Fact]
    public void VotoEMes_JuntaNumAvisoSo()
    {
        Assert.Equal("1 novidade de quem você segue, e os gastos de 09/2026.", AvisadorDoUsuario.Corpo(["A2:x-1:7", "A4:2026-09"]));
    }

    [Fact]
    public void ChavesVapid_TemOTamanhoQueONavegadorEspera()
    {
        var (publica, privada) = ChavesVapid.Gerar();

        Assert.Equal(87, publica.Length);
        Assert.Equal(43, privada.Length);
    }
}
