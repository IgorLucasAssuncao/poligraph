using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Data;

public record PerguntaCurada(
    string Id, string VotacaoId, short Ordem, short Polaridade, string Texto);

/// <summary>
/// Carrega as perguntas curadas do arquivo JSON versionado.
///
/// 🔴 Diferente do <see cref="SemeadorDesenvolvimento"/>: isto é CONTEÚDO, não dado de
/// teste. Roda em todo ambiente, produção incluída — a curadoria é o produto.
///
/// ⚠️ Mas continua fora de <c>HasData()</c>. A lista muda quando a curadoria avança, e
/// conteúdo que muda dentro de migration exige uma migration por revisão.
/// </summary>
public static class CarregadorDePerguntas
{
    private const string Pasta = "curadoria";

    /// <summary>
    /// Todo <c>perguntas-*.json</c> da pasta, em ordem de nome.
    ///
    /// <para>
    /// Era um arquivo fixo. Cada casa cura no próprio ritmo, e um arquivo só forçaria a
    /// editar o mesmo JSON de dois lados — ou, pior, privilegiaria a Câmara por ser a
    /// que já estava lá.
    /// </para>
    ///
    /// <para>
    /// O carregador não sabe de qual casa vem cada pergunta, e não precisa: a casa está
    /// na votação a que a pergunta se liga. O embaralhamento é do servidor, e o cidadão
    /// nunca escolhe entre Câmara e Senado (RNF-28).
    /// </para>
    /// </summary>
    public static async Task<string> CarregarAsync(
        PoligraphDb db, CancellationToken ct = default)
    {
        var pasta = Path.Combine(AppContext.BaseDirectory, Pasta);
        if (!Directory.Exists(pasta))
            return $"curadoria NÃO carregada: {Pasta} não encontrada.";

        var lotes = Directory.GetFiles(pasta, "perguntas-*.json").OrderBy(a => a).ToList();
        if (lotes.Count == 0)
            return $"curadoria NÃO carregada: nenhum perguntas-*.json em {Pasta}.";

        // Id repetido entre lotes seria a última leitura vencendo em silêncio, e a
        // pergunta do outro lote sumindo da tela sem explicação.
        var curadas = new List<PerguntaCurada>();
        var vistos = new HashSet<string>();
        foreach (var lote in lotes)
        {
            foreach (var curada in Ler(lote))
            {
                if (!vistos.Add(curada.Id))
                    throw new InvalidOperationException(
                        $"pergunta '{curada.Id}' aparece em mais de um lote de curadoria.");

                curadas.Add(curada);
            }
        }

        if (curadas.Count == 0) return "curadoria vazia: nenhuma pergunta nos lotes.";

        // ⚠️ PerguntaModel sem a votação no banco viraria violação de chave estrangeira. É
        //    caso NORMAL, não erro: a curadoria pode citar 2023 antes de 2023 ser
        //    ingerido. Fica de fora e o número aparece no log.
        var votacoes = curadas.Select(p => p.VotacaoId).ToList();
        var existentes = await db.Votacoes.AsNoTracking()
            .Where(v => votacoes.Contains(v.Id))
            .Select(v => v.Id)
            .ToHashSetAsync(ct);

        var aplicaveis = curadas.Where(p => existentes.Contains(p.VotacaoId)).ToList();
        var semVotacao = curadas.Count - aplicaveis.Count;

        var novas = await AplicarAsync(db, aplicaveis, ct);

        var resumo =
            $"curadoria: {aplicaveis.Count} perguntas ativas ({novas} novas) "
            + $"de {lotes.Count} lote(s)";

        return semVotacao == 0
            ? resumo + "."
            : resumo + $"; {semVotacao} sem a votação no banco — ingira os anos que faltam.";
    }

    // ═══════════════════════════════════════════════════════════════

    private static List<PerguntaCurada> Ler(string caminho)
    {
        using var fluxo = File.OpenRead(caminho);
        var arquivo = JsonSerializer.Deserialize<ArquivoDeCuradoria>(fluxo, Opcoes);

        return arquivo?.Perguntas ?? [];
    }

    private static readonly JsonSerializerOptions Opcoes = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    /// <summary>
    /// ⭐ Idempotente: reescrever o texto de uma pergunta e recarregar atualiza, não
    /// duplica. A curadoria é iterativa por natureza.
    ///
    /// 🔴 Perguntas fora do arquivo são DESATIVADAS, não apagadas. Apagar levaria junto
    /// o histórico de quem já respondeu; desativar tira da tela e preserva o registro.
    /// </summary>
    private static async Task<int> AplicarAsync(
        PoligraphDb db, List<PerguntaCurada> curadas, CancellationToken ct)
    {
        var ids = curadas.Select(p => p.Id).ToList();
        var existentes = await db.Perguntas.ToDictionaryAsync(p => p.Id, ct);
        var novas = 0;

        foreach (var curada in curadas)
        {
            if (existentes.TryGetValue(curada.Id, out var pergunta))
            {
                pergunta.Texto = curada.Texto;
                pergunta.VotacaoId = curada.VotacaoId;
                pergunta.Ordem = curada.Ordem;
                pergunta.Polaridade = curada.Polaridade;
                pergunta.Ativa = true;
                continue;
            }

            db.Perguntas.Add(new PerguntaModel
            {
                Id = curada.Id,
                VotacaoId = curada.VotacaoId,
                Ordem = curada.Ordem,
                Polaridade = curada.Polaridade,
                Texto = curada.Texto,
                Ativa = true
            });
            novas++;
        }

        foreach (var (id, pergunta) in existentes)
        {
            if (!ids.Contains(id)) pergunta.Ativa = false;
        }

        await db.SaveChangesAsync(ct);

        return novas;
    }

    private sealed record ArquivoDeCuradoria(
        [property: JsonPropertyName("perguntas")] List<PerguntaCurada> Perguntas);
}
