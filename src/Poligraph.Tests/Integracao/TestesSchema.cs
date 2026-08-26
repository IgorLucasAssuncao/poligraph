using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// 🔑 Estes testes não testam código — testam se as REGRAS MEDIDAS sobreviveram à
/// tradução para EF e chegaram ao banco como constraint.
///
/// É o único jeito de garantir que um `HasCheckConstraint` não desapareceu numa migration
/// futura. Sem eles, a regra vira comentário e ninguém percebe.
/// </summary>
public class TestesSchema : BaseIntegracao
{
    // ═══════════════════════════════════════════════════════════════
    // RN-02 — mínimo de 20 votações comuns
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Similaridade_ComMenosDe20VotacoesComuns_ERejeitada()
    {
        ExigeDocker();
        var (a, b) = await CriarDuasPessoasAsync();
        var execucao = await CriarExecucaoAsync();

        Db.Similaridades.Add(new Similaridade
        {
            ExecucaoId = execucao,
            PessoaA = a,
            PessoaB = b,
            Metrica = "CONCORDANCIA",
            Valor = 0.9f,
            NVotacoesComuns = 19          // 🔴 um abaixo do mínimo
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableFact]
    public async Task Similaridade_ComExatamente20_EAceita()
    {
        ExigeDocker();
        var (a, b) = await CriarDuasPessoasAsync();
        var execucao = await CriarExecucaoAsync();

        Db.Similaridades.Add(new Similaridade
        {
            ExecucaoId = execucao, PessoaA = a, PessoaB = b,
            Metrica = "CONCORDANCIA", Valor = 0.9f, NVotacoesComuns = 20
        });

        await Db.SaveChangesAsync();      // não pode lançar
    }

    // ═══════════════════════════════════════════════════════════════
    // I3 — aresta não-direcionada, gravada uma vez só
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Similaridade_ComParForaDeOrdem_ERejeitada()
    {
        ExigeDocker();
        var (a, b) = await CriarDuasPessoasAsync();
        var execucao = await CriarExecucaoAsync();

        Db.Similaridades.Add(new Similaridade
        {
            ExecucaoId = execucao,
            PessoaA = b,                  // 🔴 invertido: b > a
            PessoaB = a,
            Metrica = "CONCORDANCIA", Valor = 0.9f, NVotacoesComuns = 30
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // RN-03 — domínio fechado do voto
    // ═══════════════════════════════════════════════════════════════

    [SkippableTheory]
    [InlineData((short)2)]
    [InlineData((short)-2)]
    [InlineData((short)99)]
    public async Task Voto_ComValorForaDoDominio_ERejeitado(short valor)
    {
        ExigeDocker();
        var (pessoa, _) = await CriarDuasPessoasAsync();
        var votacao = await CriarVotacaoAsync();

        Db.Votos.Add(new Voto
        {
            VotacaoId = votacao, PessoaId = pessoa, Valor = valor,
            PartidoNoVoto = "PT", UfNoVoto = "SP"
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔴 RN-08 — polaridade. O CHECK é a última linha de defesa do bug
    //    mais perigoso do sistema.
    // ═══════════════════════════════════════════════════════════════

    [SkippableTheory]
    [InlineData((short)0)]
    [InlineData((short)2)]
    public async Task Pergunta_ComPolaridadeInvalida_ERejeitada(short polaridade)
    {
        ExigeDocker();
        var votacao = await CriarVotacaoAsync();

        Db.Perguntas.Add(new Pergunta
        {
            Id = $"q-{polaridade}", VotacaoId = votacao,
            Texto = "Afirmação de teste.", Polaridade = polaridade, Ordem = 1
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // Domínios fechados de texto
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Votacao_ComCategoriaInvalida_ERejeitada()
    {
        ExigeDocker();
        Db.Votacoes.Add(new Votacao
        {
            Id = "cat-invalida", Casa = "CAMARA", Legislatura = 57,
            Data = new DateOnly(2025, 1, 1), Categoria = "INVENTADA", Plenario = true
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableFact]
    public async Task Votacao_ComCasaInvalida_ERejeitada()
    {
        ExigeDocker();
        Db.Votacoes.Add(new Votacao
        {
            Id = "casa-invalida", Casa = "ASSEMBLEIA", Legislatura = 57,
            Data = new DateOnly(2025, 1, 1), Categoria = "SUBSTANTIVA", Plenario = true
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableFact]
    public async Task Usuario_ComEmailSemArroba_ERejeitado()
    {
        ExigeDocker();
        Db.Usuarios.Add(new Usuario { GoogleSub = "sub-1", Email = "naoehemail" });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ LGPD art. 18 — a exclusão precisa ser UM delete
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task ExcluirUsuario_LevaSegueConsentimentoETokens()
    {
        ExigeDocker();
        var (pessoa, _) = await CriarDuasPessoasAsync();

        var usuario = new Usuario { GoogleSub = "sub-lgpd", Email = "pessoa@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Segue.Add(new Segue { UsuarioId = usuario.Id, PessoaId = pessoa });
        Db.Consentimentos.Add(new Consentimento
        {
            UsuarioId = usuario.Id, Finalidade = "EMAIL_NOTICIAS", Versao = "v1"
        });
        Db.TokensEmail.Add(new TokenEmail
        {
            Token = "tok-1", UsuarioId = usuario.Id, Proposito = "DESCADASTRO"
        });
        await Db.SaveChangesAsync();

        // ⭐ um DELETE só — é para isso que os CASCADE existem
        Db.Usuarios.Remove(usuario);
        await Db.SaveChangesAsync();

        Assert.Empty(await Db.Segue.Where(s => s.UsuarioId == usuario.Id).ToListAsync());
        Assert.Empty(await Db.Consentimentos.Where(c => c.UsuarioId == usuario.Id).ToListAsync());
        Assert.Empty(await Db.TokensEmail.Where(t => t.UsuarioId == usuario.Id).ToListAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // ⛔ O oposto do CASCADE: apagar parlamentar que alguém segue não pode
    //    ser possível. Por isso `Segue → Pessoa` é RESTRICT.
    //
    // ⭐ São DUAS camadas de proteção, e as duas são testadas — porque a
    //    primeira pode ser contornada e a segunda não.
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Camada 1 — o *change tracker* do EF barra antes de chegar ao banco.
    /// ⚠️ Esta proteção **some** se a exclusão for feita por SQL direto ou `ExecuteDelete`.
    /// </summary>
    [SkippableFact]
    public async Task ExcluirParlamentarSeguido_EFBarraAntesDeIrAoBanco()
    {
        ExigeDocker();
        var pessoa = await CriarParlamentarSeguidoAsync("sub-ef");

        var alvo = await Db.Pessoas.Include(p => p.Votos).FirstAsync(p => p.Id == pessoa);
        await Db.Segue.Where(s => s.PessoaId == pessoa).LoadAsync();   // rastreia o vínculo

        Assert.Throws<InvalidOperationException>(() => Db.Pessoas.Remove(alvo));
    }

    /// <summary>
    /// 🔑 Camada 2 — a que realmente importa: o Postgres rejeita, mesmo sem o EF saber
    /// do vínculo. É esta que protege contra `DELETE` escrito à mão e contra o ETL Python.
    /// </summary>
    [SkippableFact]
    public async Task ExcluirParlamentarSeguido_BancoRejeitaMesmoSemOEFSaber()
    {
        ExigeDocker();
        var pessoa = await CriarParlamentarSeguidoAsync("sub-banco");

        // contexto novo: o change tracker não conhece nenhum `Segue`
        await using var outro = CriarContexto();
        var alvo = await outro.Pessoas.FirstAsync(p => p.Id == pessoa);
        outro.Pessoas.Remove(alvo);

        var erro = await Assert.ThrowsAsync<DbUpdateException>(() => outro.SaveChangesAsync());
        Assert.Contains("fk_segue_pessoas_pessoa_id", erro.InnerException?.Message ?? "");
    }

    // ═══════════════════════════════════════════════════════════════
    // Um consentimento vivo por finalidade
    // ═══════════════════════════════════════════════════════════════

    [SkippableFact]
    public async Task Consentimento_DoisVivosParaAMesmaFinalidade_ERejeitado()
    {
        ExigeDocker();
        var usuario = new Usuario { GoogleSub = "sub-consent", Email = "c@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Consentimentos.Add(new Consentimento
        {
            UsuarioId = usuario.Id, Finalidade = "EMAIL_NOTICIAS", Versao = "v1"
        });
        await Db.SaveChangesAsync();

        Db.Consentimentos.Add(new Consentimento
        {
            UsuarioId = usuario.Id, Finalidade = "EMAIL_NOTICIAS", Versao = "v2"
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task<(long, long)> CriarDuasPessoasAsync()
    {
        var a = new Pessoa { NomeCivil = "A", NomeExibicao = "A" };
        var b = new Pessoa { NomeCivil = "B", NomeExibicao = "B" };
        Db.Pessoas.AddRange(a, b);
        await Db.SaveChangesAsync();

        return a.Id < b.Id ? (a.Id, b.Id) : (b.Id, a.Id);
    }

    private async Task<long> CriarParlamentarSeguidoAsync(string sub)
    {
        var (pessoa, _) = await CriarDuasPessoasAsync();

        var usuario = new Usuario { GoogleSub = sub, Email = $"{sub}@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Segue.Add(new Segue { UsuarioId = usuario.Id, PessoaId = pessoa });
        await Db.SaveChangesAsync();

        return pessoa;
    }

    private async Task<long> CriarExecucaoAsync()
    {
        var execucao = new Execucao
        {
            Casa = "CAMARA", Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = "CONCLUIDA"
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();
        return execucao.Id;
    }

    private async Task<string> CriarVotacaoAsync()
    {
        var id = $"v-{Guid.NewGuid():N}";
        Db.Votacoes.Add(new Votacao
        {
            Id = id, Casa = "CAMARA", Legislatura = 57,
            Data = new DateOnly(2025, 1, 1), Categoria = "SUBSTANTIVA", Plenario = true
        });
        await Db.SaveChangesAsync();
        return id;
    }
}
