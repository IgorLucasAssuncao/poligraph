using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// O questionário com perguntas das duas casas.
///
/// <para>
/// O cidadão responde um fluxo único e nunca escolhe entre Câmara e Senado (RNF-28):
/// escolher exigiria justamente o conhecimento que ele não tem. As duas casas votam
/// matérias diferentes (achado #7), então o resultado se separa <b>depois</b> do
/// questionário, em duas listas.
/// </para>
///
/// <para>
/// Toda a suíte semeia uma casa só, então o recorte por casa poderia sumir num refactor
/// e tudo continuaria verde. Estes testes semeiam as duas.
/// </para>
/// </summary>
public class TestesAfinidadeDuasCasas : BaseIntegracao
{
    private const string Rota = "/api/afinidade";

    /// <summary>
    /// O defeito que motivou tudo: o piso de comparáveis aplicado sobre o total.
    ///
    /// <para>
    /// O piso é uma fração das perguntas respondidas. Sobre o total das duas casas, com
    /// 6 perguntas da Câmara e 2 do Senado, ele seria 5 — e um senador tem no máximo 2
    /// comparáveis. Todo senador cairia fora, e a lista do Senado nasceria vazia para
    /// sempre, sem erro nenhum: a tela mostraria "nenhum senador próximo" como se fosse
    /// resultado.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Senador_SobreviveAoPiso_QueEPorCasa()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var lido = await ResponderTudoAsync(cliente);

