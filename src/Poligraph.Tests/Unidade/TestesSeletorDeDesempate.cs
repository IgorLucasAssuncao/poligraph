using Poligraph.Api.Services;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// O seletor que escolhe as próximas perguntas contra o empate do cidadão.
///
/// <para>
/// Por que ele existe, medido em 2026-08-29 com cada deputado no papel de cidadão e
/// 15 perguntas da Câmara: as 15 melhores fixas deixam <b>14</b> empatados no topo;
/// 8 fixas mais 7 escolhidas aqui deixam <b>6</b>; 8 fixas mais 7 sorteadas deixam
/// <b>16</b> — sortear é o mesmo que não adaptar.
/// </para>
/// </summary>
public class TestesSeletorDeDesempate
{
    /// <summary>
    /// A conta é pares separados, não quantidade de votos. Uma pergunta em que
    /// todos os empatados votaram igual separa zero pares, por mais gente que tenha
    /// votado nela.
    /// </summary>
    [Fact]
    public void PreferePerguntaQueDivideOGrupo_AUnanimeNaoSeparaNinguem()
    {
        var escolhidas = SeletorDeDesempate.Escolher(
            [1, 2, 3, 4],
            new Dictionary<string, IReadOnlyDictionary<long, short>>
            {
                ["unanime"] = Posicoes((1, 1), (2, 1), (3, 1), (4, 1)),
                ["divide"] = Posicoes((1, 1), (2, 1), (3, -1), (4, -1)),
            },
            1);

        Assert.Equal(["divide"], escolhidas);
    }

    /// <summary>
    /// Ausência não separa. Quem não votou naquela votação não fica distinguível
    /// de ninguém por ela — tratar o ausente como um dos lados inventaria uma separação
    /// que o dado não tem, que é o modo de falha que este projeto persegue.
    /// </summary>
    [Fact]
    public void AusenteNaoConta_ComoLado()
    {
        // "quase" separa 1 par (1 x 2). "ausentes" teria 2 x 2 se os ausentes
        // contassem como "não", e 0 na conta correta.
        var escolhidas = SeletorDeDesempate.Escolher(
            [1, 2, 3, 4],
            new Dictionary<string, IReadOnlyDictionary<long, short>>
            {
                ["ausentes"] = Posicoes((1, 1), (2, 1)),
                ["quase"] = Posicoes((1, 1), (2, -1)),
            },
            1);

        Assert.Equal(["quase"], escolhidas);
    }

    /// <summary>
    /// Depois da primeira escolha, o que conta é o que AINDA separa. Uma pergunta
    /// idêntica à já escolhida não acrescenta nada, mesmo dividindo o grupo ao meio.
    /// </summary>
    [Fact]
    public void SegundaEscolha_OlhaOQueASobrouParaSeparar()
    {
        var escolhidas = SeletorDeDesempate.Escolher(
            [1, 2, 3, 4],
            new Dictionary<string, IReadOnlyDictionary<long, short>>
            {
                ["a"] = Posicoes((1, 1), (2, 1), (3, -1), (4, -1)),
                ["copia-de-a"] = Posicoes((1, 1), (2, 1), (3, -1), (4, -1)),
                ["separa-o-resto"] = Posicoes((1, 1), (2, -1), (3, 1), (4, -1)),
            },
            2);

        Assert.Equal("separa-o-resto", escolhidas[1]);
    }

    [Fact]
    public void NaoRepetePergunta()
    {
        var escolhidas = SeletorDeDesempate.Escolher(
            [1, 2, 3, 4],
            new Dictionary<string, IReadOnlyDictionary<long, short>>
            {
                ["a"] = Posicoes((1, 1), (2, -1)),
                ["b"] = Posicoes((3, 1), (4, -1)),
                ["c"] = Posicoes((1, 1), (3, -1)),
            },
            3);

        Assert.Equal(3, escolhidas.Distinct().Count());
    }

    /// <summary>
    /// Sem empate não há o que dirigir, e a ordem de cobertura geral — a ordem em
    /// que as candidatas chegam — é a melhor aposta que existe sem informação.
    /// </summary>
    [Fact]
    public void SemEmpate_DevolveNaOrdemDeCobertura()
    {
        var escolhidas = SeletorDeDesempate.Escolher(
            [7],
            new Dictionary<string, IReadOnlyDictionary<long, short>>
            {
                ["primeira"] = Posicoes((1, 1)),
                ["segunda"] = Posicoes((2, 1)),
            },
            2);

        Assert.Equal(["primeira", "segunda"], escolhidas);
    }

    /// <summary>
    /// Quando nada mais separa, completa em vez de devolver lista curta: o
    /// questionário tem um tamanho anunciado na barra de progresso, e entregar menos
    /// faria o total prometido nunca ser alcançado.
    /// </summary>
    [Fact]
    public void QuandoNadaMaisSepara_CompletaAQuantidadePedida()
    {
        var escolhidas = SeletorDeDesempate.Escolher(
            [1, 2],
            new Dictionary<string, IReadOnlyDictionary<long, short>>
            {
                ["separa"] = Posicoes((1, 1), (2, -1)),
                ["nada-a"] = Posicoes((1, 1), (2, 1)),
                ["nada-b"] = Posicoes((1, -1), (2, -1)),
            },
            3);

        Assert.Equal(3, escolhidas.Count);
    }

    /// <summary>
    /// A mesma requisição tem de devolver a mesma lista. O servidor não guarda
    /// estado: se a ordem dependesse do hash do dicionário, recarregar a página no meio
    /// do questionário traria perguntas diferentes e as respostas anteriores ficariam
    /// órfãs.
    /// </summary>
    [Fact]
    public void MesmaEntrada_MesmaSaida()
    {
        var candidatas = new Dictionary<string, IReadOnlyDictionary<long, short>>
        {
            ["empatada-a"] = Posicoes((1, 1), (2, -1)),
            ["empatada-b"] = Posicoes((3, 1), (4, -1)),
        };

        var primeira = SeletorDeDesempate.Escolher([1, 2, 3, 4], candidatas, 2);
        var segunda = SeletorDeDesempate.Escolher([1, 2, 3, 4], candidatas, 2);

        Assert.Equal(primeira, segunda);
    }

    [Fact]
    public void SemCandidatas_DevolveVazio()
    {
        var escolhidas = SeletorDeDesempate.Escolher(
            [1, 2], new Dictionary<string, IReadOnlyDictionary<long, short>>(), 5);

        Assert.Empty(escolhidas);
    }

    private static IReadOnlyDictionary<long, short> Posicoes(params (long Pessoa, short Posicao)[] itens) =>
        itens.ToDictionary(i => i.Pessoa, i => i.Posicao);
}
