using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O consentimento de cada finalidade (LGPD art. 8º): seguir parlamentares e receber avisos no navegador.
/// </summary>
/// <remarks>
/// <para>Saiu de <c>EndpointsSeguir</c> quando os avisos ganharam consentimento próprio (Pendência 89): a regra é a mesma, e duas cópias acabariam divergindo.</para>
/// </remarks>
public class ServicoConsentimentos(PoligraphDb db)
{
    private readonly PoligraphDb _db = db;

    /// <summary>Tamanho máximo da versão do texto, o mesmo do <c>CHECK</c> da tabela.</summary>
    public const int TamanhoMaximoDaVersao = 40;

    /// <summary>
    /// Há consentimento vivo na versão pedida; ou, com <paramref name="aceite"/>, passa a haver.
    /// </summary>
    /// <remarks>
    /// <para>Sem versão pedida, qualquer consentimento vivo vale. Versão nova revoga a anterior antes de gravar: o índice único só admite um vivo por finalidade.</para>
    /// </remarks>
    public async Task<bool> EmDiaAsync(
        long idUsuario, TipoFinalidadeDeConsentimento finalidade, string? versao, bool aceite, CancellationToken ct)
    {
        var vivo = await _db.Consentimentos
            .FirstOrDefaultAsync(c => c.UsuarioId == idUsuario && c.Finalidade == finalidade && c.RevogadoEm == null, ct);

        if (vivo is not null && (versao is null || vivo.Versao == versao))
        {
            return true;
        }

        if (!aceite || string.IsNullOrWhiteSpace(versao) || versao.Length > TamanhoMaximoDaVersao)
        {
            return false;
        }

        if (vivo is not null)
        {
            vivo.RevogadoEm = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        _db.Consentimentos.Add(new ConsentimentoModel { UsuarioId = idUsuario, Finalidade = finalidade, Versao = versao });
        await _db.SaveChangesAsync(ct);

        return true;
    }

    /// <summary>Se há consentimento vivo para a finalidade, em qualquer versão.</summary>
    public Task<bool> VivoAsync(long idUsuario, TipoFinalidadeDeConsentimento finalidade, CancellationToken ct) =>
        _db.Consentimentos.AnyAsync(c => c.UsuarioId == idUsuario && c.Finalidade == finalidade && c.RevogadoEm == null, ct);

    /// <summary>Marca o consentimento vivo como revogado. Fica a linha, como prova de que existiu e de quando acabou.</summary>
    public Task RevogarAsync(long idUsuario, TipoFinalidadeDeConsentimento finalidade, CancellationToken ct) =>
        _db.Consentimentos
            .Where(c => c.UsuarioId == idUsuario && c.Finalidade == finalidade && c.RevogadoEm == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.RevogadoEm, DateTimeOffset.UtcNow), ct);
}
