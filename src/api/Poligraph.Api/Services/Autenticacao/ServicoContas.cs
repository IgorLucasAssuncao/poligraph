using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>A conta do cidadão no banco: criar, ler, revogar e eliminar.</summary>
public class ServicoContas(PoligraphDb db)
{
    private readonly PoligraphDb _db = db;

    /// <summary>
    /// Grava o perfil completo. A minimização foi revogada por decisão do autor:
    /// o que o Google manda, o banco guarda.
    ///
    /// A chave é <c>GoogleSub</c>, nunca o e-mail — o Google permite trocar o
    /// endereço principal, e usar e-mail como chave criaria uma conta órfã.
    /// </summary>
    public async Task<UsuarioModel> SalvarPerfilAsync(PerfilGoogleDto perfil, CancellationToken ct)
    {
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(u => u.GoogleSub == perfil.Sub, ct);

        if (usuario is null)
        {
            usuario = new UsuarioModel { GoogleSub = perfil.Sub, Email = perfil.Email };
            _db.Usuarios.Add(usuario);
        }

        usuario.Email = perfil.Email;
        usuario.EmailVerificado = perfil.EmailVerificado;
        usuario.Nome = perfil.Nome;
        usuario.PrimeiroNome = perfil.PrimeiroNome;
        usuario.Sobrenome = perfil.Sobrenome;
        usuario.FotoUrl = perfil.FotoUrl;
        usuario.Locale = perfil.Locale;
        usuario.VistoEm = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return usuario;
    }

    public async Task<UsuarioLogadoDto?> ObterAsync(long idUsuario, CancellationToken ct) =>
        await _db.Usuarios.AsNoTracking()
            .Where(u => u.Id == idUsuario)
            .Select(u => new UsuarioLogadoDto(u.Nome, u.FotoUrl))
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// "Sair de todos os aparelhos" sem tabela de sessão: incrementar uma coluna
    /// invalida todos os cookies daquela pessoa, em todo lugar, na hora.
    /// </summary>
    public Task InvalidarSessoesAsync(long idUsuario, CancellationToken ct) =>
        _db.Usuarios
            .Where(u => u.Id == idUsuario)
            .ExecuteUpdateAsync(
                s => s.SetProperty(u => u.SessaoVersao, u => (short)(u.SessaoVersao + 1)), ct);

    /// <summary>
    /// LGPD art. 18, VI — direito à eliminação.
    ///
    /// É UM <c>DELETE</c>. Os <c>ON DELETE CASCADE</c> do schema levam junto a lista
    /// de acompanhados e os consentimentos. Foi para isto que eles
    /// existem: sem o cascade, esta operação seria uma lista de tabelas que alguém
    /// esqueceria de atualizar ao criar a próxima.
    ///
    /// <b>AQUI A EXCLUSÃO É FÍSICA, E ISSO NÃO É DESCUIDO.</b>
    ///
    /// O projeto adota exclusão LÓGICA como padrão (ver <c>PessoaModel.ExcluidoEm</c>) —
    /// mas não neste caminho. A LGPD art. 18, VI dá direito à <b>eliminação</b>, não
    /// à ocultação. Marcar <c>excluido_em</c> e manter a linha seria dizer ao cidadão que
    /// os dados foram apagados enquanto eles continuam no banco — e a tabela
    /// <c>segue</c>, que vem junto no cascade, é <b>registro de convicção política</b>
    /// (art. 5º, II).
    ///
    /// Quem for adotar exclusão lógica em novas tabelas precisa decidir, uma a uma,
    /// se a tabela guarda dado PESSOAL. Se guarda, o <c>DELETE</c> é físico.
    /// </summary>
    public Task ExcluirAsync(long idUsuario, CancellationToken ct) =>
        _db.Usuarios.Where(u => u.Id == idUsuario).ExecuteDeleteAsync(ct);
}
