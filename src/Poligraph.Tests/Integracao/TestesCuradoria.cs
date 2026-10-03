using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// O carregador de curadoria, com mais de um lote.
///
/// <para>
/// Era um arquivo fixo, <c>perguntas-lote-1.json</c>. Cada casa cura no próprio ritmo, e
/// um arquivo só forçaria editar o mesmo JSON de dois lados — ou privilegiaria a Câmara
/// por ser a que já estava lá.
/// </para>
///
/// <para>
/// O carregador não sabe de qual casa vem cada pergunta, e não precisa: a casa está na
/// votação a que a pergunta se liga. O cidadão nunca escolhe entre Câmara e Senado
/// (RNF-28).
/// </para>
/// </summary>
public class TestesCuradoria(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task DoisLotes_SaoCarregadosJuntos()
    {
        ExigeDocker();
        await SemearVotacoesAsync("CAM-1", "SF-1");

        using var pasta = new PastaDeCuradoria();
        pasta.Gravar("perguntas-lote-1.json", ("q-camara", "CAM-1", 1));
        pasta.Gravar("perguntas-senado-lote-1.json", ("sf-senado", "SF-1", 101));

        var resumo = await CarregadorDePerguntas.CarregarAsync(Db, default);

        Assert.Contains("2 lote(s)", resumo);
        Assert.Equal(2, await Db.Perguntas.CountAsync(p => p.Ativa));
    }

    /// <summary>
    /// Id repetido entre lotes seria a última leitura vencendo em silêncio, e a pergunta
    /// do outro lote sumindo da tela sem explicação nenhuma.
    /// </summary>
    [SkippableFact]
    public async Task IdRepetidoEntreLotes_Estoura()
    {
        ExigeDocker();
        await SemearVotacoesAsync("CAM-1", "SF-1");

        using var pasta = new PastaDeCuradoria();
        pasta.Gravar("perguntas-lote-1.json", ("q-repetida", "CAM-1", 1));
        pasta.Gravar("perguntas-senado-lote-1.json", ("q-repetida", "SF-1", 101));

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CarregadorDePerguntas.CarregarAsync(Db, default));

        Assert.Contains("q-repetida", erro.Message);
    }

    /// <summary>
    /// A pergunta cuja votação ainda não foi ingerida fica de fora e é contada — é caso
    /// normal, não erro: a curadoria pode citar um ano antes de ele ser ingerido.
    /// </summary>
    [SkippableFact]
    public async Task PerguntaSemVotacaoNoBanco_FicaDeForaESaiNoResumo()
    {
        ExigeDocker();
        await SemearVotacoesAsync("CAM-1");

        using var pasta = new PastaDeCuradoria();
        pasta.Gravar("perguntas-lote-1.json",
            ("q-existe", "CAM-1", 1), ("q-nao-existe", "SF-INEXISTENTE", 2));

        var resumo = await CarregadorDePerguntas.CarregarAsync(Db, default);

        Assert.Contains("1 sem a votação no banco", resumo);
        Assert.Equal(1, await Db.Perguntas.CountAsync());
    }

    /// <summary>
    /// PerguntaModel que sai do arquivo é DESATIVADA, não apagada: apagar levaria junto o
    /// histórico de quem já respondeu.
    /// </summary>
    [SkippableFact]
    public async Task PerguntaRemovidaDoLote_EDesativadaENaoApagada()
    {
        ExigeDocker();
        await SemearVotacoesAsync("CAM-1", "SF-1");

        using var pasta = new PastaDeCuradoria();
        pasta.Gravar("perguntas-lote-1.json", ("q-fica", "CAM-1", 1), ("q-sai", "SF-1", 2));
        await CarregadorDePerguntas.CarregarAsync(Db, default);

        pasta.Gravar("perguntas-lote-1.json", ("q-fica", "CAM-1", 1));
        await CarregadorDePerguntas.CarregarAsync(Db, default);

        Db.ChangeTracker.Clear();
        var saiu = await Db.Perguntas.AsNoTracking().SingleAsync(p => p.Id == "q-sai");

        Assert.False(saiu.Ativa);
        Assert.Equal(2, await Db.Perguntas.CountAsync());
    }

    private async Task SemearVotacoesAsync(params string[] ids)
    {
        foreach (var id in ids)
        {
            Db.Votacoes.Add(new VotacaoModel
            {
                Id = id,
                Casa = id.StartsWith("SF-", StringComparison.Ordinal) ? TipoCasa.SENADO : TipoCasa.CAMARA,
                Legislatura = 57,
                Data = new DateOnly(2025, 6, 1),
                Descricao = "Aprovado o Projeto, nos termos do parecer.",
                Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA,
                Plenario = true
            });
        }

        await Db.SaveChangesAsync();
    }

    /// <summary>
    /// O carregador lê de <c>AppContext.BaseDirectory/curadoria</c>, que no teste é a
    /// pasta de saída da compilação. Esta classe troca o conteúdo dela e devolve o
    /// original ao final — sem isso, um teste contaminaria a execução seguinte.
    /// </summary>
    private sealed class PastaDeCuradoria : IDisposable
    {
        private readonly string _pasta =
            Path.Combine(AppContext.BaseDirectory, "curadoria");
        private readonly string _guardados;

        public PastaDeCuradoria()
        {
            _guardados = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
            Directory.CreateDirectory(_pasta);
            Directory.CreateDirectory(_guardados);

            foreach (var arquivo in Directory.GetFiles(_pasta, "perguntas-*.json"))
            {
                File.Move(arquivo, Path.Combine(_guardados, Path.GetFileName(arquivo)));
            }
        }

        public void Gravar(string nome, params (string Id, string VotacaoId, short Ordem)[] perguntas)
        {
            var itens = perguntas.Select(p =>
                $$"""{"id":"{{p.Id}}","votacaoId":"{{p.VotacaoId}}","ordem":{{p.Ordem}},"polaridade":1,"texto":"Texto de {{p.Id}}."}""");

            File.WriteAllText(
                Path.Combine(_pasta, nome),
                $$"""{"perguntas":[{{string.Join(",", itens)}}]}""");
        }

        public void Dispose()
        {
            foreach (var arquivo in Directory.GetFiles(_pasta, "perguntas-*.json"))
            {
                File.Delete(arquivo);
            }

            foreach (var arquivo in Directory.GetFiles(_guardados))
            {
                File.Move(arquivo, Path.Combine(_pasta, Path.GetFileName(arquivo)), true);
            }

            Directory.Delete(_guardados, recursive: true);
        }
    }
}
