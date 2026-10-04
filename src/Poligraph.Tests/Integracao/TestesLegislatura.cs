using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// **Pendência 35 — a segunda legislatura NÃO pode vazar.**
///
/// Todo teste desta suíte semeia **uma** legislatura, então o filtro poderia sumir num
/// refactor e tudo continuaria verde. Estes testes são os únicos que semeiam **duas**, e
/// existem exatamente para isso.
///
/// O sintoma que eles impedem não é uma exceção: é o painel do questionário mostrar
/// *"480 de 900"*, contando deputados de uma legislatura que nunca votou aquelas
/// votações. Número plausível, tela intacta — o mesmo formato do bug de polaridade.
///
/// E tem data: a 57ª termina em **janeiro de 2027**.
/// </summary>
public class TestesLegislatura(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const short Corrente = 57;
    private const short Seguinte = 58;

    [SkippableFact]
    public async Task Denominador_DoPainel_NaoContaOutraLegislatura()
    {
        ExigeDocker();
        await SemearAsync();

        var antes = await TotalPossivelAsync();

        await SemearOutraLegislaturaAsync();

        var depois = await TotalPossivelAsync();

        Assert.Equal(antes, depois);
    }

    [SkippableFact]
    public async Task Explorar_NaoListaParlamentarDaOutraLegislatura()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearOutraLegislaturaAsync();

        using var cliente = CriarCliente();
        var lista = (await cliente.GetFromJsonAsync<PaginaLida>("/api/parlamentares"))?.Itens;

        Assert.NotNull(lista);

        Assert.All(lista!, p => Assert.StartsWith("Novo ", p.Nome));
        Assert.Equal(2, lista!.Count);
    }

    [SkippableFact]
    public async Task NVotacoes_NaoSomaMandatosDiferentes()
    {
        ExigeDocker();
        await SemearAsync();

        var reeleito = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).FirstAsync();
        var naPrimeira = await Db.Votos
            .CountAsync(v => v.PessoaId == reeleito.Id && v.Valor != null);

        Assert.True(naPrimeira > 0, "o seed precisa dar votos a ele, senão o teste não mede nada");

        await SemearOutraLegislaturaAsync(reeleitoId: reeleito.Id);

        using var cliente = CriarCliente();
        var ficha = await cliente.GetFromJsonAsync<FichaLida>($"/api/parlamentares/{reeleito.Id}");

        Assert.Equal(1, ficha!.NVotacoes);
    }

    [SkippableFact]
    public async Task LegislaturaCorrente_EhAMaiorQueExisteEmVotacoes()
    {
        ExigeDocker();
        await SemearAsync();

        Assert.Equal(Corrente, await Legislaturas.CorrenteAsync(Db, default));

        await SemearOutraLegislaturaAsync();

        Assert.Equal(Seguinte, await Legislaturas.CorrenteAsync(Db, default));
    }

    [SkippableFact]
    public async Task BaseSemVotacao_NaoInventaLegislatura()
    {
        ExigeDocker();

        Assert.Null(await Legislaturas.CorrenteAsync(Db, default));
    }

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task<int> TotalPossivelAsync()
    {
        using var cliente = CriarCliente();
        var questionario = await cliente.GetFromJsonAsync<QuestionarioLido>(
            "/api/afinidade/perguntas");

        Assert.NotEmpty(questionario!.Perguntas);

        return questionario.Perguntas[0].TotalPossivel;
    }

    /// <summary>
    /// A 58ª legislatura: duas pessoas novas, uma votação, e nenhuma pergunta.
    ///
    /// É de propósito que não há pergunta nova: na virada real, o pool curado
    /// continua sendo o da legislatura anterior por um tempo. É justamente aí que o
    /// denominador erraria.
    /// </summary>
    private async Task SemearOutraLegislaturaAsync(long? reeleitoId = null)
    {
        var votacao = new VotacaoModel
        {
            Id = "9999999-1",
            Casa = TipoCasa.CAMARA,
            Legislatura = Seguinte,
            Data = new DateOnly(2027, 3, 10),
            Descricao = "Votação da legislatura seguinte",
            Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA,
            Plenario = true
        };
        Db.Votacoes.Add(votacao);

        var novos = new List<PessoaModel>
        {
            new() { NomeExibicao = "Novo Um", NomeCivil = "NOVO UM" },
            new() { NomeExibicao = "Novo Dois", NomeCivil = "NOVO DOIS" }
        };
        Db.Pessoas.AddRange(novos);
        await Db.SaveChangesAsync();

        foreach (var pessoa in novos)
        {
            Db.Votos.Add(new VotoModel
            {
                VotacaoId = votacao.Id, PessoaId = pessoa.Id, Valor = 1,
                PartidoNoVoto = "PARTIDO-Z", UfNoVoto = "DF"
            });
        }

        if (reeleitoId is not null)
        {
            Db.Votos.Add(new VotoModel
            {
                VotacaoId = votacao.Id, PessoaId = reeleitoId.Value, Valor = 1,
                PartidoNoVoto = "PARTIDO-Z", UfNoVoto = "DF"
            });
        }

        await Db.SaveChangesAsync();
    }

    private record ParlamentarLido(long IdPessoa, string Nome, string Partido, string Uf, int NVotacoes);

    private record PaginaLida(List<ParlamentarLido> Itens, int Total);

    private record FichaLida(long IdPessoa, string Nome, int NVotacoes);

    private record PerguntaLida(string IdPergunta, string Texto, short Ordem, int TotalVotos, int TotalPossivel);

    private record QuestionarioLido(List<PerguntaLida> Perguntas, int Total);
}
