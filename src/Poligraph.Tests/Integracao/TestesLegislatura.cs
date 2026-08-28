using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// 🔴 **PL35 — a segunda legislatura ⛔ NÃO pode vazar.**
///
/// ⚠️ Todo teste desta suíte semeia **uma** legislatura, então o filtro poderia sumir num
/// refactor e tudo continuaria verde. Estes testes são os únicos que semeiam **duas**, e
/// existem exatamente para isso.
///
/// ⭐ O sintoma que eles impedem ⛔ não é uma exceção: é o painel do questionário mostrar
/// *"480 de 900"*, contando deputados de uma legislatura que nunca votou aquelas
/// votações. Número plausível, tela intacta — o mesmo formato do bug de polaridade.
///
/// ⏳ E tem data: a 57ª termina em **janeiro de 2027**.
/// </summary>
public class TestesLegislatura : BaseIntegracao
{
    private const short Corrente = 57;
    private const short Seguinte = 58;

    [SkippableFact]
    public async Task Denominador_DoPainel_NaoContaOutraLegislatura()
    {
        ExigeDocker();
        await SemearAsync();

        var antes = await TotalPossivelAsync();

        // ⭐ Chega a 58ª: gente nova, votações novas, ⛔ nenhuma pergunta nova.
        await SemearOutraLegislaturaAsync();

        var depois = await TotalPossivelAsync();

        // 🔴 As perguntas ativas continuam sendo da 57ª, então o denominador ⛔ NÃO muda.
        Assert.Equal(antes, depois);
    }

    [SkippableFact]
    public async Task Explorar_NaoListaParlamentarDaOutraLegislatura()
    {
        ExigeDocker();
        await SemearAsync();
        await SemearOutraLegislaturaAsync();

        using var cliente = CriarCliente();
        var lista = await cliente.GetFromJsonAsync<List<ParlamentarLido>>("/api/parlamentares");

        Assert.NotNull(lista);

        // 🔴 A legislatura CORRENTE virou a 58ª — quem só votou na 57ª saiu da lista.
        //
        // ⚠️ Sem o filtro, os 12 da 57ª e os 2 da 58ª apareceriam juntos, e nada na
        //    tela diria que metade já não está mais lá.
        Assert.All(lista!, p => Assert.StartsWith("Novo ", p.Nome));
        Assert.Equal(2, lista!.Count);
    }

    [SkippableFact]
    public async Task NVotacoes_NaoSomaMandatosDiferentes()
    {
        ExigeDocker();
        await SemearAsync();

        // ⭐ O MESMO parlamentar reeleito: vota na 57ª e na 58ª.
        var reeleito = await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).FirstAsync();
        var naPrimeira = await Db.Votos
            .CountAsync(v => v.PessoaId == reeleito.Id && v.Valor != null);

        Assert.True(naPrimeira > 0, "o seed precisa dar votos a ele, senão o teste não mede nada");

        await SemearOutraLegislaturaAsync(reeleitoId: reeleito.Id);

        using var cliente = CriarCliente();
        var ficha = await cliente.GetFromJsonAsync<FichaLida>($"/api/parlamentares/{reeleito.Id}");

        // 🔴 Só o mandato corrente. Somar os dois inflaria a ficha sem erro nenhum.
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

        // ⚠️ ⛔ Sem seed. Devolver 57 aqui esconderia uma base vazia atrás de um número
        //    que parece certo — e o primeiro ETL que falhasse passaria despercebido.
        Assert.Null(await Legislaturas.CorrenteAsync(Db, default));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task<int> TotalPossivelAsync()
    {
        using var cliente = CriarCliente();
        var perguntas = await cliente.GetFromJsonAsync<List<PerguntaLida>>(
            "/api/afinidade/perguntas");

        Assert.NotEmpty(perguntas!);

        return perguntas![0].TotalPossivel;
    }

    /// <summary>
    /// A 58ª legislatura: duas pessoas novas, uma votação, e ⛔ nenhuma pergunta.
    ///
    /// ⚠️ É de propósito que ⛔ não há pergunta nova: na virada real, o pool curado
    /// continua sendo o da legislatura anterior por um tempo. É justamente aí que o
    /// denominador erraria.
    /// </summary>
    private async Task SemearOutraLegislaturaAsync(long? reeleitoId = null)
    {
        var votacao = new VotacaoModel
        {
            Id = "9999999-1",
            Casa = Casa.CAMARA,
            Legislatura = Seguinte,
            Data = new DateOnly(2027, 3, 10),
            Descricao = "Votação da legislatura seguinte",
            Categoria = CategoriaDeVotacao.SUBSTANTIVA,
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

    private record ParlamentarLido(long Id, string Nome, string Partido, string Uf, int NVotacoes);

    private record FichaLida(long Id, string Nome, int NVotacoes);

    private record PerguntaLida(string Id, string Texto, short Ordem, int TotalVotos, int TotalPossivel);
}
