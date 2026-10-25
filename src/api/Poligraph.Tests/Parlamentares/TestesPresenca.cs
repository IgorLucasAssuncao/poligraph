using System.Net.Http.Json;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// "Ele vai às votações?" — a participação em plenário, com a base, nas duas casas.
/// </summary>
/// <remarks>
/// <para>
/// Os erros que este número cometeria sem avisar: contar votação de comissão como falta
/// (lá só vota quem é membro), contar na Câmara as votações antes de o deputado assumir, e
/// contar como presença a linha de ausência que o Senado publica. Cada um tem o seu teste.
/// </para>
/// </remarks>
public class TestesPresenca(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    /// <summary>
    /// A base da Câmara são as votações de plenário entre o primeiro e o último voto — a de
    /// comissão e a de antes de assumir ficam fora.
    /// </summary>
    [SkippableFact]
    public async Task Camara_ContaSoPlenarioEntreOPrimeiroEOUltimoVoto()
    {
        ExigeDocker();
        var deputado = await PessoaAsync("Deputada Exemplo");

        Db.Votacoes.AddRange(
            Votacao("C-antes", TipoCasa.CAMARA, new DateOnly(2023, 1, 10), plenario: true),
            Votacao("C-1", TipoCasa.CAMARA, new DateOnly(2023, 3, 1), plenario: true),
            Votacao("C-2", TipoCasa.CAMARA, new DateOnly(2023, 4, 1), plenario: true),
            Votacao("C-comissao", TipoCasa.CAMARA, new DateOnly(2023, 4, 15), plenario: false),
            Votacao("C-3", TipoCasa.CAMARA, new DateOnly(2023, 5, 1), plenario: true));
        Db.Votos.AddRange(
            Voto("C-1", deputado, 1, PresencaNoVoto.PRESENTE),
            Voto("C-comissao", deputado, 1, PresencaNoVoto.PRESENTE),
            Voto("C-3", deputado, null, PresencaNoVoto.PRESENTE));
        await Db.SaveChangesAsync();

        var presenca = (await LerAsync(deputado)).Presenca!;

        Assert.Equal((2, 3, 1), (presenca.Presente, presenca.Votacoes, presenca.Ausente));
        Assert.Null(presenca.AusenteJustificado);
        Assert.False(presenca.JustificativaPublicada);
    }

    /// <summary>
    /// No Senado, a ausência tem linha — e não conta como presença. Licença e missão saem à parte.
    /// </summary>
    [SkippableFact]
    public async Task Senado_SeparaPresenteAusenteEJustificado()
    {
        ExigeDocker();
        var senador = await PessoaAsync("Senador Exemplo");

        Db.Votacoes.AddRange(
            Votacao("S-1", TipoCasa.SENADO, new DateOnly(2023, 3, 1), plenario: true, secreta: true),
            Votacao("S-2", TipoCasa.SENADO, new DateOnly(2023, 4, 1), plenario: true),
            Votacao("S-3", TipoCasa.SENADO, new DateOnly(2023, 5, 1), plenario: true),
            Votacao("S-4", TipoCasa.SENADO, new DateOnly(2023, 6, 1), plenario: true));
        Db.Votos.AddRange(
            Voto("S-1", senador, null, PresencaNoVoto.PRESENTE),
            Voto("S-2", senador, -1, PresencaNoVoto.PRESENTE),
            Voto("S-3", senador, null, PresencaNoVoto.AUSENTE_JUSTIFICADO),
            Voto("S-4", senador, null, PresencaNoVoto.AUSENTE));
        await Db.SaveChangesAsync();

        var presenca = (await LerAsync(senador)).Presenca!;

        Assert.Equal((2, 4, 1, 1), (presenca.Presente, presenca.Votacoes, presenca.Ausente, presenca.AusenteJustificado));
        Assert.True(presenca.JustificativaPublicada);
    }

    /// <summary>RISCO: O banco recusa voto com posição de quem estava ausente.</summary>
    [SkippableFact]
    public async Task VotoComPosicaoDeAusente_ERecusadoPeloBanco()
    {
        ExigeDocker();
        var senador = await PessoaAsync("Senador Exemplo");
        Db.Votacoes.Add(Votacao("S-1", TipoCasa.SENADO, new DateOnly(2023, 3, 1), plenario: true));
        Db.Votos.Add(Voto("S-1", senador, 1, PresencaNoVoto.AUSENTE));

        var erro = await Assert.ThrowsAsync<Microsoft.EntityFrameworkCore.DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_voto_posicao_presente", ((Npgsql.PostgresException)erro.InnerException!).ConstraintName);
    }

    private record PresencaLida(int Presente, int Votacoes, int Ausente, int? AusenteJustificado, bool JustificativaPublicada);

    private record FichaLida(long IdPessoa, PresencaLida? Presenca);

    private async Task<long> PessoaAsync(string nome)
    {
        var pessoa = new PessoaModel { NomeCivil = nome, NomeExibicao = nome };
        Db.Pessoas.Add(pessoa);
        await Db.SaveChangesAsync();
        return pessoa.Id;
    }

    private static VotacaoModel Votacao(string id, TipoCasa casa, DateOnly data, bool plenario, bool secreta = false) => new()
    {
        Id = id, Casa = casa, Legislatura = 57, Data = data, Plenario = plenario, Secreta = secreta, Descricao = "Votação de teste"
    };

    private static VotoModel Voto(string votacao, long pessoa, short? valor, PresencaNoVoto presenca) => new()
    {
        VotacaoId = votacao, PessoaId = pessoa, Valor = valor, Presenca = presenca, PartidoNoVoto = "PARTIDO-A", UfNoVoto = "SP"
    };

    private async Task<FichaLida> LerAsync(long pessoa)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<FichaLida>($"/api/parlamentares/{pessoa}"))!;
    }
}
