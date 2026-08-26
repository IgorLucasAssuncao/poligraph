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
        await Poligraph.Migrations.SemeadorDesenvolvimento.SemearAsync(Db);

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
    private record RespostaJson(
        string Casa,
        int TotalPerguntasRespondidas,
        List<ParlamentarJson> MaisProximos,
        List<ParlamentarJson> MaisDistantes);
}
