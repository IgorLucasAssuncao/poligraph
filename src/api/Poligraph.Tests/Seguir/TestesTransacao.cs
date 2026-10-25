using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// As gravações de seguir, deixar de seguir e revogar valem juntas: uma falha no meio desfaz as anteriores.
/// </summary>
public class TestesTransacao(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task FalhaNoMeio_DesfazOQueJaTinhaGravado()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        var usuario = new UsuarioModel { GoogleSub = "sub-transacao", Email = "transacao@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => Db.EmTransacaoAsync(async c =>
        {
            Db.Segue.Add(new SegueModel { UsuarioId = usuario.Id, PessoaId = idPessoa });
            await Db.SaveChangesAsync(c);
            throw new InvalidOperationException("falha depois da primeira gravação");
        }, CancellationToken.None));

        await using var depois = CriarContexto();
        Assert.False(await depois.Segue.AnyAsync());
    }

    [SkippableFact]
    public async Task SemFalha_GravaTudo()
    {
        ExigeDocker();
        var (idPessoa, _) = await CenarioDeNovidades.SemearAsync(Db);
        var usuario = new UsuarioModel { GoogleSub = "sub-transacao-ok", Email = "transacao-ok@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        await Db.EmTransacaoAsync(async c =>
        {
            Db.Segue.Add(new SegueModel { UsuarioId = usuario.Id, PessoaId = idPessoa });
            await Db.SaveChangesAsync(c);
        }, CancellationToken.None);

        await using var depois = CriarContexto();
        Assert.True(await depois.Segue.AnyAsync(s => s.UsuarioId == usuario.Id));
    }
}
