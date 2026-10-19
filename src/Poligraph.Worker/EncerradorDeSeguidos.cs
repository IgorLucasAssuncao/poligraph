using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Worker;

/// <summary>
/// Tira da lista de seguidos quem deixou o mandato, pela lista oficial de cada casa
/// (<c>em_exercicio</c>), e guarda o aviso para a pessoa ver no site.
/// </summary>
/// <remarks>
/// <para>DECISÃO do autor (2026-10-18): na virada de legislatura, e também em renúncia, cassação ou licença, quem não está mais em exercício sai da lista de seguidos, e a pessoa é avisada no site. Roda no começo da distribuição de cada evento da rotina, antes dos avisos: ninguém recebe aviso sobre quem acabou de sair.</para>
/// <para>RISCO: sem a lista oficial carregada nas duas casas (<see cref="EmExercicioNaBase.IdsAsync"/> nulo), não faz nada. Uma lista vazia tiraria todo mundo da lista de seguidos de todos.</para>
/// <para>Saem junto as chaves de aviso sobre a pessoa, como ao deixar de seguir à mão: a lista não pode guardar que se seguia alguém.</para>
/// </remarks>
public class EncerradorDeSeguidos(PoligraphDb db, ILogger<EncerradorDeSeguidos> log)
{
    private readonly PoligraphDb _db = db;
    private readonly ILogger<EncerradorDeSeguidos> _log = log;

    /// <summary>Quantas linhas de seguir foram encerradas. Precisa de transação aberta por quem chama.</summary>
    public async Task<int> EncerrarAsync(CancellationToken ct)
    {
        if (await EmExercicioNaBase.IdsAsync(_db, ct) is null)
        {
            _log.LogWarning("Lista oficial de quem está em exercício ausente ou curta: nenhum seguido foi encerrado.");
            return 0;
        }

        await _db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO seguidos_encerrados (usuario_id, pessoa_id)
            SELECT s.usuario_id, s.pessoa_id FROM segue s
            WHERE NOT EXISTS (SELECT 1 FROM em_exercicio e WHERE e.pessoa_id = s.pessoa_id)
            ON CONFLICT DO NOTHING
            """, ct);

        await _db.Database.ExecuteSqlAsync(
            $"""
            DELETE FROM avisos_enviados a USING segue s
            WHERE a.usuario_id = s.usuario_id
              AND NOT EXISTS (SELECT 1 FROM em_exercicio e WHERE e.pessoa_id = s.pessoa_id)
              AND (a.chave LIKE 'A2:%:' || s.pessoa_id OR a.chave LIKE 'A3:' || s.pessoa_id || ':%')
            """, ct);

        var encerrados = await _db.Database.ExecuteSqlAsync(
            $"""
            DELETE FROM segue s
            WHERE NOT EXISTS (SELECT 1 FROM em_exercicio e WHERE e.pessoa_id = s.pessoa_id)
            """, ct);

        if (encerrados > 0 && _log.IsEnabled(LogLevel.Information))
        {
            _log.LogInformation("{Encerrados} seguido(s) encerrado(s): o parlamentar não está mais em exercício.", encerrados);
        }
        return encerrados;
    }
}
