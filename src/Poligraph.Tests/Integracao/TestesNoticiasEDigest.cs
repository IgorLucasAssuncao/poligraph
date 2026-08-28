using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;
using Poligraph.Api.Endpoints;
using Poligraph.Api.Services;

namespace Poligraph.Tests.Integracao;

public class TestesNoticiasEDigest : BaseIntegracao
{
    // ═══════════════════════════════════════════════════════════════
    // RF-35 / RF-40 — notícias na ficha
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Noticias_TrazSomenteAsDeConfiancaSuficiente()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();

        await GravarNoticiaAsync("https://ex.com/forte", "Nome completo citado",
            pessoaId, confianca: 0.85f, metodo: MetodoDeCitacao.NOME_PARLAMENTAR);
        await GravarNoticiaAsync("https://ex.com/fraca", "Só o sobrenome",
            pessoaId, confianca: 0.40f, metodo: MetodoDeCitacao.SOBRENOME);

        using var cliente = CriarCliente();
        var noticias = await cliente.GetFromJsonAsync<List<NoticiaJson>>(
            $"/api/parlamentares/{pessoaId}/noticias");

        // 🔴 a fraca EXISTE no banco, mas não vai à tela
        Assert.Single(noticias!);
        Assert.Equal("Nome completo citado", noticias![0].Titulo);
        Assert.Equal(2, await Db.NoticiaPessoas.CountAsync());
    }

    [SkippableFact]
    public async Task Noticias_SemNenhuma_DevolveListaVazia()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();
        using var cliente = CriarCliente();

        var noticias = await cliente.GetFromJsonAsync<List<NoticiaJson>>(
            $"/api/parlamentares/{pessoaId}/noticias");

        // ⭐ RF-47: parlamentar de baixo perfil passa semanas sem notícia — não é erro
        Assert.Empty(noticias!);
    }

    [SkippableFact]
    public async Task Noticias_DeParlamentarInexistente_Retorna404()
    {
        ExigeDocker();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync("/api/parlamentares/999999/noticias");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task Noticias_VemDaMaisRecenteParaAMaisAntiga()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();

        await GravarNoticiaAsync("https://ex.com/velha", "Antiga", pessoaId,
            publicada: DateTimeOffset.UtcNow.AddDays(-10));
        await GravarNoticiaAsync("https://ex.com/nova", "Recente", pessoaId,
            publicada: DateTimeOffset.UtcNow.AddDays(-1));

        using var cliente = CriarCliente();
        var noticias = await cliente.GetFromJsonAsync<List<NoticiaJson>>(
            $"/api/parlamentares/{pessoaId}/noticias");

        Assert.Equal("Recente", noticias![0].Titulo);
    }

    /// <summary>🔴 RF-38 — o banco recusa trecho longo. A regra é constraint, não disciplina.</summary>
    [SkippableFact]
    public async Task Noticia_ComTrechoLongoDemais_ERejeitadaPeloBanco()
    {
        ExigeDocker();

        Db.Noticias.Add(new NoticiaModel
        {
            Url = "https://ex.com/longa",
            Titulo = "Título",
            Veiculo = "Exemplo",
            HashTitulo = "abc",
            PublicadaEm = DateTimeOffset.UtcNow,
            Trecho = new string('x', 501)
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableFact]
    public async Task Noticia_ComMesmaUrl_ERejeitada()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();

        await GravarNoticiaAsync("https://ex.com/mesma", "Primeira", pessoaId);

        Db.Noticias.Add(new NoticiaModel
        {
            Url = "https://ex.com/mesma",
            Titulo = "Segunda",
            Veiculo = "Outro",
            HashTitulo = "xyz",
            PublicadaEm = DateTimeOffset.UtcNow
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // RF-49 a RF-53 — digest por e-mail
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Digest_SoVaiParaQuemTemOptInVivo()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();
        await GravarNoticiaAsync("https://ex.com/n1", "Notícia", pessoaId);

        var comOptIn = await CriarUsuarioAsync("sub-com", pessoaId, optIn: true);
        await CriarUsuarioAsync("sub-sem", pessoaId, optIn: false);

        var digests = await MontarDigestsAsync();

        Assert.Single(digests);
        Assert.Equal(comOptIn, digests[0].UsuarioId);
    }

    /// <summary>⭐ Revogar tira da lista pela consulta, não por `if` no meio do envio.</summary>
    [SkippableFact]
    public async Task Digest_NaoVaiParaQuemRevogou()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();
        await GravarNoticiaAsync("https://ex.com/n1", "Notícia", pessoaId);

        var usuarioId = await CriarUsuarioAsync("sub-revogou", pessoaId, optIn: true);
        await Db.Consentimentos
            .Where(c => c.UsuarioId == usuarioId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.RevogadoEm, DateTimeOffset.UtcNow));

        Assert.Empty(await MontarDigestsAsync());
    }

    /// <summary>⭐ Sem notícia, sem e-mail. Digest vazio é spam.</summary>
    [SkippableFact]
    public async Task Digest_SemNoticiaNoPeriodo_NaoEnviaNada()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();
        await CriarUsuarioAsync("sub-quieto", pessoaId, optIn: true);

        Assert.Empty(await MontarDigestsAsync());
    }

    /// <summary>
    /// 🔴 RF-53 — o assunto não pode conter nome de parlamentar.
    ///
    /// "Novidades sobre o Deputado Fulano" na caixa de entrada é convicção política
    /// atravessando o Gmail e a tela de bloqueio do celular.
    /// </summary>
    [SkippableFact]
    public async Task Digest_AssuntoNaoContemNomeDeParlamentar()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();
        var nome = await Db.Pessoas.Where(p => p.Id == pessoaId)
            .Select(p => p.NomeExibicao).FirstAsync();
        await GravarNoticiaAsync("https://ex.com/n1", "Notícia", pessoaId);
        await CriarUsuarioAsync("sub-assunto", pessoaId, optIn: true);

        var digest = (await MontarDigestsAsync())[0];

        Assert.DoesNotContain(nome, digest.Assunto);
        Assert.Equal(ServicoDigest.Assunto, digest.Assunto);
        // ⭐ mas o nome APARECE dentro, no "porque você segue X" (RF-46)
        Assert.Contains(digest.Itens, i => i.PorCausaDe == nome);
    }

    /// <summary>
    /// ⚠️ O token é reaproveitado entre envios.
    ///
    /// Gerar um por e-mail encheria a tabela e faria links antigos pararem de
    /// funcionar — e link morto vira "marcar como spam", derrubando a reputação.
    /// </summary>
    [SkippableFact]
    public async Task Digest_ReaproveitaOTokenDeDescadastro()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await PrimeiraPessoaAsync();
        await GravarNoticiaAsync("https://ex.com/n1", "Notícia", pessoaId);
        await CriarUsuarioAsync("sub-token", pessoaId, optIn: true);

        var primeiro = (await MontarDigestsAsync())[0].TokenDescadastro;
        var segundo = (await MontarDigestsAsync())[0].TokenDescadastro;

        Assert.Equal(primeiro, segundo);
        Assert.Equal(1, await Db.TokensEmail.CountAsync());
    }

    [SkippableFact]
    public async Task Digest_SoTrazNoticiaDeQuemOUsuarioSegue()
    {
        ExigeDocker();
        await SemearAsync();
        var ids = await Db.Pessoas.OrderBy(p => p.Id).Select(p => p.Id).Take(2).ToListAsync();

        await GravarNoticiaAsync("https://ex.com/seguido", "Do seguido", ids[0]);
        await GravarNoticiaAsync("https://ex.com/outro", "De outro", ids[1]);
        await CriarUsuarioAsync("sub-filtro", ids[0], optIn: true);

        var digest = (await MontarDigestsAsync())[0];

        Assert.Single(digest.Itens);
        Assert.Equal("Do seguido", digest.Itens[0].Titulo);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private async Task<long> PrimeiraPessoaAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();

    private async Task GravarNoticiaAsync(
        string url, string titulo, long pessoaId,
        float confianca = 0.85f, MetodoDeCitacao metodo = MetodoDeCitacao.NOME_PARLAMENTAR,
        DateTimeOffset? publicada = null)
    {
        var noticia = new NoticiaModel
        {
            Url = url,
            Titulo = titulo,
            Veiculo = "Exemplo",
            HashTitulo = Guid.NewGuid().ToString("N"),
            PublicadaEm = publicada ?? DateTimeOffset.UtcNow,
            Trecho = "Trecho curto."
        };
        Db.Noticias.Add(noticia);
        await Db.SaveChangesAsync();

        Db.NoticiaPessoas.Add(new NoticiaPessoaModel
        {
            NoticiaId = noticia.Id,
            PessoaId = pessoaId,
            Confianca = confianca,
            Metodo = metodo
        });
        await Db.SaveChangesAsync();
    }

    private async Task<long> CriarUsuarioAsync(string sub, long pessoaId, bool optIn)
    {
        var usuario = new UsuarioModel { GoogleSub = sub, Email = $"{sub}@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Segue.Add(new SegueModel { UsuarioId = usuario.Id, PessoaId = pessoaId });

        if (optIn)
        {
            Db.Consentimentos.Add(new ConsentimentoModel
            {
                UsuarioId = usuario.Id,
                Finalidade = FinalidadeDeConsentimento.EMAIL_NOTICIAS,
                Versao = "v1"
            });
        }

        await Db.SaveChangesAsync();
        return usuario.Id;
    }

    private async Task<IReadOnlyList<Digest>> MontarDigestsAsync()
    {
        await using var db = CriarContexto();
        return await new ServicoDigest(db).MontarAsync(DateTimeOffset.UtcNow.AddDays(-7));
    }

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private record NoticiaJson(
        long Id, string Url, string Titulo, string Veiculo,
        DateTimeOffset PublicadaEm, string? Trecho);
}
