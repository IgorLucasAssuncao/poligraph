using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// O endpoint de afinidade, ponta a ponta, contra Postgres real.
///
/// ⭐ O que estes testes protegem que os unitários não alcançam: o SQL da junção
/// pergunta↔voto, o piso de comparáveis aplicado sobre dados reais, e o contrato da
/// resposta — que ⛔ não pode conter percentual (RF-29).
/// </summary>
public class TestesEndpointAfinidade : BaseIntegracao
{
    private const string Rota = "/api/afinidade";

    [SkippableFact]
    public async Task Perguntas_NaoExpoemPolaridadeNemVotacao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var json = await cliente.GetStringAsync($"{Rota}/perguntas");

        // 🔴 expor a polaridade deixaria o cidadão inferir o voto ANTES de responder
        Assert.DoesNotContain("olaridade", json);
        Assert.DoesNotContain("otacaoId", json);
        Assert.Contains("q1", json);
    }

    /// <summary>
    /// O comparecimento exibido na tela precisa BATER com os votos que estão no banco.
    ///
    /// 🔴 É o número que a pessoa vê entre uma pergunta e outra. Se `votos_sim` /
    /// `votos_nao` sair de sincronia com a tabela `voto` — o que acontece na hora em que
    /// alguém escreve o placar à mão —, a tela afirma um comparecimento que não existe.
    /// </summary>
    [SkippableFact]
    public async Task Perguntas_TrazemComparecimentoQueConfereComOsVotos()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var perguntas = await cliente.GetFromJsonAsync<List<PerguntaLida>>($"{Rota}/perguntas");
        Assert.NotNull(perguntas);

        foreach (var pergunta in perguntas)
        {
            var votacaoId = await Db.Perguntas.AsNoTracking()
                .Where(p => p.Id == pergunta.Id)
                .Select(p => p.VotacaoId)
                .SingleAsync();

            var posicionados = await Db.Votos.AsNoTracking()
                .CountAsync(v => v.VotacaoId == votacaoId && (v.Valor == 1 || v.Valor == -1));

            Assert.Equal(posicionados, pergunta.TotalVotos);

            // ⚠️ zero significaria que o seed não contabilizou nada — e a tela cairia
            //    no caminho de "sem placar registrado" em desenvolvimento inteiro
            Assert.True(pergunta.TotalVotos > 0);

            // ⭐ o denominador do painel: ninguém pode se posicionar além da base
            var naBase = await Db.Votos.AsNoTracking()
                .Select(v => v.PessoaId).Distinct().CountAsync();

            Assert.Equal(naBase, pergunta.TotalPossivel);
            Assert.True(pergunta.TotalVotos <= pergunta.TotalPossivel);
        }
    }

    /// <summary>⛔ Sem `VotosSim`/`VotosNao`: o que sai da API é só o total.</summary>
    private record PerguntaLida(
        string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);

    /// <summary>
    /// 🔴 A posição do cidadão é o CENTROIDE de quem ele mais concorda, ⛔ nunca a
    /// posição de um deputado específico.
    ///
    /// ⚠️ Copiar a posição do primeiro colocado seria mais simples e estaria errado: o
    /// topo empata — a medição deu empate mediano de 30 —, e o cidadão saltaria de
    /// lugar entre duas execuções sem que nada tivesse mudado.
    /// </summary>
    [SkippableFact]
    public async Task Posicao_FicaEntreOsVizinhos_NaoEmCimaDeUmDeles()
    {
        ExigeDocker();
        await SemearAsync();
        await MontarNosDoGrafoAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas = TodasConcordo() });
        resposta.EnsureSuccessStatusCode();

        var lido = await resposta.Content.ReadFromJsonAsync<RespostaLida>();
        Assert.NotNull(lido?.PosicaoNoGrafo);

        var posicao = lido.PosicaoNoGrafo;
        var eixos = await Db.NosMetrica.AsNoTracking().Select(n => n.EixoX!.Value).ToListAsync();

        // dentro da nuvem, ⛔ não fora dela
        Assert.InRange(posicao.EixoX, eixos.Min(), eixos.Max());
        Assert.True(posicao.VizinhosUsados > 1, "um vizinho só não é centroide");

        // 🔴 A asserção que importa: o cidadão NÃO cai em cima de ninguém.
        //
        // ⚠️ A primeira versão deste teste só conferia o intervalo, e por isso passava
        //    mesmo com a implementação copiando a posição do primeiro colocado —
        //    verificado por mutação. Intervalo não distingue centroide de cópia.
        Assert.DoesNotContain(eixos, e => Math.Abs(e - posicao.EixoX) < 1e-6);

        // ⭐ A base precisa vir junto: é o que permite a tela ser franca sobre a
        //    diferença entre 22 perguntas e a legislatura inteira.
        Assert.Equal(lido.TotalPerguntasRespondidas, posicao.BaseDeVotacoes);
    }

    /// <summary>⭐ Sem execução do grafo, a tela omite o desenho — não inventa ponto.</summary>
    [SkippableFact]
    public async Task SemExecucaoDoGrafo_NaoDevolvePosicao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas = TodasConcordo() });
        resposta.EnsureSuccessStatusCode();

        var lido = await resposta.Content.ReadFromJsonAsync<RespostaLida>();

        Assert.Null(lido?.PosicaoNoGrafo);
    }

    private record PosicaoLida(
        float EixoX, float EixoY, short? Comunidade, int VizinhosUsados, int BaseDeVotacoes);

    private record CasaLida(string Casa, PosicaoLida? PosicaoNoGrafo);

    /// <summary>
    /// A posição saiu do topo da resposta e passou a viver dentro de cada casa: o grafo
    /// é por casa, e uma posição única teria de escolher qual — que é justamente a
    /// escolha que o RNF-28 proíbe pedir ao cidadão.
    /// </summary>
    private record RespostaLida(int TotalPerguntasRespondidas, List<CasaLida> PorCasa)
    {
        public PosicaoLida? PosicaoNoGrafo => PorCasa.SingleOrDefault()?.PosicaoNoGrafo;
    }

    /// <summary>Uma execução concluída com posições espalhadas, o mínimo para posicionar.</summary>
    private async Task MontarNosDoGrafoAsync()
    {
        var ids = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id)
            .Select(p => p.Id).ToListAsync();

        var execucao = new Execucao
        {
            Casa = "CAMARA", Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = "CONCLUIDA"
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            Db.NosMetrica.Add(new NoMetrica
            {
                ExecucaoId = execucao.Id,
                PessoaId = ids[i],
                Comunidade = (short)(i / 4),
                EixoX = -1f + i * (2f / Math.Max(ids.Count - 1, 1)),
                EixoY = 0.25f,
                NVotacoes = 5
            });
        }

        await Db.SaveChangesAsync();
    }

    [SkippableFact]
    public async Task PoucasRespostas_Retorna422()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        // 1 de 5 perguntas — abaixo do piso de 60% (CT7)
        var resposta = await cliente.PostAsJsonAsync(Rota, new
        {
            respostas = new[] { new { perguntaId = "q1", valor = 1 } }
        });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task RespostasSuficientes_RetornaAcordosEComparaveis_SemPercentual()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas = TodasConcordo() });
        resposta.EnsureSuccessStatusCode();

        var json = await resposta.Content.ReadAsStringAsync();

        Assert.Contains("acordos", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("comparaveis", json, StringComparison.OrdinalIgnoreCase);
        // ⛔ RF-29: a frase "X de Y" é montada na tela. A API não devolve proporção.
        Assert.DoesNotContain("proporcao", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("percentual", json, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// 🔴 O teste de polaridade ponta a ponta — e a forma dele importa.
    ///
    /// ⚠️ A primeira versão perguntava "quem ficou em primeiro votou NÃO na q5?". Estava
    /// errada: com quatro perguntas, o primeiro lugar é decidido pelo conjunto, não pela
    /// q5 sozinha. O teste falhou por premissa ruim, não por bug.
    ///
    /// ⭐ A forma correta isola a variável: duas requisições que diferem APENAS na q5
    /// (polaridade -1). Para um mesmo deputado, inverter só essa resposta tem de mover a
    /// contagem de acordos em exatamente 1 — e na direção oposta à intuição, porque ali
    /// "Sim" significa rejeitar.
    /// </summary>
    [SkippableFact]
    public async Task Polaridade_NegativaEAplicadaAteOBanco()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var concordando = await AcordosPorPessoaAsync(cliente, respostaQ5: 1);
        var discordando = await AcordosPorPessoaAsync(cliente, respostaQ5: -1);

        foreach (var (pessoaId, acordosConcordando) in concordando)
        {
            var votouNaQ5 = await PosicaoNaQ5Async(pessoaId);
            if (votouNaQ5 is null or 0) continue;          // ausente ou abstenção: fora da conta

            var acordosDiscordando = discordando[pessoaId];

            // 🔴 polaridade -1: quem votou SIM está REJEITANDO a afirmação.
            //    Logo, discordar da afirmação é que concorda com ele.
            var esperado = votouNaQ5 == 1
                ? acordosConcordando + 1                    // discordar acrescenta um acordo
                : acordosConcordando - 1;

            Assert.Equal(esperado, acordosDiscordando);
        }
    }

    [SkippableFact]
    public async Task Resultado_TrazMaisProximosEMaisDistantes()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas = TodasConcordo() });
        var resultado = await resposta.Content.ReadFromJsonAsync<RespostaJson>();

        Assert.NotNull(resultado);
        Assert.NotEmpty(resultado!.MaisProximos);
        Assert.NotEmpty(resultado.MaisDistantes);   // RF-28

        // ⭐ o mais próximo concorda mais que o mais distante
        var proximo = resultado.MaisProximos[0];
        var distante = resultado.MaisDistantes[0];
        Assert.True(
            (double)proximo.Acordos / proximo.Comparaveis
            >= (double)distante.Acordos / distante.Comparaveis);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private HttpClient CriarCliente() =>
        new FabricaApi(ConnectionString).CreateClient();

    private static object[] TodasConcordo() =>
    [
        new { perguntaId = "q1", valor = 1 },
        new { perguntaId = "q2", valor = 1 },
        new { perguntaId = "q3", valor = 1 },
        new { perguntaId = "q4", valor = 1 },
        new { perguntaId = "q5", valor = 1 }
    ];

    /// <summary>
    /// Responde tudo "concordo", variando só a q5, e devolve os acordos por pessoa.
    /// ⚠️ Junta próximos e distantes: o ranking não interessa aqui, a contagem sim.
    /// </summary>
    private static async Task<Dictionary<long, int>> AcordosPorPessoaAsync(
        HttpClient cliente, int respostaQ5)
    {
        var resposta = await cliente.PostAsJsonAsync(Rota, new
        {
            respostas = new[]
            {
                new { perguntaId = "q1", valor = 1 },
                new { perguntaId = "q2", valor = 1 },
                new { perguntaId = "q3", valor = 1 },
                new { perguntaId = "q4", valor = 1 },
                new { perguntaId = "q5", valor = respostaQ5 }
            }
        });
        resposta.EnsureSuccessStatusCode();

        var resultado = await resposta.Content.ReadFromJsonAsync<RespostaJson>();

        return resultado!.MaisProximos
            .Concat(resultado.MaisDistantes)
            .GroupBy(p => p.PessoaId)
            .ToDictionary(g => g.Key, g => g.First().Acordos);
    }

    private async Task<short?> PosicaoNaQ5Async(long pessoaId)
    {
        await using var db = CriarContexto();
        var pergunta = await db.Perguntas.AsNoTracking().FirstAsync(p => p.Id == "q5");
        var voto = await db.Votos.AsNoTracking()
            .FirstOrDefaultAsync(v => v.VotacaoId == pergunta.VotacaoId && v.PessoaId == pessoaId);

        return voto?.Valor;
    }

    private record ParlamentarJson(long PessoaId, string Nome, int Acordos, int Comparaveis);

    private record CasaJson(
        string Casa,
        int PerguntasRespondidas,
        List<ParlamentarJson> MaisProximos,
        List<ParlamentarJson> MaisDistantes);

    private record RespostaJson(int TotalPerguntasRespondidas, List<CasaJson> PorCasa)
    {
        /// <summary>Atalho para os testes de casa única: a primeira (e só) casa.</summary>
        public CasaJson Unica => Assert.Single(PorCasa);

        public List<ParlamentarJson> MaisProximos => Unica.MaisProximos;
        public List<ParlamentarJson> MaisDistantes => Unica.MaisDistantes;
    }
}
