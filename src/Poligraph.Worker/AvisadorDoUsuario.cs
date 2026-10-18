using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Services;
using Poligraph.Api.Textos;
using Poligraph.Data;

namespace Poligraph.Worker;

/// <summary>
/// O job de uma pessoa (Pendência 89): calcula as novidades de quem ela segue, separa as que ainda
/// não foram avisadas e manda um aviso só para cada navegador dela.
/// </summary>
/// <remarks>
/// <para>DECISÃO: consumidor idempotente. As chaves entram em <c>avisos_enviados</c> ANTES do envio, na mesma transação, com <c>ON CONFLICT DO NOTHING ... RETURNING</c>: só o job que gravou a chave a avisa. Dois jobs da mesma pessoa ao mesmo tempo (duas cópias do worker) esperam um pelo outro no índice único, e o segundo não acha nada novo.</para>
/// <para>Se o envio falha, a transação volta, as chaves saem, e o Hangfire tenta de novo. RISCO: com dois navegadores, o que já recebeu recebe outra vez nessa nova tentativa; o tópico do push faz o navegador trocar um aviso pelo outro em vez de empilhar.</para>
/// <para>RISCO: nada aqui vai para log com nome de parlamentar ou endereço de navegador. O log diz o id do usuário e quantas chaves.</para>
/// </remarks>
public class AvisadorDoUsuario(PoligraphDb db, ServicoNovidades novidades, EnviadorDePush enviador, ILogger<AvisadorDoUsuario> log)
{
    private readonly PoligraphDb _db = db;
    private readonly ServicoNovidades _novidades = novidades;
    private readonly EnviadorDePush _enviador = enviador;
    private readonly ILogger<AvisadorDoUsuario> _log = log;

    /// <summary>Para onde o clique no aviso leva: o início, onde está o "O que mudou".</summary>
    public const string Destino = "/";

    public async Task AvisarAsync(long idUsuario, CancellationToken ct)
    {
        var inscricoes = await _db.InscricoesNoNavegador.Where(i => i.UsuarioId == idUsuario).ToListAsync(ct);
        if (inscricoes.Count == 0 || !await ConsentimentoVivoAsync(idUsuario, ct))
        {
            return;
        }

        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var chaves = ChavesDosAvisos.Das(await _novidades.ObterAsync(idUsuario, hoje.AddDays(-ServicoAvisos.JanelaEmDias), ct)).ToArray();
        if (chaves.Length == 0)
        {
            return;
        }

        await using var transacao = await _db.Database.BeginTransactionAsync(ct);
        var novas = await ReservarAsync(idUsuario, chaves, ct);
        if (novas.Count == 0)
        {
            await transacao.CommitAsync(ct);
            return;
        }

        var aviso = new AvisoDto(MensagensDaApi.TituloDoAviso, Corpo(novas), Destino);
        var entregues = 0;
        foreach (var inscricao in inscricoes)
        {
            if (await _enviador.EnviarAsync(inscricao, aviso, ct))
            {
                entregues++;
            }
            else
            {
                _db.InscricoesNoNavegador.Remove(inscricao);
            }
        }

        await _db.SaveChangesAsync(ct);
        await transacao.CommitAsync(ct);

        if (_log.IsEnabled(LogLevel.Information))
        {
            _log.LogInformation(
                "Aviso ao usuário {IdUsuario}: {Chaves} novidade(s), {Entregues} de {Navegadores} navegador(es).",
                idUsuario, novas.Count, entregues, inscricoes.Count);
        }
    }

    /// <summary>O texto do aviso: quantas novidades de voto e o mês do resumo, sem nome de ninguém.</summary>
    public static string Corpo(IReadOnlyCollection<string> chaves)
    {
        var deVoto = chaves.Count(c => !ChavesDosAvisos.DoMes(c));
        var mes = chaves.Where(ChavesDosAvisos.DoMes).Select(c => c[3..]).Order(StringComparer.Ordinal).LastOrDefault();
        return MensagensDaApi.CorpoDoAviso(deVoto, mes is null ? null : $"{mes[5..]}/{mes[..4]}");
    }

    private Task<bool> ConsentimentoVivoAsync(long idUsuario, CancellationToken ct) =>
        _db.Consentimentos.AnyAsync(c => c.UsuarioId == idUsuario
            && c.Finalidade == TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR && c.RevogadoEm == null, ct);

    /// <summary>Grava as chaves que ainda não existem e devolve só essas.</summary>
    private Task<List<string>> ReservarAsync(long idUsuario, string[] chaves, CancellationToken ct) =>
        _db.Database.SqlQuery<string>(
            $"""
            INSERT INTO avisos_enviados (usuario_id, chave)
            SELECT {idUsuario}, unnest({chaves})
            ON CONFLICT DO NOTHING
            RETURNING chave AS "Value"
            """).ToListAsync(ct);
}
