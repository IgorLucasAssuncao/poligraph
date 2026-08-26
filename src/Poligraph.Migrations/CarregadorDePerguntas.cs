using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Migrations;

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
    private const string Arquivo = "curadoria/perguntas-lote-1.json";

    public static async Task<string> CarregarAsync(
        PoligraphDb db, CancellationToken ct = default)
    {
        var caminho = Path.Combine(AppContext.BaseDirectory, Arquivo);
        if (!File.Exists(caminho))
            return $"curadoria NÃO carregada: {Arquivo} não encontrado.";

        var curadas = Ler(caminho);
        if (curadas.Count == 0) return "curadoria vazia: nenhuma pergunta no arquivo.";

        // ⚠️ Pergunta sem a votação no banco viraria violação de chave estrangeira. É
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

        var resumo = $"curadoria: {aplicaveis.Count} perguntas ativas ({novas} novas)";

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

            db.Perguntas.Add(new Pergunta
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
