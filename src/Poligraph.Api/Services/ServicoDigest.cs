using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Endpoints;

namespace Poligraph.Api.Services;

public record ItemDoDigest(string Titulo, string Veiculo, string Url, string PorCausaDe);

public record Digest(long UsuarioId, string Email, string? PrimeiroNome, string Assunto,
                     IReadOnlyList<ItemDoDigest> Itens, string TokenDescadastro);

/// <summary>
/// Monta o digest de notícias por e-mail (RF-49).
///
/// 🔴 Este serviço lê a tabela `segue`, que é registro de CONVICÇÃO POLÍTICA
/// (LGPD art. 5º, II), e produz um e-mail que sai da nossa infraestrutura.
/// </summary>
public class ServicoDigest(PoligraphDb db)
{
    private readonly PoligraphDb _db = db;

    /// <summary>
    /// 🔴 O assunto NUNCA contém nome de parlamentar.
    ///
    /// "Novidades sobre o Deputado Fulano" na caixa de entrada é convicção política
    /// atravessando o Gmail, o Outlook e a tela de bloqueio do celular. De nada adianta
    /// o cuidado no banco se o assunto diz a mesma coisa em texto puro (RF-53).
    /// </summary>
    public const string Assunto = "Suas atualizações do Poligraph";

    private const int ItensPorDigest = 10;

    // ═══════════════════════════════════════════════════════════════
    // PÚBLICOS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Monta os digests de quem tem opt-in vivo e seguiu alguém.
    ///
    /// ⚠️ Quem revogou o consentimento sai da lista pela consulta, não por `if` no
    /// meio do envio — a regra fica onde não dá para esquecer.
    /// </summary>
    public async Task<IReadOnlyList<Digest>> MontarAsync(
        DateTimeOffset desde, CancellationToken ct = default)
    {
        var destinatarios = await DestinatariosAsync(ct);
        var digests = new List<Digest>();

        foreach (var destinatario in destinatarios)
        {
            var itens = await ItensAsync(destinatario.Id, desde, ct);

            // ⭐ sem notícia, sem e-mail. Digest vazio é spam.
            if (itens.Count == 0) continue;

            digests.Add(new Digest(
                destinatario.Id,
                destinatario.Email,
                destinatario.PrimeiroNome,
                Assunto,
                itens,
                await GarantirTokenAsync(destinatario.Id, ct)));
        }

        return digests;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task<List<Destinatario>> DestinatariosAsync(CancellationToken ct) =>
        await _db.Usuarios.AsNoTracking()
            .Where(u => u.Consentimentos.Any(
                c => c.Finalidade == TipoFinalidadeDeConsentimento.EMAIL_NOTICIAS && c.RevogadoEm == null))
            .Where(u => u.Segue.Count > 0)
            .Select(u => new Destinatario(u.Id, u.Email, u.PrimeiroNome))
            .ToListAsync(ct);

    private async Task<List<ItemDoDigest>> ItensAsync(
        long usuarioId, DateTimeOffset desde, CancellationToken ct) =>
        await _db.NoticiaPessoas.AsNoTracking()
            .Where(np => np.Confianca >= EndpointsNoticias.ConfiancaMinima
                      && np.Noticia!.PublicadaEm >= desde
                      && _db.Segue.Any(s => s.UsuarioId == usuarioId
                                         && s.PessoaId == np.PessoaId))
            .OrderByDescending(np => np.Noticia!.PublicadaEm)
            .Take(ItensPorDigest)
            .Select(np => new ItemDoDigest(
                np.Noticia!.Titulo,
                np.Noticia.Veiculo,
                np.Noticia.Url,
                // RF-46 — "porque você segue X"
                np.Pessoa!.NomeExibicao))
            .ToListAsync(ct);

    /// <summary>
    /// ⚠️ O token de descadastro é reaproveitado, não gerado a cada envio.
    ///
    /// Gerar um por e-mail encheria a tabela e, pior, faria links de e-mails antigos
    /// pararem de funcionar — e link morto transforma "quero sair" em "vou marcar
    /// como spam", derrubando a reputação do domínio.
    /// </summary>
    private async Task<string> GarantirTokenAsync(long usuarioId, CancellationToken ct)
    {
        var existente = await _db.TokensEmail
            .Where(t => t.UsuarioId == usuarioId && t.Proposito == TipoPropositoDeToken.DESCADASTRO)
            .Select(t => t.Token)
            .FirstOrDefaultAsync(ct);

        if (existente is not null) return existente;

        var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator
            .GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');

        _db.TokensEmail.Add(new TokenEmailModel
        {
            Token = token,
            UsuarioId = usuarioId,
            Proposito = TipoPropositoDeToken.DESCADASTRO
        });
        await _db.SaveChangesAsync(ct);

        return token;
    }

    private record Destinatario(long Id, string Email, string? PrimeiroNome);
}
