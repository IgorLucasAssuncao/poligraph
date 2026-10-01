using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// RF-33 — o grafo da execução mais recente da casa.
///
/// Devolve TUDO de uma vez, e isso é decisão consciente: 644 nós e ~6.400 arestas
/// cabem em poucos MB, e o layout <i>force-directed</i> precisa do grafo inteiro para
/// posicionar. Paginar aqui quebraria a visualização.
/// </summary>
public class ServicoGrafo(PoligraphDb db)
{
    private readonly PoligraphDb _db = db;

    /// <remarks>
    /// <para>Primeiro dia, antes de o ETL analítico rodar: grafo vazio, não erro.</para>
    /// </remarks>
    public async Task<GrafoDto> ObterAsync(TipoCasa casa, CancellationToken ct)
    {
        var execucao = await _db.Execucoes.AsNoTracking()
            .Where(e => e.Casa == casa && e.Status == TipoStatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => new { e.Id, e.Casa, e.Legislatura, e.K })
            .FirstOrDefaultAsync(ct);

        if (execucao is null) return new GrafoDto(0, casa, 0, 0, [], []);

        return new GrafoDto(
            execucao.Id, execucao.Casa, execucao.Legislatura, execucao.K,
            await NosAsync(execucao.Id, ct),
            await ArestasAsync(execucao.Id, ct));
    }

    private async Task<List<NoDoGrafoDto>> NosAsync(long execucaoId, CancellationToken ct)
    {
        var metricas = await _db.NosMetrica.AsNoTracking()
            .Where(n => n.ExecucaoId == execucaoId)
            .ToListAsync(ct);

        var ids = metricas.Select(m => m.PessoaId).ToList();

        var pessoas = await _db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                p.UrlFoto,
                Ultimo = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(p => p.Id, ct);

        return [.. metricas.Select(m =>
        {
            var pessoa = pessoas.GetValueOrDefault(m.PessoaId);
            return new NoDoGrafoDto(
                m.PessoaId,
                pessoa?.NomeExibicao ?? "",
                pessoa?.Ultimo?.PartidoNoVoto ?? "",
                pessoa?.Ultimo?.UfNoVoto ?? "",
                m.Comunidade, m.EixoX, m.EixoY, m.NVotacoes,
                m.Componente1, m.Componente2, pessoa?.UrlFoto, m.Governismo);
        })];
    }

    /// <summary>
    /// Só arestas de <c>SIMILARIDADE_VOTO</c>.
    ///
    /// Os três tipos são CAMADAS de naturezas diferentes — comissão comum mede
    /// convivência, coautoria mede colaboração. Misturá-las num grafo só produziria
    /// um desenho sem interpretação.
    /// </summary>
    /// <remarks>
    /// <para>A base e o cosseno vivem em `similaridades`, não em `arestas_grafo`. A junção acontece no banco: `similaridades` tem 185.908 linhas por métrica nesta execução, e trazê-las para a memória para casar aqui seria ler 370 mil linhas a cada abertura da tela.</para>
    /// <para>`DefaultIfEmpty` porque o par sem linha de similaridade é bug, e o zero aparece na tela como "0 votações" em vez de derrubar a requisição inteira.</para>
    /// </remarks>
    private async Task<List<ArestaDoGrafoDto>> ArestasAsync(long execucaoId, CancellationToken ct)
    {
        var arestas =
            from a in _db.ArestasGrafo.AsNoTracking()
            where a.ExecucaoId == execucaoId && a.Tipo == TipoDeAresta.SIMILARIDADE_VOTO

            join concordancia in _db.Similaridades.AsNoTracking()
                    .Where(s => s.Metrica == TipoMetrica.CONCORDANCIA)
                on new { a.ExecucaoId, a.PessoaA, a.PessoaB }
                equals new { concordancia.ExecucaoId, concordancia.PessoaA, concordancia.PessoaB }
                into porConcordancia
            from base_ in porConcordancia.DefaultIfEmpty()

            join cosseno in _db.Similaridades.AsNoTracking()
                    .Where(s => s.Metrica == TipoMetrica.COSSENO)
                on new { a.ExecucaoId, a.PessoaA, a.PessoaB }
                equals new { cosseno.ExecucaoId, cosseno.PessoaA, cosseno.PessoaB }
                into porCosseno
            from outra in porCosseno.DefaultIfEmpty()

            select new ArestaDoGrafoDto(
                a.PessoaA, a.PessoaB, a.Peso,
                base_ == null ? 0 : base_.NVotacoesComuns,
                outra == null ? null : outra.Valor);

        return await arestas.ToListAsync(ct);
    }
}
