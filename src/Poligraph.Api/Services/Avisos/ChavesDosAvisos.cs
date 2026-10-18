using System.Globalization;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Services;

/// <summary>
/// A identidade de cada novidade que vira aviso no navegador (Pendência 89), no formato que o
/// <c>CHECK</c> de <c>avisos_enviados</c> aceita.
/// </summary>
/// <remarks>
/// <para>DECISÃO do autor (2026-10-18): avisam o voto contra o partido (A2), a troca de partido (A3), os gastos da cota (A4) e as emendas pagas (A5). Os votos da semana (A1) ficam só no "O que mudou": há poucas votações nominais, e o aviso diria sempre o mesmo.</para>
/// <para>A4 e A5 têm uma chave por mês, não por parlamentar: o resumo do mês é um aviso só, por mais gente que a pessoa siga.</para>
/// </remarks>
public static class ChavesDosAvisos
{
    /// <summary>As chaves das novidades que avisam, sem repetição.</summary>
    public static IReadOnlyList<string> Das(NovidadesDto novidades)
    {
        var chaves = new List<string>();
        chaves.AddRange(novidades.ContraOPartido.Select(c => DoVotoContraOPartido(c.VotacaoId, c.IdPessoa)));
        chaves.AddRange(novidades.TrocasDePartido.Select(t => DaTrocaDePartido(t.IdPessoa, t.PrimeiroVoto)));
        chaves.AddRange(novidades.GastosNaCota.Select(g => $"A4:{g.AnoDaDespesa:D4}-{g.Mes:D2}"));
        chaves.AddRange(novidades.EmendasPagas.Select(e => $"A5:{e.Mes.Year:D4}-{e.Mes.Month:D2}"));
        return [.. chaves.Distinct()];
    }

    /// <summary>A2: a votação e o parlamentar.</summary>
    public static string DoVotoContraOPartido(string idVotacao, long idPessoa) =>
        string.Create(CultureInfo.InvariantCulture, $"A2:{idVotacao}:{idPessoa}");

    /// <summary>A3: o parlamentar e o dia do primeiro voto pelo partido novo.</summary>
    public static string DaTrocaDePartido(long idPessoa, DateOnly primeiroVoto) =>
        string.Create(CultureInfo.InvariantCulture, $"A3:{idPessoa}:{primeiroVoto:yyyy-MM-dd}");

    /// <summary>Se a chave é do resumo do mês (A4 ou A5), e não de um fato de voto.</summary>
    public static bool DoMes(string chave) => chave.StartsWith("A4:", StringComparison.Ordinal) || chave.StartsWith("A5:", StringComparison.Ordinal);

    /// <summary>Os padrões <c>LIKE</c> das chaves que citam o parlamentar, para apagar quando a pessoa deixa de segui-lo.</summary>
    public static (string DoVoto, string DaTroca) PadroesDoParlamentar(long idPessoa) =>
        (string.Create(CultureInfo.InvariantCulture, $"A2:%:{idPessoa}"), string.Create(CultureInfo.InvariantCulture, $"A3:{idPessoa}:%"));
}
