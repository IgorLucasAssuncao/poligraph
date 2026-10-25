using System.Text.Json;
using Poligraph.Api.Services;

namespace Poligraph.Tests;

/// <summary>
/// A regra da disciplina em C# contra os mesmos casos da ETL. As duas implementações vivem
/// separadas; o arquivo de casos é o que as mantém iguais.
/// </summary>
[Trait("Tipo", "Unidade")]
public class TestesBancadaDoPartido
{
    /// <summary>A mesma configuração de leitura para todos os casos: criá-la a cada chamada desperdiça o cache do serializador.</summary>
    private static readonly JsonSerializerOptions LeituraDosCasos = new() { PropertyNameCaseInsensitive = true };

    public static TheoryData<string, string[], string?> Casos()
    {
        var caminho = Path.Combine(Raiz(), "src", "etl", "tests", "congresso", "casos", "bancada_do_partido.json");
        var arquivo = JsonSerializer.Deserialize<ArquivoDeCasos>(
            File.ReadAllText(caminho), LeituraDosCasos)!;

        var dados = new TheoryData<string, string[], string?>();
        foreach (var caso in arquivo.Casos)
        {
            dados.Add(caso.Partido, caso.Bancadas, caso.Esperado);
        }

        return dados;
    }

    [Theory]
    [MemberData(nameof(Casos))]
    public void Achar_DaOMesmoQueAEtl(string partido, string[] bancadas, string? esperado) =>
        Assert.Equal(esperado, BancadaDoPartido.Achar(partido, bancadas));

    /// <summary>O arquivo versionado, e não uma cópia da compilação.</summary>
    private static string Raiz()
    {
        var pasta = new DirectoryInfo(AppContext.BaseDirectory);
        while (pasta is not null && !File.Exists(Path.Combine(pasta.FullName, "Poligraph.slnx")))
        {
            pasta = pasta.Parent;
        }

        return pasta?.FullName
            ?? throw new InvalidOperationException("Poligraph.slnx não encontrado acima de " + AppContext.BaseDirectory);
    }

    private record CasoLido(string Partido, string[] Bancadas, string? Esperado);

    private record ArquivoDeCasos(List<CasoLido> Casos);
}
