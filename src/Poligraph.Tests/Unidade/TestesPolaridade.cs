using Poligraph.Api.Services;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// 🔴 API3 — o teste mais importante do projeto.
///
/// Em 14% das votações nominais "Sim" significa REJEITAR. Um sinal invertido não aparece
/// na tela: aparece como um número plausível e errado, e passa pela banca.
///
/// ⚠️ Os casos de polaridade -1 são o teste inteiro. Os de +1 passam mesmo com o código
/// errado — por isso estão marcados.
/// </summary>
public class TestesPolaridade
{
    // ═══════════════════════════════════════════════════════════════
    // Polaridade +1 — texto principal. "Sim" aprova a afirmação.
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData( 1,  1, true )]   // parlamentar Sim   · cidadão concorda → acordo
    [InlineData(-1,  1, false)]   // parlamentar Não   · cidadão concorda → desacordo
    [InlineData( 1, -1, false)]
    [InlineData(-1, -1, true )]
    public void PolaridadePositiva_VotoEspelhaAAfirmacao(
        short voto, short resposta, bool esperado)
    {
        var posicao = new PosicaoParlamentar(voto, Polaridade: 1);
        Assert.Equal(esperado, CalculadoraAfinidade.Concordam(resposta, posicao));
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔴 Polaridade -1 — destaque supressivo. "Sim" REJEITA a afirmação.
    //    Estes quatro casos são a razão de existir deste arquivo.
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData( 1,  1, false)]   // 🔴 parlamentar Sim = rejeitar · cidadão concorda → DESACORDO
    [InlineData( 1, -1, true )]   // 🔴 parlamentar Sim = rejeitar · cidadão discorda → ACORDO
    [InlineData(-1,  1, true )]   // 🔴 parlamentar Não = manter   · cidadão concorda → ACORDO
    [InlineData(-1, -1, false)]   // 🔴
    public void PolaridadeNegativa_VotoInverteOSentidoDaAfirmacao(
        short voto, short resposta, bool esperado)
    {
        var posicao = new PosicaoParlamentar(voto, Polaridade: -1);
        Assert.Equal(esperado, CalculadoraAfinidade.Concordam(resposta, posicao));
    }

    /// <summary>
    /// ⭐ O invariante em uma frase: inverter a polaridade inverte o resultado.
    /// Se este teste falhar, a polaridade parou de ser aplicada em algum lugar.
    /// </summary>
    [Theory]
    [InlineData( 1,  1)]
    [InlineData( 1, -1)]
    [InlineData(-1,  1)]
    [InlineData(-1, -1)]
    public void InverterPolaridade_InverteSempreOResultado(short voto, short resposta)
    {
        var positiva = CalculadoraAfinidade.Concordam(resposta, new(voto, 1));
        var negativa = CalculadoraAfinidade.Concordam(resposta, new(voto, -1));

        Assert.NotEqual(positiva, negativa);
    }

    // ═══════════════════════════════════════════════════════════════
    // Comparabilidade — o que sai do DENOMINADOR
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void CidadaoRespondeuNaoSei_PerguntaSaiDaConta()
    {
        var posicao = new PosicaoParlamentar(1, 1);
        Assert.False(CalculadoraAfinidade.EComparavel(0, posicao));
    }

    [Fact]
    public void ParlamentarAusente_PerguntaSaiDaConta()
    {
        var posicao = new PosicaoParlamentar(Voto: null, Polaridade: 1);
        Assert.False(CalculadoraAfinidade.EComparavel(1, posicao));
    }

    [Fact]
    public void ParlamentarAbsteve_PerguntaSaiDaConta()
    {
        var posicao = new PosicaoParlamentar(Voto: 0, Polaridade: 1);
        Assert.False(CalculadoraAfinidade.EComparavel(1, posicao));
    }

    /// <summary>
    /// ⚠️ Ausência NÃO é discordância. Se virasse, quem falta muito pareceria discordar de
    /// todo mundo — e o ranking mediria presença, não afinidade.
    /// </summary>
    [Fact]
    public void Ausencia_NaoContaComoDiscordancia()
    {
        var respostas = new[] { new RespostaCidadao("q1", 1), new RespostaCidadao("q2", 1) };
        var posicoes = new Dictionary<string, PosicaoParlamentar>
        {
            ["q1"] = new(1, 1),        // votou e concordou
            ["q2"] = new(null, 1)      // ausente
        };

        var resultado = CalculadoraAfinidade.Calcular(42, respostas, posicoes);

        Assert.Equal(1, resultado.Acordos);
        Assert.Equal(1, resultado.Comparaveis);   // ⭐ não 2
    }
}
