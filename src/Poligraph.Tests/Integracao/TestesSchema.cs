using Microsoft.EntityFrameworkCore;
using Npgsql;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Estes testes não testam código — testam se as REGRAS MEDIDAS sobreviveram à
/// tradução para EF e chegaram ao banco como constraint.
///
/// É o único jeito de garantir que um `HasCheckConstraint` não desapareceu numa migration
/// futura. Sem eles, a regra vira comentário e ninguém percebe.
/// </summary>
public class TestesSchema(FixturePostgres postgres) : BaseIntegracao(postgres)
{

    [SkippableFact]
    public async Task Similaridade_ComMenosDe20VotacoesComuns_ERejeitada()
    {
        ExigeDocker();
        var (a, b) = await CriarDuasPessoasAsync();
        var execucao = await CriarExecucaoAsync();

        Db.Similaridades.Add(new SimilaridadeModel
        {
            ExecucaoId = execucao,
            PessoaA = a,
            PessoaB = b,
            Metrica = TipoMetrica.CONCORDANCIA,
            Valor = 0.9f,
            NVotacoesComuns = 19
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableFact]
    public async Task Similaridade_ComExatamente20_EAceita()
    {
        ExigeDocker();
        var (a, b) = await CriarDuasPessoasAsync();
        var execucao = await CriarExecucaoAsync();

        Db.Similaridades.Add(new SimilaridadeModel
        {
            ExecucaoId = execucao, PessoaA = a, PessoaB = b,
            Metrica = TipoMetrica.CONCORDANCIA, Valor = 0.9f, NVotacoesComuns = 20
        });

        await Db.SaveChangesAsync();
    }

    [SkippableFact]
    public async Task Similaridade_ComParForaDeOrdem_ERejeitada()
    {
        ExigeDocker();
        var (a, b) = await CriarDuasPessoasAsync();
        var execucao = await CriarExecucaoAsync();

        Db.Similaridades.Add(new SimilaridadeModel
        {
            ExecucaoId = execucao,
            PessoaA = b,
            PessoaB = a,
            Metrica = TipoMetrica.CONCORDANCIA, Valor = 0.9f, NVotacoesComuns = 30
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableTheory]
    [InlineData((short)2)]
    [InlineData((short)-2)]
    [InlineData((short)99)]
    public async Task Voto_ComValorForaDoDominio_ERejeitado(short valor)
    {
        ExigeDocker();
        var (pessoa, _) = await CriarDuasPessoasAsync();
        var votacao = await CriarVotacaoAsync();

        Db.Votos.Add(new VotoModel
        {
            VotacaoId = votacao, PessoaId = pessoa, Valor = valor,
            PartidoNoVoto = "PT", UfNoVoto = "SP"
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    [SkippableTheory]
    [InlineData((short)0)]
    [InlineData((short)2)]
    public async Task Pergunta_ComPolaridadeInvalida_ERejeitada(short polaridade)
    {
        ExigeDocker();
        var votacao = await CriarVotacaoAsync();

        Db.Perguntas.Add(new PerguntaModel
        {
            Id = $"q-{polaridade}", VotacaoId = votacao,
            Texto = "Afirmação de teste.", Polaridade = polaridade, Ordem = 1
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    /// <summary>
    /// <b>A lista é literal de propósito.</b>
    ///
    /// <para>
    /// O nome da tabela sai do nome do <c>DbSet</c>, então renomear uma propriedade de
    /// C# renomeia uma tabela — e o EF gera o <c>RenameTable</c> sem perguntar. Isso já
    /// aconteceu: a renomeação das entidades para o sufixo <c>Model</c> pegou o DbSet
    /// <c>Segue</c> junto e produziria <c>segue_model</c>, na tabela que é registro de
    /// convicção política (LGPD art. 5º, II).
    /// </para>
    ///
    /// <para>
    /// Derivar a lista esperada do próprio modelo tornaria o teste vazio: ele
    /// concordaria com qualquer renomeação. A lista escrita à mão é o ponto.
    /// </para>
    /// </summary>
    [SkippableFact]
    public async Task NomesDeTabela_SaoOsQueOEtlPythonLe()
    {
        ExigeDocker();

        var esperadas = new[]
        {
            "arestas_grafo", "autores_de_emenda", "avaliacoes", "avisos_enviados", "cargas", "cnpjs_municipio", "compras_centralizadas_no_cartao", "consentimentos", "contas_dos_municipios", "contratacoes_do_orgao", "contratados_do_governo", "convenios", "destinos_de_viagem", "divida_federal",
            "despesas", "em_exercicio", "emendas", "emendas_convenios", "emendas_favorecidos", "encargos_especiais", "eventos", "execucoes", "gastos_da_defesa_civil", "gastos_sigilosos", "inscricoes_no_navegador",
            "mandatos", "municipios", "orcamento_por_funcao", "patrimonios", "viagens_do_orgao",
            "nos_metrica", "orientacoes", "perguntas", "pessoa_fonte_ids",
            "pessoas",
            "proposicoes", "receitas_de_campanha", "receitas_por_origem", "reconciliacao_motivos", "reconciliacoes",
            "redes_sociais", "sancoes_de_empresas", "segue", "seguidos_encerrados", "selic_por_ano", "similaridades",
            "usuarios", "votacoes", "votacoes_simbolicas", "votos",
        };

        var noBanco = await Db.Database
            .SqlQuery<string>($"""
                SELECT tablename AS "Value" FROM pg_tables
                 WHERE schemaname = 'public' AND tablename NOT LIKE '\_\_%'
                """)
            .ToListAsync();

        // A ordenação é feita aqui, não no `ORDER BY`: a ordem do Postgres depende
        // do collation do container, e `nos_metrica` vem antes ou depois de
        // `orcamento_por_funcao` conforme a regra de intercalação. O teste afirma QUAIS
        // tabelas existem, não em que ordem o banco as lista.
        Assert.Equal(
            esperadas.Order(StringComparer.Ordinal),
            noBanco.Order(StringComparer.Ordinal));
    }

    // Domínios fechados de texto

    /// <summary>
    /// <b>SQL cru, e não o EF, de propósito.</b>
    ///
    /// <para>
    /// Desde que <c>casa</c> e <c>categoria</c> viraram enum, escrever
    /// <c>Casa = "ASSEMBLEIA"</c> nem compila — e a versão anterior deste teste,
    /// que passava pelo EF, deixaria de existir por isso.
    /// </para>
    ///
    /// <para>
    /// Só que o enum não é quem protege a coluna: <b>quem escreve a maior parte
    /// destas linhas é o ETL Python</b>, que manda texto e nunca viu o tipo. O caminho
    /// que o teste precisa exercitar é justamente esse. Passar pelo EF testaria o
    /// compilador; passar por SQL testa a restrição.
    /// </para>
    /// </summary>
    [SkippableTheory]
    [InlineData("casa", "'ASSEMBLEIA'", "ck_votacao_casa")]
    [InlineData("categoria", "'INVENTADA'", "ck_votacao_categoria")]
    public async Task Votacao_ComValorForaDoDominio_ERejeitadaPeloBanco(
        string coluna, string valor, string restricao)
    {
        ExigeDocker();

        var colunas = "id, casa, legislatura, data, categoria, plenario, secreta";
        var valores = coluna == "casa"
            ? $"'fora-dominio', {valor}, 57, DATE '2025-01-01', 'SUBSTANTIVA', true, false"
            : $"'fora-dominio', 'CAMARA', 57, DATE '2025-01-01', {valor}, true, false";

        // EF1002 suprimido: a interpolação é o OBJETO do teste. `colunas` e `valores`
        // vêm de [InlineData] neste arquivo, nunca de entrada externa, e o que se
        // verifica é qual CHECK do banco barra o INSERT.
#pragma warning disable EF1002
        var erro = await Assert.ThrowsAsync<PostgresException>(() =>
            Db.Database.ExecuteSqlRawAsync(
                $"INSERT INTO votacoes ({colunas}) VALUES ({valores})"));
#pragma warning restore EF1002

        // Confere QUAL restrição barrou. Sem isto, um NOT NULL acidental em outra
        // coluna faria o teste passar por um motivo que não é o que ele afirma.
        Assert.Equal(restricao, erro.ConstraintName);
    }

    /// <summary>
    /// Pendência 72: a carga só aceita o hash como o ETL o grava, hexadecimal minúsculo de 64, e
    /// uma fonte conhecida. Um hash em maiúsculas seria outra string, e a comparação com o
    /// arquivo guardado falharia sem dizer por quê.
    /// </summary>
    [SkippableTheory]
    [InlineData("'CAMARA'", "'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789'", "ck_carga_sha256")]
    [InlineData("'CAMARA'", "'abc'", "ck_carga_sha256")]
    [InlineData("'WIKIPEDIA'", "'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'", "ck_carga_fonte")]
    public async Task Carga_ComHashOuFonteForaDoDominio_ERejeitadaPeloBanco(
        string fonte, string sha256, string restricao)
    {
        ExigeDocker();

#pragma warning disable EF1002
        var erro = await Assert.ThrowsAsync<PostgresException>(() =>
            Db.Database.ExecuteSqlRawAsync(
                $"INSERT INTO cargas (fonte, url, sha256, bytes, comando) VALUES ({fonte}, 'https://exemplo', {sha256}, 1, 'teste')"));
#pragma warning restore EF1002

        Assert.Equal(restricao, erro.ConstraintName);
    }

    /// <summary>
    /// Pendência 81: a autoria inferida nunca tem pessoa, e o código dela tem o "I" que nenhum
    /// código do Portal tem. Inferir para uma pessoa, ou com código do Portal, o banco recusa.
    /// </summary>
    [SkippableTheory]
    [InlineData("20177106I0001", false, true)]
    [InlineData("201771060001", false, false)]
    [InlineData("20177106I0001", true, false)]
    public async Task EmendaInferida_SoSemPessoaEComCodigoProprio(string codigo, bool comPessoa, bool aceita)
    {
        ExigeDocker();
        long? idPessoa = null;
        if (comPessoa)
        {
            var pessoa = new PessoaModel { NomeExibicao = "Fulano", NomeCivil = "FULANO" };
            Db.Pessoas.Add(pessoa);
            await Db.SaveChangesAsync();
            idPessoa = pessoa.Id;
        }
        Db.Emendas.Add(new EmendaModel
        {
            PessoaId = idPessoa, CodigoAutor = "7106", NomeAutor = "BANCADA DA BAHIA", CodigoEmenda = codigo,
            Ano = 2017, Localidade = "SALVADOR - BA", CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000",
            ValorEmpenhado = 10m, AutoriaInferida = true
        });

        if (aceita)
        {
            await Db.SaveChangesAsync();
            return;
        }
        var erro = await Assert.ThrowsAsync<Microsoft.EntityFrameworkCore.DbUpdateException>(() => Db.SaveChangesAsync());
        Assert.Equal("ck_emenda_autoria_inferida", ((PostgresException)erro.InnerException!).ConstraintName);
    }

    /// <summary>
    /// Pendência 72: carga com linha apontando para ela não se apaga, senão a procedência sumiria.
    /// </summary>
    [SkippableFact]
    public async Task Carga_ComVotacaoApontando_NaoSeApaga()
    {
        ExigeDocker();
        var carga = new CargaModel
        {
            Fonte = TipoFonteDeCarga.CAMARA, Url = "https://exemplo/votacoes-2026.csv",
            Sha256 = new string('a', 64), Bytes = 10, Comando = "teste",
        };
        Db.Cargas.Add(carga);
        await Db.SaveChangesAsync();
        Db.Votacoes.Add(new VotacaoModel
        {
            Id = "carga-1", Casa = TipoCasa.CAMARA, Legislatura = 57, Data = new DateOnly(2026, 3, 1),
            Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true, CargaId = carga.Id,
        });
        await Db.SaveChangesAsync();

        var erro = await Assert.ThrowsAsync<PostgresException>(() =>
            Db.Database.ExecuteSqlAsync($"DELETE FROM cargas WHERE id = {carga.Id}"));

        Assert.Equal("23503", erro.SqlState);
    }

    /// <summary>
    /// O outro lado da mesma moeda: o enum precisa chegar ao banco como TEXTO.
    ///
    /// Se a convenção de <c>ConfigureConventions</c> sumir, o EF grava o ordinal, a
    /// restrição recusa <c>0</c> e o ETL Python continua gravando <c>'CAMARA'</c> na
    /// mesma coluna. Este teste falha antes disso chegar em produção.
    /// </summary>
    [SkippableFact]
    public async Task Enum_ChegaAoBancoComoTexto_NaoComoOrdinal()
    {
        ExigeDocker();
        Db.Votacoes.Add(new VotacaoModel
        {
            Id = "enum-texto", Casa = TipoCasa.SENADO, Legislatura = 57,
            Data = new DateOnly(2025, 1, 1),
            Categoria = TipoCategoriaDeVotacao.DESTAQUE, Plenario = true
        });
        await Db.SaveChangesAsync();

        var gravado = await Db.Database
            // O alias `Value` não é enfeite: `SqlQuery<T>` de tipo escalar procura
            // uma coluna com esse nome exato.
            .SqlQuery<string>($"""
                SELECT casa || '/' || categoria AS "Value"
                  FROM votacoes WHERE id = 'enum-texto'
                """)
            .SingleAsync();

        Assert.Equal("SENADO/DESTAQUE", gravado);
    }

    [SkippableFact]
    public async Task Usuario_ComEmailSemArroba_ERejeitado()
    {
        ExigeDocker();
        Db.Usuarios.Add(new UsuarioModel { GoogleSub = "sub-1", Email = "naoehemail" });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // LGPD art. 18 — a exclusão precisa ser UM delete

    [SkippableFact]
    public async Task ExcluirUsuario_LevaSegueEConsentimento()
    {
        ExigeDocker();
        var (pessoa, _) = await CriarDuasPessoasAsync();

        var usuario = new UsuarioModel { GoogleSub = "sub-lgpd", Email = "pessoa@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Segue.Add(new SegueModel { UsuarioId = usuario.Id, PessoaId = pessoa });
        Db.Consentimentos.Add(new ConsentimentoModel
        {
            UsuarioId = usuario.Id, Finalidade = TipoFinalidadeDeConsentimento.SEGUIR_PARLAMENTARES, Versao = "v1"
        });
        await Db.SaveChangesAsync();

        // um DELETE só — é para isso que os CASCADE existem
        Db.Usuarios.Remove(usuario);
        await Db.SaveChangesAsync();

        Assert.Empty(await Db.Segue.Where(s => s.UsuarioId == usuario.Id).ToListAsync());
        Assert.Empty(await Db.Consentimentos.Where(c => c.UsuarioId == usuario.Id).ToListAsync());
    }

    // O oposto do CASCADE: apagar parlamentar que alguém segue não pode
    // ser possível. Por isso `SegueModel PessoaModel` é RESTRICT.
    // São DUAS camadas de proteção, e as duas são testadas — porque a
    // primeira pode ser contornada e a segunda não.

    /// <summary>
    /// Camada 1 — o *change tracker* do EF barra antes de chegar ao banco.
    /// Esta proteção **some** se a exclusão for feita por SQL direto ou `ExecuteDelete`.
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
    /// Camada 2 — a que realmente importa: o Postgres rejeita, mesmo sem o EF saber
    /// do vínculo. É esta que protege contra `DELETE` escrito à mão e contra o ETL Python.
    /// </summary>
    [SkippableFact]
    public async Task ExcluirParlamentarSeguido_BancoRejeitaMesmoSemOEFSaber()
    {
        ExigeDocker();
        var pessoa = await CriarParlamentarSeguidoAsync("sub-banco");

        // contexto novo: o change tracker não conhece nenhum `SegueModel`
        await using var outro = CriarContexto();
        var alvo = await outro.Pessoas.FirstAsync(p => p.Id == pessoa);
        outro.Pessoas.Remove(alvo);

        var erro = await Assert.ThrowsAsync<DbUpdateException>(() => outro.SaveChangesAsync());
        Assert.Contains("fk_segue_pessoas_pessoa_id", erro.InnerException?.Message ?? "");
    }

    // Um consentimento vivo por finalidade

    [SkippableFact]
    public async Task Consentimento_DoisVivosParaAMesmaFinalidade_ERejeitado()
    {
        ExigeDocker();
        var usuario = new UsuarioModel { GoogleSub = "sub-consent", Email = "c@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Consentimentos.Add(new ConsentimentoModel
        {
            UsuarioId = usuario.Id, Finalidade = TipoFinalidadeDeConsentimento.SEGUIR_PARLAMENTARES, Versao = "v1"
        });
        await Db.SaveChangesAsync();

        Db.Consentimentos.Add(new ConsentimentoModel
        {
            UsuarioId = usuario.Id, Finalidade = TipoFinalidadeDeConsentimento.SEGUIR_PARLAMENTARES, Versao = "v2"
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }

    // PRIVADOS — na ordem de uso

    private async Task<(long, long)> CriarDuasPessoasAsync()
    {
        var a = new PessoaModel { NomeCivil = "A", NomeExibicao = "A" };
        var b = new PessoaModel { NomeCivil = "B", NomeExibicao = "B" };
        Db.Pessoas.AddRange(a, b);
        await Db.SaveChangesAsync();

        return a.Id < b.Id ? (a.Id, b.Id) : (b.Id, a.Id);
    }

    private async Task<long> CriarParlamentarSeguidoAsync(string sub)
    {
        var (pessoa, _) = await CriarDuasPessoasAsync();

        var usuario = new UsuarioModel { GoogleSub = sub, Email = $"{sub}@exemplo.com" };
        Db.Usuarios.Add(usuario);
        await Db.SaveChangesAsync();

        Db.Segue.Add(new SegueModel { UsuarioId = usuario.Id, PessoaId = pessoa });
        await Db.SaveChangesAsync();

        return pessoa;
    }

    private async Task<long> CriarExecucaoAsync()
    {
        var execucao = new ExecucaoModel
        {
            Casa = TipoCasa.CAMARA, Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = TipoStatusDaExecucao.CONCLUIDA
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();
        return execucao.Id;
    }

    private async Task<string> CriarVotacaoAsync()
    {
        var id = $"v-{Guid.NewGuid():N}";
        Db.Votacoes.Add(new VotacaoModel
        {
            Id = id, Casa = TipoCasa.CAMARA, Legislatura = 57,
            Data = new DateOnly(2025, 1, 1), Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
        });
        await Db.SaveChangesAsync();
        return id;
    }
}
