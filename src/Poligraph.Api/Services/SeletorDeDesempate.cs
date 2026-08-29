namespace Poligraph.Api.Services;

/// <summary>
/// Escolhe as próximas perguntas para separar quem está empatado no topo.
///
/// <para>
/// 📐 <b>Por que existe.</b> Medido em 2026-08-29, com cada deputado no papel de
/// cidadão e 15 perguntas da Câmara respondidas:
/// </para>
///
/// <code>
///   estratégia                             | empate mediano | sozinho no topo
///   as 15 melhores, fixas                  |             14 |            4,5%
///   8 fixas + 7 escolhidas aqui            |              6 |           13,4%
///   8 fixas + 7 sorteadas                  |             16 |           10,4%
/// </code>
///
/// <para>
/// ⭐ Sortear ⛔ não ajuda — fica igual a não adaptar. O ganho vem de escolher contra o
/// empate DESTE cidadão.
/// </para>
///
/// <para>
/// ⚠️ Escolhe as <b>N de uma vez</b>, ⛔ não uma por vez. Uma por vez daria empate 5 em
/// vez de 6, ao custo de sete idas e voltas ao servidor no meio do questionário.
/// </para>
/// </summary>
public static class SeletorDeDesempate
{
    /// <summary>
    /// As perguntas que mais separam os empatados, em ordem de valor.
    ///
    /// <para>
    /// 🔴 A conta é <b>pares de empatados que a pergunta separa</b>. Dentro de um grupo
    /// em que todos responderam igual até aqui, uma pergunta em que <c>s</c> votaram a
    /// favor e <c>n</c> contra separa exatamente <c>s × n</c> pares — ⛔ não é preciso
    /// enumerar par nenhum, o que manteria a conta quadrática no tamanho do empate.
    /// </para>
    ///
    /// <para>
    /// A cada escolha o grupo se parte em três: quem se posicionou a favor, quem se
    /// posicionou contra, e quem ⛔ não votou naquela votação. ⭐ Os ausentes ficam num
    /// pedaço próprio porque a pergunta ⛔ não os separa de ninguém — tratá-los como um
    /// dos lados inventaria uma separação que o dado ⛔ não tem.
    /// </para>
    /// </summary>
    /// <param name="empatados">Quem está empatado no topo depois das respostas de base.</param>
    /// <param name="candidatas">
    /// Pergunta → posição efetiva de cada parlamentar (+1/−1, já corrigida pela
    /// polaridade). Quem ⛔ não votou, ou se absteve, fica fora do dicionário.
    /// </param>
    public static List<string> Escolher(
        IReadOnlyCollection<long> empatados,
        IReadOnlyDictionary<string, IReadOnlyDictionary<long, short>> candidatas,
        int quantidade)
    {
        if (quantidade <= 0 || candidatas.Count == 0) return [];

        // Sem empate a resolver, a ordem de cobertura geral é a melhor aposta que existe
        // — e é justamente a ordem em que as candidatas chegam.
        if (empatados.Count < 2) return candidatas.Keys.Take(quantidade).ToList();

        // ⚠️ Uma célula só, com todo mundo: ninguém foi separado ainda.
        List<List<long>> celulas = [[.. empatados]];
        var restantes = new HashSet<string>(candidatas.Keys);
        var escolhidas = new List<string>(quantidade);

        while (escolhidas.Count < quantidade && restantes.Count > 0)
        {
            var melhor = restantes
                .OrderByDescending(id => ParesSeparados(celulas, candidatas[id]))
                // ⚠️ Desempate estável: sem ele, dois candidatos de valor igual sairiam
                //    em ordem de hash, e a mesma requisição daria listas diferentes.
                .ThenBy(id => id, StringComparer.Ordinal)
                .First();

            escolhidas.Add(melhor);
            restantes.Remove(melhor);

            // Valor zero significa que nenhuma candidata separa mais ninguém. As que
            // faltam entram na ordem de cobertura geral, que é o critério de origem.
            if (ParesSeparados(celulas, candidatas[melhor]) == 0)
            {
                escolhidas.AddRange(restantes.Take(quantidade - escolhidas.Count));
                break;
            }

            celulas = Repartir(celulas, candidatas[melhor]);
        }

        return escolhidas;
    }

    // ═══════════════════════════════════════════════════════════════

    private static long ParesSeparados(
        List<List<long>> celulas, IReadOnlyDictionary<long, short> posicoes)
    {
        long total = 0;

        foreach (var celula in celulas)
        {
            long favor = 0, contra = 0;
            foreach (var pessoaId in celula)
            {
                if (!posicoes.TryGetValue(pessoaId, out var posicao)) continue;
                if (posicao > 0) favor++;
                else if (posicao < 0) contra++;
            }

            total += favor * contra;
        }

        return total;
    }

    private static List<List<long>> Repartir(
        List<List<long>> celulas, IReadOnlyDictionary<long, short> posicoes)
    {
        var novas = new List<List<long>>();

        foreach (var celula in celulas)
        {
            List<long> favor = [], contra = [], ausentes = [];

            foreach (var pessoaId in celula)
            {
                if (!posicoes.TryGetValue(pessoaId, out var posicao)) ausentes.Add(pessoaId);
                else if (posicao > 0) favor.Add(pessoaId);
                else if (posicao < 0) contra.Add(pessoaId);
                else ausentes.Add(pessoaId);
            }

            // ⭐ Célula de uma pessoa só já está resolvida: ela ⛔ não forma par com
            //    ninguém, e carregá-la adiante só custaria varredura.
            foreach (var pedaco in (List<long>[])[favor, contra, ausentes])
            {
                if (pedaco.Count > 1) novas.Add(pedaco);
            }
        }

        return novas;
    }
}
