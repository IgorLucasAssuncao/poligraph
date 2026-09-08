using System.Text.RegularExpressions;
using System.Text.Json;
using Poligraph.Data;

namespace Poligraph.Tests.Unidade;

/// <summary>
/// Os arquivos de curadoria que o produto realmente distribui.
///
/// <para>
/// <see cref="Integracao.TestesCuradoria"/> exercita o CARREGADOR com arquivos
/// inventados. Aqui é o oposto: o carregador não interessa, o conteúdo sim. Curadoria é
/// escrita à mão, e um <c>ordem</c> repetido ou um <c>votacaoId</c> com um dígito
/// trocado não estoura em lugar nenhum — vira pergunta que some da tela, ou some do
/// banco por chave estrangeira, com o log dizendo apenas "1 sem a votação".
/// </para>
///
/// <para>
/// A polaridade é o campo mais perigoso do sistema. Estes testes não conseguem
/// conferir se ela está certa — isso é leitura humana da descrição da votação. O que dá
/// para travar é a forma: que exista, e que seja +1 ou −1.
/// </para>
/// </summary>
public partial class TestesArquivosDeCuradoria
{
    [Fact]
    public void TodoLote_TemPerguntas()
    {
        Assert.NotEmpty(Lotes);

        foreach (var (nome, perguntas) in Lotes) Assert.NotEmpty(perguntas);
    }

    /// <summary>
    /// O carregador já estoura com id repetido, e o teste dele prova isso. Este pega o
    /// mesmo defeito antes: no arquivo, sem precisar de Docker nem de banco.
    /// </summary>
    [Fact]
    public void NenhumId_SeRepete()
    {
        var repetidos = Todas
            .GroupBy(p => p.Id)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        Assert.Empty(repetidos);
    }

    /// <summary>
    /// <c>ordem</c> repetida não estoura: o banco aceita, e o
    /// <c>OrderBy(p =&gt; p.Ordem)</c> do endpoint desempata por conta própria, mudando
    /// a sequência das perguntas a cada consulta. É o tipo de defeito que aparece como
    /// "a ordem mudou sozinha" e ninguém liga ao arquivo.
    /// </summary>
    [Fact]
    public void NenhumaOrdem_SeRepete()
    {
        var repetidas = Todas
            .GroupBy(p => p.Ordem)
            .Where(g => g.Count() > 1)
            .Select(g => $"ordem {g.Key}: {string.Join(", ", g.Select(p => p.Id))}");

        Assert.Empty(repetidas);
    }

    [Fact]
    public void TodaPolaridade_EhMaisUmOuMenosUm()
    {
        var fora = Todas.Where(p => p.Polaridade is not (1 or -1)).Select(p => p.Id);

        Assert.Empty(fora);
    }

    /// <summary>
    /// RNF-29 proíbe jargão: a afirmação é reescrita a partir da ementa, e o cidadão
    /// responde concordando ou discordando dela. Texto vazio ou que ainda carrega o
    /// número do projeto não foi reescrito.
    /// </summary>
    [Fact]
    public void TodoTexto_EhAfirmacaoEmLinguagemSimples()
    {
        foreach (var pergunta in Todas)
        {
            Assert.False(string.IsNullOrWhiteSpace(pergunta.Texto), pergunta.Id);
            Assert.EndsWith(".", pergunta.Texto);
            Assert.DoesNotContain("Projeto de Lei", pergunta.Texto);
            Assert.DoesNotContain("Substitutivo", pergunta.Texto);
            Assert.DoesNotContain("nº", pergunta.Texto);
        }
    }

    /// <summary>
    /// O id vai para o banco e para o corpo da requisição de afinidade. Espaço ou
    /// maiúscula ali vira diferença silenciosa entre o que o front manda e o que o banco
    /// tem.
    /// </summary>
    [Fact]
    public void TodoId_EhKebabCase()
    {
        var fora = Todas
            .Where(p => !KebabCase().IsMatch(p.Id))
            .Select(p => p.Id);

        Assert.Empty(fora);
    }

    private static IEnumerable<PerguntaCurada> Todas => Lotes.SelectMany(l => l.Perguntas);

    private static readonly List<(string Nome, List<PerguntaCurada> Perguntas)> Lotes = Ler();

    private static List<(string, List<PerguntaCurada>)> Ler()
    {
        var opcoes = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        return Directory
            .GetFiles(Path.Combine(Raiz, "src", "Poligraph.Data", "curadoria"),
                      "perguntas-*.json")
            .OrderBy(a => a)
            .Select(arquivo => (
                Path.GetFileName(arquivo),
                JsonSerializer.Deserialize<ArquivoLido>(File.ReadAllText(arquivo), opcoes)!.Perguntas))
            .ToList();
    }

    /// <summary>
    /// Não dá para usar <c>AppContext.BaseDirectory/curadoria</c>: aquela pasta é a
    /// cópia da compilação, e <see cref="Integracao.TestesCuradoria"/> troca o conteúdo
    /// dela durante a execução. Estes testes leem o arquivo VERSIONADO.
    /// </summary>
    private static string Raiz => _raiz ??= Subir(AppContext.BaseDirectory);

    private static string? _raiz;

    private static string Subir(string caminho)
    {
        var pasta = new DirectoryInfo(caminho);
        while (pasta is not null && !File.Exists(Path.Combine(pasta.FullName, "Poligraph.slnx")))
        {
            pasta = pasta.Parent;
        }

        return pasta?.FullName
            ?? throw new InvalidOperationException("Poligraph.slnx não encontrado acima de " + caminho);
    }

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex KebabCase();

    private sealed record ArquivoLido(List<PerguntaCurada> Perguntas);
}
