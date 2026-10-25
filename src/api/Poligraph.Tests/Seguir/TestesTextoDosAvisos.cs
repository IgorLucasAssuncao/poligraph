using Poligraph.Worker;

namespace Poligraph.Tests;

/// <summary>
/// O texto do aviso no navegador (Pendência 89). Aparece na tela de bloqueio: diz o tipo do fato e
/// quantos, sem nome de parlamentar nem sigla de partido.
/// </summary>
[Trait("Tipo", "Unidade")]
public class TestesTextoDosAvisos
{
    [Fact]
    public void UmVotoContraOPartido_DizOFatoSemNome()
    {
        Assert.Equal(
            ("Voto contra o partido", "Um parlamentar que você segue votou contra a orientação do próprio partido."),
            AvisadorDoUsuario.Texto(["A2:x-1:7"]));
    }

    [Fact]
    public void TrocasDePartido_DizQuantas()
    {
        Assert.Equal(
            ("Troca de partido", "2 parlamentares que você segue mudaram de partido."),
            AvisadorDoUsuario.Texto(["A3:7:2030-01-09", "A3:8:2030-01-09"]));
    }

    [Fact]
    public void SoOMes_DizOMesPorExtenso()
    {
        Assert.Equal(
            ("Gastos de setembro", "Saíram os gastos da cota e as emendas pagas em setembro dos parlamentares que você segue."),
            AvisadorDoUsuario.Texto(["A4:2026-09", "A5:2026-09"]));
    }

    [Fact]
    public void Misto_JuntaNumAvisoSo()
    {
        Assert.Equal(
            ("Novidades de quem você segue", "2 votos contra o partido, 1 troca de partido e os gastos de setembro."),
            AvisadorDoUsuario.Texto(["A2:x-1:7", "A2:x-2:7", "A3:7:2030-01-09", "A4:2026-09"]));
    }

    [Fact]
    public void ChavesVapid_TemOTamanhoQueONavegadorEspera()
    {
        var (publica, privada) = ChavesVapid.Gerar();

        Assert.Equal(87, publica.Length);
        Assert.Equal(43, privada.Length);
    }
}