        var senado = Assert.Single(lido!.PorCasa, c => c.Casa == "SENADO");
        Assert.NotEmpty(senado.MaisProximos);
        Assert.Equal(2, senado.PerguntasRespondidas);
    }

    [SkippableFact]
    public async Task Resultado_TrazUmaListaPorCasa()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var lido = await ResponderTudoAsync(cliente);

        Assert.Equal(8, lido!.TotalPerguntasRespondidas);
        Assert.Equal(["CAMARA", "SENADO"], lido.PorCasa.Select(c => c.Casa).Order());
    }

    /// <summary>
    /// Deputado não pode aparecer na lista do Senado, nem o contrário.
    ///
    /// <para>
    /// As duas casas compartilham as mesmas tabelas — a casa vive em
    /// <c>votacoes.casa</c>, e tudo o mais a herda por chave estrangeira. Uma consulta
    /// que esqueça o recorte mistura as duas em silêncio.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Nenhuma_Lista_Mistura_Parlamentar_Da_Outra_Casa()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var lido = await ResponderTudoAsync(cliente);

        foreach (var casa in lido!.PorCasa)
        {
            var ids = casa.MaisProximos.Concat(casa.MaisDistantes)
                .Select(p => p.PessoaId).Distinct().ToList();

            var fontes = await Db.PessoaFonteIds.AsNoTracking()
                .Where(f => ids.Contains(f.PessoaId))
                .Select(f => f.Fonte)
                .Distinct()
                .ToListAsync();

            Assert.Equal([casa.Casa], fontes);
        }
    }

    /// <summary>
    /// O denominador do painel é por casa.
    ///
    /// <para>
    /// Sem separar, uma pergunta da Câmara mostrava "439 de 747" — os 747 são deputados
    /// mais senadores, e os senadores nunca votaram aquela votação. Número plausível,
    /// tela intacta: o mesmo formato da PL35.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Denominador_DoPainel_NaoSomaAsDuasCasas()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var perguntas = await cliente.GetFromJsonAsync<List<PerguntaLida>>(
            "/api/afinidade/perguntas");

        var denominadores = perguntas!.Select(p => p.TotalPossivel).Distinct().Order().ToList();

        Assert.Equal([SenadoresSemeados, DeputadosSemeados], denominadores);
        Assert.DoesNotContain(DeputadosSemeados + SenadoresSemeados, denominadores);
    }

    /// <summary>
    /// A casa não é serializada na pergunta: o cidadão nunca sabe de qual casa ela veio,
    /// e saber não mudaria o que ele responde (RNF-28).
    /// </summary>
    [SkippableFact]
    public async Task Pergunta_NaoRevela_De_Qual_Casa_Veio()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var json = await cliente.GetStringAsync("/api/afinidade/perguntas");

        Assert.DoesNotContain("casa", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SENADO", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("votacao", json, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Casa sem base comparável simplesmente não aparece — em vez de aparecer com duas
    /// listas vazias, que o leitor interpretaria como "nenhum senador se parece com você".
    /// </summary>
    [SkippableFact]
    public async Task Casa_Sem_Resposta_Nenhuma_Nao_Entra_No_Resultado()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        // Responde só as da Câmara
        var respostas = Enumerable.Range(1, 6)
            .Select(i => new { perguntaId = $"cam-{i}", valor = 1 })
            .ToArray();

        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas });
        resposta.EnsureSuccessStatusCode();

        var lido = await resposta.Content.ReadFromJsonAsync<RespostaLida>();

        Assert.Equal(["CAMARA"], lido!.PorCasa.Select(c => c.Casa));
    }

    /// <summary>
    /// A posição do cidadão sai da execução DAQUELA casa.
    ///
    /// <para>
    /// Antes do Senado havia uma execução só, e pegar "a mais recente" funcionava por
    /// acidente. Com duas, a ordem entre elas depende de qual ETL rodou por último —
    /// e posicionar o cidadão no grafo do Senado a partir das respostas da Câmara daria
    /// um ponto plausível sobre uma figura que não é a dele.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Posicao_Sai_Da_Execucao_Da_Propria_Casa()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);

        // Eixos bem separados por casa: se a posição vier da execução errada, ela cai
        // na faixa da outra casa e a asserção denuncia.
        await SemearGrafoAsync("CAMARA", eixoBase: 0f);
        await SemearGrafoAsync("SENADO", eixoBase: 100f);

        using var cliente = CriarCliente();
        var lido = await ResponderTudoAsync(cliente);

        var camara = Assert.Single(lido!.PorCasa, c => c.Casa == "CAMARA");
        var senado = Assert.Single(lido.PorCasa, c => c.Casa == "SENADO");

        Assert.NotNull(camara.PosicaoNoGrafo);
        Assert.NotNull(senado.PosicaoNoGrafo);

        Assert.InRange(camara.PosicaoNoGrafo!.EixoX, 0f, 10f);
        Assert.InRange(senado.PosicaoNoGrafo!.EixoX, 100f, 110f);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private const int DeputadosSemeados = 5;
    private const int SenadoresSemeados = 3;

    /// <summary>
    /// Duas casas completas: pessoas com <c>fonte</c> própria, votações com <c>casa</c>
    /// própria, votos e perguntas. Todos concordam, para o cálculo ser previsível.
    /// </summary>
    private async Task SemearDuasCasasAsync(int perguntasCamara, int perguntasSenado)
    {
        var deputados = await SemearPessoasAsync("CAMARA", DeputadosSemeados);
        var senadores = await SemearPessoasAsync("SENADO", SenadoresSemeados);

        await SemearVotacoesEPerguntasAsync("CAMARA", "cam", perguntasCamara, deputados);
        await SemearVotacoesEPerguntasAsync("SENADO", "sen", perguntasSenado, senadores);
    }

    private async Task<List<long>> SemearPessoasAsync(string fonte, int quantas)
    {
        var criadas = new List<Pessoa>();
        for (var i = 1; i <= quantas; i++)
        {
            var pessoa = new Pessoa
            {
                NomeCivil = $"{fonte} {i}",
                NomeExibicao = $"{fonte} {i}"
            };
            Db.Pessoas.Add(pessoa);
            criadas.Add(pessoa);
        }

        await Db.SaveChangesAsync();

        foreach (var pessoa in criadas)
        {
            Db.PessoaFonteIds.Add(new PessoaFonteId
            {
                PessoaId = pessoa.Id,
                Fonte = fonte,
                IdExterno = $"{fonte}-{pessoa.Id}",
                Metodo = "MANUAL",
                Confianca = 1.0f
            });
        }

        await Db.SaveChangesAsync();

        return criadas.Select(p => p.Id).ToList();
    }

    private async Task SemearVotacoesEPerguntasAsync(
        string casa, string prefixo, int quantas, List<long> pessoas)
    {
        for (var i = 1; i <= quantas; i++)
        {
            var votacaoId = $"{prefixo}-v{i}";

            Db.Votacoes.Add(new Votacao
            {
                Id = votacaoId,
                Casa = casa,
                Legislatura = 57,
                Data = new DateOnly(2025, 6, 1),
                Descricao = "Aprovado o Projeto, nos termos do parecer.",
                Categoria = "SUBSTANTIVA",
                Plenario = true,
                VotosSim = pessoas.Count,
                VotosNao = 0
            });

            Db.Perguntas.Add(new Pergunta
            {
                Id = $"{prefixo}-{i}",
                VotacaoId = votacaoId,
                // O texto não pode citar a casa: `Pergunta_NaoRevela_De_Qual_Casa_Veio`
                // varre o JSON inteiro, e um fixture que a mencione anula a asserção.
                Texto = $"Afirmação {prefixo} número {i}.",
                Polaridade = 1,
                Ordem = (short)i,
                Ativa = true
            });

            await Db.SaveChangesAsync();

            foreach (var pessoaId in pessoas)
            {
                Db.Votos.Add(new Voto
                {
                    VotacaoId = votacaoId,
                    PessoaId = pessoaId,
                    Valor = 1,
                    PartidoNoVoto = "PARTIDO-A",
                    UfNoVoto = "SP"
                });
            }

            await Db.SaveChangesAsync();
        }
    }

    /// <summary>Uma execução concluída por casa, com os nós daquela casa.</summary>
    private async Task SemearGrafoAsync(string casa, float eixoBase)
    {
        var execucao = new Execucao
        {
            Casa = casa, Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = "CONCLUIDA"
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        var pessoas = await Db.PessoaFonteIds.AsNoTracking()
            .Where(f => f.Fonte == casa)
            .Select(f => f.PessoaId)
            .ToListAsync();

        for (var i = 0; i < pessoas.Count; i++)
        {
            Db.NosMetrica.Add(new NoMetrica
            {
                ExecucaoId = execucao.Id,
                PessoaId = pessoas[i],
                EixoX = eixoBase + i,
                EixoY = eixoBase + i,
                Comunidade = 1
            });
        }

        await Db.SaveChangesAsync();
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private static async Task<RespostaLida?> ResponderTudoAsync(HttpClient cliente)
    {
        var perguntas = await cliente.GetFromJsonAsync<List<PerguntaLida>>(
            "/api/afinidade/perguntas");

        var respostas = perguntas!.Select(p => new { perguntaId = p.Id, valor = 1 }).ToArray();
        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas });
        resposta.EnsureSuccessStatusCode();

        return await resposta.Content.ReadFromJsonAsync<RespostaLida>();
    }

    private record PerguntaLida(string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);

    private record ParlamentarLido(long PessoaId, string Nome, int Acordos, int Comparaveis);

    private record PosicaoLida(float EixoX, float EixoY, short? Comunidade);

    private record CasaLida(
        string Casa,
        int PerguntasRespondidas,
        List<ParlamentarLido> MaisProximos,
        List<ParlamentarLido> MaisDistantes,
        PosicaoLida? PosicaoNoGrafo);

    private record RespostaLida(int TotalPerguntasRespondidas, List<CasaLida> PorCasa);
}
