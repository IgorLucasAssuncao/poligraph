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
    // Polaridade +1 — texto principal. "Sim" aprova a afirmação.

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

    // Polaridade -1 — destaque supressivo. "Sim" REJEITA a afirmação.
    // Estes quatro casos são a razão de existir deste arquivo.

    [Theory]
    [InlineData( 1,  1, false)]   // parlamentar Sim = rejeitar · cidadão concorda → DESACORDO
    [InlineData( 1, -1, true )]   // parlamentar Sim = rejeitar · cidadão discorda → ACORDO
    [InlineData(-1,  1, true )]   // parlamentar Não = manter · cidadão concorda → ACORDO
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

    // Comparabilidade — o que sai do DENOMINADOR

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
            ["q1"] = new(1, 1),        // votou e concordou
            ["q2"] = new(null, 1)      // ausente
        };

        var resultado = CalculadoraAfinidade.Calcular(42, respostas, posicoes);

        Assert.Equal(1, resultado.Acordos);
        Assert.Equal(1, resultado.Comparaveis);   // não 2
    }

    // O detalhe — "em quais perguntas"

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
            // Votou "Sim" numa votação em que Sim REJEITA a afirmação: discorda de quem
            // respondeu "concordo".
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
            new RespostaCidadao("q3", 0),      // não sei
            new RespostaCidadao("q4", 1)
        };

        var posicoes = new Dictionary<string, PosicaoParlamentar>
        {
            ["q1"] = new(1, 1),                // acordo
            ["q2"] = new(-1, 1),               // desacordo
            ["q3"] = new(1, 1),                // fora: o cidadão não opinou
            ["q4"] = new(null, 1)              // fora: ausente
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
