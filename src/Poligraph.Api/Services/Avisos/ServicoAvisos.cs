using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// Os navegadores que recebem avisos sobre quem a pessoa segue (Pendência 89). Quem envia é o
/// worker; aqui ficam a inscrição, a saída e o que a página da conta mostra.
/// </summary>
/// <remarks>
/// <para>RISCO: inscrição e avisos enviados dizem que a pessoa segue alguém (LGPD art. 5º, II). Nada aqui vai para log com nome ou endereço.</para>
/// </remarks>
public class ServicoAvisos(PoligraphDb db, ServicoNovidades novidades)
{
    private readonly PoligraphDb _db = db;
    private readonly ServicoNovidades _novidades = novidades;

    /// <summary>Quantos dias para trás o worker olha e quanto a inscrição marca como já visto.</summary>
    public const int JanelaEmDias = 30;

    /// <summary>
    /// Inscreve o navegador, ou passa a inscrição para esta pessoa se o navegador já era de outra conta.
    /// </summary>
    /// <remarks>
    /// <para>DECISÃO: a inscrição marca como avisado o que já existe. Sem isso, o primeiro envio traria de uma vez as novidades dos últimos 30 dias, que a pessoa já vê no "O que mudou".</para>
    /// <para>O endereço é único: o mesmo navegador, entrando com outra conta, troca de dono em vez de receber os avisos das duas.</para>
    /// </remarks>
    public async Task InscreverAsync(long idUsuario, InscricaoNoNavegadorDto inscricao, CancellationToken ct)
    {
        var existente = await _db.InscricoesNoNavegador.FirstOrDefaultAsync(i => i.Endereco == inscricao.Endereco, ct);
        if (existente is null)
        {
            _db.InscricoesNoNavegador.Add(new InscricaoNoNavegadorModel
            {
                UsuarioId = idUsuario,
                Endereco = inscricao.Endereco,
                P256dh = inscricao.P256dh,
                Auth = inscricao.Auth,
            });
        }
        else
        {
            existente.UsuarioId = idUsuario;
            existente.P256dh = inscricao.P256dh;
            existente.Auth = inscricao.Auth;
        }
        await _db.SaveChangesAsync(ct);

        await MarcarComoVistoAsync(idUsuario, ct);
    }

    /// <summary>Tira um navegador desta pessoa. Os outros continuam recebendo.</summary>
    public Task RemoverAsync(long idUsuario, string endereco, CancellationToken ct) =>
        _db.InscricoesNoNavegador
            .Where(i => i.UsuarioId == idUsuario && i.Endereco == endereco)
            .ExecuteDeleteAsync(ct);

    /// <summary>Apaga todos os navegadores e o histórico de avisos da pessoa: sem consentimento, nada disso tem por que ficar.</summary>
    public async Task ApagarTudoAsync(long idUsuario, CancellationToken ct)
    {
        await _db.InscricoesNoNavegador.Where(i => i.UsuarioId == idUsuario).ExecuteDeleteAsync(ct);
        await _db.AvisosEnviados.Where(a => a.UsuarioId == idUsuario).ExecuteDeleteAsync(ct);
    }

    /// <summary>Apaga as chaves que citam o parlamentar: deixar de segui-lo não pode deixar rastro de que o seguia.</summary>
    public Task EsquecerParlamentarAsync(long idUsuario, long idPessoa, CancellationToken ct)
    {
        var (doVoto, daTroca) = ChavesDosAvisos.PadroesDoParlamentar(idPessoa);
        return _db.AvisosEnviados
            .Where(a => a.UsuarioId == idUsuario && (EF.Functions.Like(a.Chave, doVoto) || EF.Functions.Like(a.Chave, daTroca)))
            .ExecuteDeleteAsync(ct);
    }

    /// <summary>O estado para a página da conta e o sininho.</summary>
    public async Task<EstadoDosAvisosDto> EstadoAsync(long idUsuario, string? endereco, CancellationToken ct) =>
        new(
            await _db.Consentimentos.AnyAsync(c => c.UsuarioId == idUsuario
                && c.Finalidade == TipoFinalidadeDeConsentimento.AVISOS_NO_NAVEGADOR && c.RevogadoEm == null, ct),
            await _db.InscricoesNoNavegador.CountAsync(i => i.UsuarioId == idUsuario, ct),
            endereco is not null && await _db.InscricoesNoNavegador.AnyAsync(i => i.UsuarioId == idUsuario && i.Endereco == endereco, ct));

    private async Task MarcarComoVistoAsync(long idUsuario, CancellationToken ct)
    {
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var chaves = ChavesDosAvisos.Das(await _novidades.ObterAsync(idUsuario, hoje.AddDays(-JanelaEmDias), ct)).ToArray();
        if (chaves.Length == 0)
        {
            return;
        }

        await _db.Database.ExecuteSqlAsync(
            $"INSERT INTO avisos_enviados (usuario_id, chave) SELECT {idUsuario}, unnest({chaves}) ON CONFLICT DO NOTHING", ct);
    }
}
