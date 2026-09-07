using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Os números da página inicial (RF-33).
///
/// <para>
/// 🔴 <b>Existe por causa de um defeito real.</b> <c>votosComPosicao</c> contava
/// <c>Valor != null</c> e afirmava <b>463.994</b> na Câmara, quando a posição de verdade
/// eram <b>462.867</b>. As 1.127 de diferença eram exatamente as abstenções — e no
/// Senado, 33.
/// </para>
///
/// <para>
/// ⚠️ Ele passou despercebido por dois motivos que se reforçam: o fixture ⛔ não tinha
/// nenhuma abstenção, e o número errado é <b>plausível</b> — ninguém confere 463.994
/// contra 462.867 a olho. ⭐ É o mesmo modo de falha da polaridade invertida.
/// </para>
/// </summary>
public class TestesEndpointPanorama(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string Rota = "/api/panorama";

    /// <summary>
    /// 🔴 A invariante do projeto: o número exibido é o número que o cálculo usa.
    /// <c>CalculadoraAfinidade.EComparavel</c> exclui a abstenção; o panorama tem de
    /// excluir também, ou a tela afirma uma base que o método ⛔ não usou.
    /// </summary>
    [SkippableFact]
    public async Task VotosComPosicao_ExcluiAbstencao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var panorama = await cliente.GetFromJsonAsync<PanoramaLido>(Rota);
        var camara = panorama!.PorCasa.Single(c => c.Casa == "CAMARA");

        var comPosicao = await Db.Votos
            .CountAsync(v => (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Casa == Casa.CAMARA);
        var naoNulos = await Db.Votos
            .CountAsync(v => v.Valor != null && v.Votacao!.Casa == Casa.CAMARA);

        // ⚠️ O teste só vale se o fixture TIVER abstenção — senão os dois números são
        //    iguais e a asserção passaria com o código errado.
        Assert.True(naoNulos > comPosicao, "o fixture precisa de ao menos uma abstenção");
        Assert.Equal(comPosicao, camara.VotosComPosicao);
    }

    /// <summary>
    /// ⚠️ Todas as contagens vêm do banco, ⛔ nenhuma é constante no código: a página
    /// inicial afirma o tamanho da base, e um número fixo mentiria no dia em que a
    /// ingestão mudasse.
    /// </summary>
    [SkippableFact]
    public async Task Contagens_ConferemComOBanco()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var panorama = await cliente.GetFromJsonAsync<PanoramaLido>(Rota);
        var camara = panorama!.PorCasa.Single(c => c.Casa == "CAMARA");

        Assert.Equal(
            await Db.Votacoes.CountAsync(v => v.Casa == Casa.CAMARA),
            camara.Votacoes);

        Assert.Equal(
            await Db.Perguntas.CountAsync(p => p.Ativa),
            panorama.PerguntasAtivas);
    }

    /// <summary>
    /// ⭐ Público de propósito: é o que a tela de login mostra a quem ainda ⛔ não entrou.
    /// </summary>
    [SkippableFact]
    public async Task Panorama_NaoExigeAutenticacao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync(Rota);

        resposta.EnsureSuccessStatusCode();
    }

    // ═══════════════════════════════════════════════════════════════

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private record PanoramaLido(short? Legislatura, int PerguntasAtivas, List<CasaLida> PorCasa);

    private record CasaLida(
        string Casa, int Parlamentares, int Votacoes, int VotacoesSecretas,
        int VotosComPosicao, int Comunidades, int Ligacoes);
}
