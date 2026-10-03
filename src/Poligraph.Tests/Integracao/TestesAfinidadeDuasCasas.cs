using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

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
public class TestesAfinidadeDuasCasas(FixturePostgres postgres) : BaseIntegracao(postgres)
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

        var senado = Assert.Single(lido!.PorCasa, c => c.Casa == nameof(TipoCasa.SENADO));
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

            Assert.Equal([Enum.Parse<TipoCasa>(casa.Casa).ComoFonte()], fontes);
        }
    }

    /// <summary>
    /// O denominador do painel é por casa.
    ///
    /// <para>
    /// Sem separar, uma pergunta da Câmara mostrava "439 de 747" — os 747 são deputados
    /// mais senadores, e os senadores nunca votaram aquela votação. Número plausível,
    /// tela intacta: o mesmo formato da Pendência 35.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Denominador_DoPainel_NaoSomaAsDuasCasas()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 6, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        var denominadores =
            questionario!.Perguntas.Select(p => p.TotalPossivel).Distinct().Order().ToList();

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
        await SemearGrafoAsync(TipoCasa.CAMARA, eixoBase: 0f);
        await SemearGrafoAsync(TipoCasa.SENADO, eixoBase: 100f);

        using var cliente = CriarCliente();
        var lido = await ResponderTudoAsync(cliente);

        var camara = Assert.Single(lido!.PorCasa, c => c.Casa == nameof(TipoCasa.CAMARA));
        var senado = Assert.Single(lido.PorCasa, c => c.Casa == nameof(TipoCasa.SENADO));

        Assert.NotNull(camara.PosicaoNoGrafo);
        Assert.NotNull(senado.PosicaoNoGrafo);

        Assert.InRange(camara.PosicaoNoGrafo!.EixoX, 0f, 10f);
        Assert.InRange(senado.PosicaoNoGrafo!.EixoX, 100f, 110f);
    }

    /// <summary>
    /// O defeito que a rodada de desempate conserta.
    ///
    /// <para>
    /// A curadoria cresceu de 28 para 50 perguntas, e o mínimo obrigatório era
    /// <c>ceil(ativas × 0,60)</c> — subiu de 17 para 30 sozinho. Questionário maior
    /// não é questionário melhor: medido, 15 perguntas com desempate dirigido deixam 6
    /// parlamentares empatados no topo, e 25 fixas deixam 5.
    /// </para>
    ///
    /// <para>
    /// Aqui o poço tem 30 perguntas da Câmara e a abertura devolve 8.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Abertura_NaoDevolveOPocoInteiro()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 30, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        // 8 da Câmara + as 2 do Senado, que não têm desempate: são o poço inteiro.
        Assert.Equal(10, questionario!.Perguntas.Count);
    }

    /// <summary>
    /// <c>Total</c> anuncia o questionário INTEIRO, não o bloco de abertura. Sem
    /// isso a barra de progresso mostraria "Pergunta 9 de 10" e o denominador saltaria
    /// para 17 quando o desempate chegasse — quem estava terminando voltaria ao meio.
    /// </summary>
    [SkippableFact]
    public async Task Total_AnunciaOQuestionarioInteiro_NaoOBlocoDeAbertura()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 30, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        // 15 da Câmara (8 de abertura + 7 de desempate) mais as 2 do Senado.
        Assert.Equal(17, questionario!.Total);
        Assert.True(questionario.Total > questionario.Perguntas.Count);
    }

    /// <summary>
    /// O desempate nunca repete o que já foi respondido — repetir gastaria a
    /// pergunta sem separar ninguém, que é exatamente o que ele existe para evitar.
    /// </summary>
    [SkippableFact]
    public async Task Desempate_NaoRepetePerguntaJaRespondida()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 30, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        var respondidas = questionario!.Perguntas.Select(p => p.Id).ToHashSet();
        var respostas = respondidas.Select(id => new { perguntaId = id, valor = 1 }).ToArray();

        var resposta = await cliente.PostAsJsonAsync(
            "/api/afinidade/perguntas/desempate", new { respostas });
        resposta.EnsureSuccessStatusCode();

        var extras = await resposta.Content.ReadFromJsonAsync<List<PerguntaLida>>();

        Assert.Equal(7, extras!.Count);
        Assert.DoesNotContain(extras, p => respondidas.Contains(p.Id));
    }

    /// <summary>
    /// A regressão que motivou trocar a base do mínimo.
    ///
    /// <para>
    /// O mínimo era <c>ceil(perguntas ativas × 0,60)</c>. Com 32 ativas daria 20, e o
    /// questionário só OFERECE 17 — o cidadão responderia tudo o que a tela mostrou e
    /// receberia 422 pedindo perguntas que nunca existiram. Agora a base é o tamanho
    /// oferecido.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Responder_TudoQueFoiOferecido_Basta_MesmoComPocoGrande()
    {
        ExigeDocker();
        await SemearDuasCasasAsync(perguntasCamara: 30, perguntasSenado: 2);
        using var cliente = CriarCliente();

        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        var respostas = questionario!.Perguntas
            .Select(p => new { perguntaId = p.Id, valor = 1 })
            .ToList();

        var desempate = await cliente.PostAsJsonAsync(
            "/api/afinidade/perguntas/desempate", new { respostas });

        var extras = await desempate.Content.ReadFromJsonAsync<List<PerguntaLida>>();
        respostas.AddRange(extras!.Select(p => new { perguntaId = p.Id, valor = 1 }));

        Assert.Equal(questionario.Total, respostas.Count);

        var resultado = await cliente.PostAsJsonAsync(Rota, new { respostas });

        Assert.NotEqual(HttpStatusCode.UnprocessableEntity, resultado.StatusCode);
        resultado.EnsureSuccessStatusCode();
    }

    // PRIVADOS — na ordem de uso

    private const int DeputadosSemeados = 5;
    private const int SenadoresSemeados = 3;

    /// <summary>
    /// Duas casas completas: pessoas com <c>fonte</c> própria, votações com <c>casa</c>
    /// própria, votos e perguntas. Todos concordam, para o cálculo ser previsível.
    /// </summary>
    private async Task SemearDuasCasasAsync(int perguntasCamara, int perguntasSenado)
    {
        var deputados = await SemearPessoasAsync(TipoCasa.CAMARA, DeputadosSemeados);
        var senadores = await SemearPessoasAsync(TipoCasa.SENADO, SenadoresSemeados);

        await SemearVotacoesEPerguntasAsync(TipoCasa.CAMARA, "cam", perguntasCamara, deputados);
        await SemearVotacoesEPerguntasAsync(TipoCasa.SENADO, "sen", perguntasSenado, senadores);
    }

    private async Task<List<long>> SemearPessoasAsync(TipoCasa casa, int quantas)
    {
        var criadas = new List<PessoaModel>();
        for (var i = 1; i <= quantas; i++)
        {
            var pessoa = new PessoaModel
            {
                NomeCivil = $"{casa} {i}",
                NomeExibicao = $"{casa} {i}"
            };
            Db.Pessoas.Add(pessoa);
            criadas.Add(pessoa);
        }

        await Db.SaveChangesAsync();

        foreach (var pessoa in criadas)
        {
            Db.PessoaFonteIds.Add(new PessoaFonteIdModel
            {
                PessoaId = pessoa.Id,
                Fonte = casa.ComoFonte(),
                IdExterno = $"{casa}-{pessoa.Id}",
                Metodo = TipoMetodoDeVinculo.MANUAL,
                Confianca = 1.0f
            });
        }

        await Db.SaveChangesAsync();

        return criadas.Select(p => p.Id).ToList();
    }

    private async Task SemearVotacoesEPerguntasAsync(
        TipoCasa casa, string prefixo, int quantas, List<long> pessoas)
    {
        for (var i = 1; i <= quantas; i++)
        {
            var votacaoId = $"{prefixo}-v{i}";

            Db.Votacoes.Add(new VotacaoModel
            {
                Id = votacaoId,
                Casa = casa,
                Legislatura = 57,
                Data = new DateOnly(2025, 6, 1),
                Descricao = "Aprovado o Projeto, nos termos do parecer.",
                Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA,
                Plenario = true,
                VotosSim = pessoas.Count,
                VotosNao = 0
            });

            Db.Perguntas.Add(new PerguntaModel
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
                Db.Votos.Add(new VotoModel
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
    private async Task SemearGrafoAsync(TipoCasa casa, float eixoBase)
    {
        var execucao = new ExecucaoModel
        {
            Casa = casa, Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = TipoStatusDaExecucao.CONCLUIDA
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        var pessoas = await Db.PessoaFonteIds.AsNoTracking()
            .Where(f => f.Fonte == casa.ComoFonte())
            .Select(f => f.PessoaId)
            .ToListAsync();

        for (var i = 0; i < pessoas.Count; i++)
        {
            Db.NosMetrica.Add(new NoMetricaModel
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
        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        var respostas = questionario!.Perguntas
            .Select(p => new { perguntaId = p.Id, valor = 1 })
            .ToArray();
        var resposta = await cliente.PostAsJsonAsync(Rota, new { respostas });
        resposta.EnsureSuccessStatusCode();

        return await resposta.Content.ReadFromJsonAsync<RespostaLida>();
    }

    private record PerguntaLida(string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);

    /// <summary>
    /// <c>Total</c> é o tamanho do questionário INTEIRO, e é maior que
    /// <c>Perguntas.Count</c>: as de desempate só podem ser escolhidas depois de haver
    /// respostas. A barra de progresso precisa do total desde o início.
    /// </summary>
    private record QuestionarioLido(List<PerguntaLida> Perguntas, int Total);

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
