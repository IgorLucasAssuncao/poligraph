using Poligraph.Api.Services;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// API3 — o teste mais importante do projeto.
///
/// Em 14% das votações nominais "Sim" significa REJEITAR. Um sinal invertido não aparece
/// na tela: aparece como um número plausível e errado, e passa pela banca.
///
/// Os casos de polaridade -1 são o teste inteiro. Os de +1 passam mesmo com o código
/// errado — por isso estão marcados.
/// </summary>
public class TestesPolaridade
{

    [Theory]
    [InlineData( 1,  1, true )]
    [InlineData(-1,  1, false)]
    [InlineData( 1, -1, false)]
    [InlineData(-1, -1, true )]
    public void PolaridadePositiva_VotoEspelhaAAfirmacao(
        short voto, short resposta, bool esperado)
    {
        var posicao = new PosicaoParlamentar(voto, Polaridade: 1);
        Assert.Equal(esperado, CalculadoraAfinidade.Concordam(resposta, posicao));
    }

    [Theory]
    [InlineData( 1,  1, false)]
    [InlineData( 1, -1, true )]
    [InlineData(-1,  1, true )]
    [InlineData(-1, -1, false)]
    public void PolaridadeNegativa_VotoInverteOSentidoDaAfirmacao(
        short voto, short resposta, bool esperado)
    {
        var posicao = new PosicaoParlamentar(voto, Polaridade: -1);
        Assert.Equal(esperado, CalculadoraAfinidade.Concordam(resposta, posicao));
    }

    /// <summary>
    /// O invariante em uma frase: inverter a polaridade inverte o resultado.
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

    [Fact]
    public void CidadaoRespondeuNaoSei_PerguntaSaiDaConta()
    {
        var posicao = new PosicaoParlamentar(1, 1);
        Assert.False(CalculadoraAfinidade.EComparavel(0, posicao));
    }

    [Fact]
    public void ParlamentarAusente_PerguntaSaiDaConta()
    {
        var posicao = new PosicaoParlamentar(VotoModel: null, Polaridade: 1);
        Assert.False(CalculadoraAfinidade.EComparavel(1, posicao));
    }

    [Fact]
    public void ParlamentarAbsteve_PerguntaSaiDaConta()
    {
        var posicao = new PosicaoParlamentar(VotoModel: 0, Polaridade: 1);
        Assert.False(CalculadoraAfinidade.EComparavel(1, posicao));
    }

    /// <summary>
    /// Ausência NÃO é discordância. Se virasse, quem falta muito pareceria discordar de
    /// todo mundo — e o ranking mediria presença, não afinidade.
    /// </summary>
    [Fact]
    public void Ausencia_NaoContaComoDiscordancia()
    {
        var respostas = new[] { new RespostaCidadao("q1", 1), new RespostaCidadao("q2", 1) };
        var posicoes = new Dictionary<string, PosicaoParlamentar>
        {
            ["q1"] = new(1, 1),
            ["q2"] = new(null, 1)
        };

        var resultado = CalculadoraAfinidade.Calcular(42, respostas, posicoes);

        Assert.Equal(1, resultado.Acordos);
        Assert.Equal(1, resultado.Comparaveis);
    }

    /// <summary>
    /// O detalhe corre o MESMO risco de polaridade que o total, e é pior quando erra:
    /// um total invertido é um número plausível, mas uma lista invertida diz ao cidadão,
    /// por escrito, que ele concordou justamente onde discordou.
    /// </summary>
    [Fact]
    public void Detalhe_RespeitaAPolaridadeInvertida()
    {
        var respostas = new[] { new RespostaCidadao("q1", 1) };
        var posicoes = new Dictionary<string, PosicaoParlamentar>
        {
            ["q1"] = new(1, -1)
        };

        var detalhe = CalculadoraAfinidade.Detalhar(respostas, posicoes);

        Assert.Empty(detalhe.Acordou);
        Assert.Equal(["q1"], detalhe.Discordou);
    }

    /// <summary>
    /// As duas listas somadas dão <c>Comparaveis</c>, nunca o total respondido —
    /// é a mesma regra do denominador, e é o que permite a tela dizer quantas ficaram
    /// de fora sem recontar nada.
    /// </summary>
    [Fact]
    public void Detalhe_SomaBateComOsComparaveis()
    {
        var respostas = new[]
        {
            new RespostaCidadao("q1", 1),
            new RespostaCidadao("q2", 1),
            new RespostaCidadao("q3", 0),
            new RespostaCidadao("q4", 1)
        };

        var posicoes = new Dictionary<string, PosicaoParlamentar>
        {
            ["q1"] = new(1, 1),
            ["q2"] = new(-1, 1),
            ["q3"] = new(1, 1),
            ["q4"] = new(null, 1)
        };

        var resultado = CalculadoraAfinidade.Calcular(42, respostas, posicoes);
        var detalhe = CalculadoraAfinidade.Detalhar(respostas, posicoes);

        Assert.Equal(["q1"], detalhe.Acordou);
        Assert.Equal(["q2"], detalhe.Discordou);
        Assert.Equal(resultado.Comparaveis, detalhe.Acordou.Count + detalhe.Discordou.Count);
    }

    /// <summary>
    /// Pergunta que o parlamentar não votou fica fora das DUAS listas. Aparecer em
    /// "discordaram" seria afirmar uma posição que ele nunca tomou.
    /// </summary>
    [Fact]
    public void Detalhe_AusenteNaoApareceEmNenhumaDasListas()
    {
        var respostas = new[] { new RespostaCidadao("q1", 1) };
        var posicoes = new Dictionary<string, PosicaoParlamentar> { ["q1"] = new(null, 1) };

        var detalhe = CalculadoraAfinidade.Detalhar(respostas, posicoes);

        Assert.Empty(detalhe.Acordou);
        Assert.Empty(detalhe.Discordou);
    }
}
