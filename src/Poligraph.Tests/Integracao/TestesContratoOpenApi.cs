using System.Text.Json;
using Poligraph.Api.Dtos;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// CT3 — o contrato entre a API e o front, conferido contra o documento OpenAPI.
///
/// <para>
/// <b>O que este arquivo pega, e nenhum outro teste pega.</b> Renomear
/// <c>Acordos</c> para <c>Acertos</c> num DTO compila, passa em todo teste de C#, e
/// quebra a tela — o front lê <c>acordos</c> e recebe <c>undefined</c>. Sem erro em
/// lugar nenhum: aparece como <i>"concordaram em de perguntas"</i>.
/// </para>
///
/// <para>
/// A lista abaixo não é decorativa: cada rota e cada campo foi extraído de
/// <c>src/web/src/api.ts</c>. Se o front passar a ler um campo novo, ele entra aqui —
/// senão este teste vira teatro.
/// </para>
///
/// <para>
/// É o mesmo documento que o <c>/scalar</c> renderiza em desenvolvimento. A
/// documentação navegável e o teste leem a mesma fonte, então não há como uma estar
/// certa e a outra errada.
/// </para>
/// </summary>
public class TestesContratoOpenApi(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    /// <summary>
    /// `MapOpenApi()` só roda em Development — e `FabricaApi` sobe assim de propósito.
    /// Em produção o documento não é exposto.
    /// </summary>
    private const string Documento = "/openapi/v1.json";

    /// <summary>
    /// Toda rota que `src/web/src/api.ts` chama. `{id}` é como o OpenAPI nomeia o
    /// parâmetro; o front monta com template string.
    /// </summary>
    public static readonly string[] RotasDoFront =
    [
        "/api/panorama",
        "/api/legislaturas",
        "/api/governo",
        "/api/parlamentares",
        "/api/parlamentares/{id}",
        "/api/parlamentares/{id}/gastos",
        "/api/parlamentares/{id}/emendas",
        "/api/parlamentares/{id}/emendas/favorecidos",
        "/api/parlamentares/{id}/emendas/convenios",
        "/api/parlamentares/{id}/votos",
        "/api/parlamentares/{id}/emendas/lista",
        "/api/parlamentares/{id}/gastos/lancamentos",
        "/api/metodologia",
        "/api/emendas/reconciliacao",
        "/api/procedencia/{contexto}",
        "/api/mapa/emendas",
        "/api/mapa/emendas/{uf}",
        "/api/municipios",
        "/api/municipios/{codigoIbge}/emendas",
        "/api/municipios/{codigoIbge}/emendas/parlamentares",
        "/api/municipios/{codigoIbge}/emendas/favorecidos",
        "/api/municipios/{codigoIbge}/emendas/convenios",
        "/api/entidades",
        "/api/entidades/{cnpj}",
        "/api/entidades/{cnpj}/parlamentares",
        "/api/entidades/{cnpj}/convenios",
        "/api/parlamentares/{id}/patrimonio",
        "/api/busca",
        "/api/parlamentares/{id}/financiamento",
        "/api/afinidade",
        "/api/afinidade/perguntas",
        "/api/afinidade/perguntas/desempate",
        "/api/grafo",
        "/api/seguidos",
        "/api/seguidos/novidades",
        "/api/seguidos/{pessoaId}",
        "/api/seguidos/consentimento",
        "/api/auth/eu",
        "/api/auth/logout",
        "/api/auth/conta",
        "/api/avaliacao",
    ];

    public static TheoryData<string> Rotas()
    {
        var dados = new TheoryData<string>();
        foreach (var rota in RotasDoFront) dados.Add(rota);

        return dados;
    }

    [SkippableTheory]
    [MemberData(nameof(Rotas))]
    public async Task Rota_QueOFrontChama_ExisteNoContrato(string rota)
    {
        ExigeDocker();
        using var documento = await LerDocumentoAsync();

        var caminhos = documento.RootElement.GetProperty("paths");

        Assert.True(
            caminhos.TryGetProperty(rota, out _),
 $"o front chama '{rota}', e ela não está no OpenAPI. "
            + $"Rotas publicadas: {string.Join(", ", caminhos.EnumerateObject().Select(p => p.Name))}");
    }

    /// <summary>
    /// O caso que motivou o teste: o campo existe no C#, o front lê outro nome, e
    /// nada acusa.
    ///
    /// <para>
    /// Os nomes são <b>camelCase</b> — é como o `System.Text.Json` serializa por
    /// padrão, e é o que o front espera. Trocar a política de nomes quebraria tudo de
    /// uma vez, e este teste é quem avisa.
    /// </para>
    /// </summary>
    [SkippableTheory]
    // O painel da página inicial e da tela de login.
    [InlineData("PanoramaDaCasaDto", "casa,parlamentares,votacoes,votacoesSecretas,votosComPosicao,comunidades,ligacoes")]
    // A lista de "explorar" — `casa` entrou quando a lista passou a misturar as duas.
    [InlineData("ParlamentarNaListaDto", "id,nome,casa,partido,uf,nVotacoes,urlFoto")]
    // A lista vem em páginas; `partidos` e `ufs` são as opções dos filtros.
    [InlineData("PaginaDeParlamentaresDto", "itens,pagina,tamanho,total,partidos,ufs")]
    // `acordou`/`discordou` são o "por que este resultado": sem eles o número não é
    // conferível.
    [InlineData("ParlamentarAfimDto", "pessoaId,nome,partido,uf,acordos,comparaveis,acordou,discordou")]
    // `ementa`, `materia` e `categoria` chegaram juntos: sem `categoria` a ementa
    // vira manchete de voto de rito, que é erro de leitura, não de layout.
    [InlineData("VotoNaFichaDto", "votacaoId,data,descricao,valor,orientacaoDoGoverno,ementa,materia,categoria")]
    // Os mandatos na ficha: a legislatura escolhida e as outras em que a pessoa votou.
    [InlineData("FichaParlamentarDto", "id,nome,casa,partido,uf,nVotacoes,maisSimilares,legislatura,mandatos")]
    [InlineData("MandatoDto", "legislatura,casa,anoInicial,partido,uf,nRegistrosDeVoto")]
    // `totalVotos` é comparecimento, nunca o placar (RF-29).
    [InlineData("PerguntaPublicaDto", "id,texto,ordem,totalVotos,totalPossivel")]
    // O envelope do questionário — `total` existe para a barra de progresso.
    [InlineData("QuestionarioDto", "perguntas,total")]
    // `vizinhosPorNo` é o `k` da execução: o tour do grafo explica o desenho com ele.
    [InlineData("GrafoDto", "execucaoId,casa,legislatura,vizinhosPorNo,nos,arestas,legislaturasComGrafo,votacoesDePlenario,secretasDePlenario,abertasDesde,abertasAte")]
    // `governismo` é nulo no Senado inteiro (achado #28), mas a PROPRIEDADE existe.
    [InlineData("NoDoGrafoDto", "id,nome,partido,uf,comunidade,eixoX,eixoY,nVotacoes,componente1,componente2,urlFoto,governismo")]
    [InlineData("ArestaDoGrafoDto", "de,para,peso,votacoesComuns,cosseno")]
    // Quem recebeu, quando e por qual convênio: a aba de emendas da ficha.
    [InlineData("EmendasDoParlamentarDto", "ano,empenhado,pago,quantidade,porDestino,porFuncao,favorecidos,pagamentosPorMes,convenios,cidades")]
    [InlineData("FavorecidosDaEmendaDto", "recebido,viaIntermediario,aPessoas,semIdentificacao,ultimoMes,identificados,maiores")]
    [InlineData("ConvenioDaEmendaDto", "numero,convenente,objeto,dataPublicacao,valor,emendasQueFinanciam")]
    // O perfil do governo: o período, o ano a ano e o sigilo com a base.
    [InlineData("GovernoDto", "gestoes,periodo,geradoEm,emAndamento,anosDisponiveis,arrecadacao,despesa,sigilo,porAno,gestoesDisponiveis")]
    [InlineData("GovernoNoAnoDto", "ano,arrecadou,gastou,pegouEmprestado,fechado")]
    [InlineData("SigiloDto", "cartaoSigiloso,cartaoTotal,transacoesSigilosas,acaoSigilosa,meses,porOrgao")]
    // As cidades pela sede de quem recebeu, e o CNPJ que leva à página da entidade.
    [InlineData("CidadesDaEmendaDto", "quantidade,maiores")]
    [InlineData("FavorecidoDaEmendaDto", "nome,naturezaJuridica,uf,municipio,recebido,cnpj")]
    // PP4 e PP3: redes na ficha, patrimônio por candidatura — não a descrição do bem.
    [InlineData("RedeSocialDto", "rede,url,fonte")]
    [InlineData("DeclaracaoDeBensDto", "anoEleicao,total,bens,porTipo")]
    [InlineData("ConvenioDaEntidadeDto", "numero,objeto,situacao,dataPublicacao,valor,valorLiberado,urlFonte")]
    [InlineData("ArrecadacaoDto", "arrecadado,porOrigem,emissaoDeDivida,outrasReceitasDeCapital")]
    [InlineData("AreaDaDespesaDto", "codigo,nome,dotacaoAtualizada,empenhado,pago,restosAPagarPagos,dotacaoCompleta")]
    [InlineData("EncargoDto", "grupo,pago,restosAPagarPagos")]
    public async Task Dto_TemOsCamposQueOFrontLe(string dto, string campos)
    {
        ExigeDocker();
        using var documento = await LerDocumentoAsync();

        var esquemas = documento.RootElement
            .GetProperty("components")
            .GetProperty("schemas");

        Assert.True(
            esquemas.TryGetProperty(dto, out var esquema),
 $"o esquema '{dto}' não está no OpenAPI — foi renomeado?");

        var publicadas = esquema.GetProperty("properties")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet();

        var faltando = campos.Split(',').Where(c => !publicadas.Contains(c)).ToList();

        Assert.True(
            faltando.Count == 0,
 $"'{dto}' não publica {string.Join(", ", faltando)} — o front lê esses nomes. "
            + $"Publicados: {string.Join(", ", publicadas.Order())}");
    }

    /// <summary>
    /// Enum vai como TEXTO, não como ordinal.
    ///
    /// <para>
    /// O padrão do `System.Text.Json` é o ordinal: sem o `JsonStringEnumConverter`,
    /// <c>"casa": "CAMARA"</c> viraria <c>"casa": 0</c>. O front compara com a string,
    /// nenhuma comparação daria certo, e **não haveria erro em lugar nenhum** — as
    /// listas apareceriam vazias.
    /// </para>
    ///
    /// <para>
    /// A asserção é sobre o <b>tipo JSON de cada valor</b>, não sobre um campo
    /// <c>"type": "string"</c> — o documento sai em <b>OpenAPI 3.1</b>, que não
    /// emite <c>type</c> quando o <c>enum</c> já fixa os valores. Exigir o campo faria
    /// o teste falhar sem que nada estivesse errado.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task Casa_VaiComoTexto_NaoComoNumero()
    {
        ExigeDocker();
        using var documento = await LerDocumentoAsync();

        var casa = documento.RootElement
            .GetProperty("components").GetProperty("schemas")
            // O nome do esquema segue o nome do TIPO em C#. Renomear o enum
            // muda esta chave — mas NÃO muda os valores, que são o que o
            // front compara.
            .GetProperty("TipoCasa");

        var valores = casa.GetProperty("enum").EnumerateArray().ToList();

        // O ordinal apareceria aqui como `Number`, e é ESTE o erro que o teste pega.
        Assert.All(valores, v => Assert.Equal(JsonValueKind.String, v.ValueKind));
        Assert.Equal(["CAMARA", "SENADO"], valores.Select(v => v.GetString()));
    }

    /// <summary>
    /// O documento existe e é JSON válido. Parece óbvio, mas `MapOpenApi()` mora
    /// dentro de um `if (IsDevelopment())` — e o `/scalar` depende dele.
    /// </summary>
    [SkippableFact]
    public async Task Documento_EhServido_EmDesenvolvimento()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync(Documento);

        resposta.EnsureSuccessStatusCode();
        Assert.Contains("json", resposta.Content.Headers.ContentType?.MediaType);
    }

    private async Task<JsonDocument> LerDocumentoAsync()
    {
        using var cliente = CriarCliente();
        var json = await cliente.GetStringAsync(Documento);

        return JsonDocument.Parse(json);
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();
}
