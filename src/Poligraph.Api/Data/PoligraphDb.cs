using Microsoft.EntityFrameworkCore;

namespace Poligraph.Api.Data;

/// <summary>
/// 🔴 O EF é DONO do schema. O ETL Python lê estas mesmas tabelas e nunca cria nenhuma.
/// Por isso o `UseSnakeCaseNamingConvention()` no registro do contexto não é estilo:
/// removê-lo quebra o ETL sem erro de compilação.
/// </summary>
public class PoligraphDb(DbContextOptions<PoligraphDb> opcoes) : DbContext(opcoes)
{
    public DbSet<PessoaModel> Pessoas => Set<PessoaModel>();
    public DbSet<PessoaFonteIdModel> PessoaFonteIds => Set<PessoaFonteIdModel>();
    public DbSet<VotacaoModel> Votacoes => Set<VotacaoModel>();
    public DbSet<VotoModel> Votos => Set<VotoModel>();
    public DbSet<ProposicaoModel> Proposicoes => Set<ProposicaoModel>();
    public DbSet<PerguntaModel> Perguntas => Set<PerguntaModel>();
    public DbSet<DespesaModel> Despesas => Set<DespesaModel>();
    public DbSet<ReceitaDeCampanhaModel> ReceitasDeCampanha => Set<ReceitaDeCampanhaModel>();
    public DbSet<EmendaModel> Emendas => Set<EmendaModel>();
    public DbSet<AutorDeEmendaModel> AutoresDeEmenda => Set<AutorDeEmendaModel>();
    public DbSet<ExecucaoModel> Execucoes => Set<ExecucaoModel>();
    public DbSet<SimilaridadeModel> Similaridades => Set<SimilaridadeModel>();
    public DbSet<ArestaGrafoModel> ArestasGrafo => Set<ArestaGrafoModel>();
    public DbSet<NoMetricaModel> NosMetrica => Set<NoMetricaModel>();
    public DbSet<OrientacaoModel> Orientacoes => Set<OrientacaoModel>();
    public DbSet<UsuarioModel> Usuarios => Set<UsuarioModel>();
    public DbSet<SegueModel> Segue => Set<SegueModel>();
    public DbSet<ConsentimentoModel> Consentimentos => Set<ConsentimentoModel>();
    public DbSet<TokenEmailModel> TokensEmail => Set<TokenEmailModel>();
    public DbSet<NoticiaModel> Noticias => Set<NoticiaModel>();
    public DbSet<NoticiaPessoaModel> NoticiaPessoas => Set<NoticiaPessoaModel>();
    public DbSet<NoticiaTemaModel> NoticiaTemas => Set<NoticiaTemaModel>();
    public DbSet<AvaliacaoQuestionarioModel> Avaliacoes => Set<AvaliacaoQuestionarioModel>();

    /// <summary>
    /// 🔴 <b>Todo enum é gravado como TEXTO.</b>
    ///
    /// <para>
    /// O padrão do EF é o ordinal: <c>CAMARA</c> viraria <c>0</c> na coluna. As tabelas
    /// são lidas e escritas pelo ETL Python e protegidas por <c>CHECK</c> com os nomes
    /// por extenso — gravar inteiro faria o banco recusar toda inserção vinda daqui, e
    /// o Python continuaria escrevendo texto na mesma coluna. Duas representações, uma
    /// tabela.
    /// </para>
    ///
    /// <para>
    /// ⚠️ É <b>convenção do modelo</b>, ⛔ não uma chamada por propriedade, de
    /// propósito: são 13 colunas hoje, e a 14ª entraria como inteiro em silêncio se
    /// dependesse de alguém lembrar. `TestesSchema` verifica que nenhuma escapou.
    /// </para>
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder construtor) =>
        construtor.Properties<Enum>().HaveConversion<string>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        ConfigurarIdentidade(mb);
        ConfigurarVotacao(mb);
        ConfigurarQuestionario(mb);
        ConfigurarDespesa(mb);
        ConfigurarDinheiro(mb);
        ConfigurarAnalise(mb);
        ConfigurarUsuario(mb);
        ConfigurarNoticia(mb);
        ConfigurarAvaliacao(mb);
    }

    // ═══════════════════════════════════════════════════════════════
    // Cada regra medida vira CHECK. Comentário não rejeita INSERT errado.
    // ═══════════════════════════════════════════════════════════════

    private static void ConfigurarIdentidade(ModelBuilder mb)
    {
        mb.Entity<PessoaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.CpfHash).HasMaxLength(64);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_pessoa_sexo", "sexo IS NULL OR sexo IN ('M','F')"));

            // 🔴 Exclusão lógica: quem tem `excluido_em` some de TODA consulta do EF,
            //    sem que cada endpoint precise lembrar do filtro.
            //
            // ⚠️ O ETL Python ⛔ NÃO enxerga este filtro — ele fala SQL direto. É
            //    proposital: a análise trabalha sobre o registro histórico completo, e
            //    é a API que decide o que mostrar ao cidadão.
            e.HasQueryFilter(x => x.ExcluidoEm == null);
        });

        mb.Entity<PessoaFonteIdModel>(e =>
        {
            e.HasKey(x => new { x.Fonte, x.IdExterno });
            e.HasOne(x => x.Pessoa).WithMany(p => p.FontesId)
                .HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_fonte", "fonte IN ('CAMARA','SENADO','TSE')");
                t.HasCheckConstraint("ck_metodo", "metodo IN ('CPF','FUZZY','MANUAL')");
                t.HasCheckConstraint("ck_confianca",
                    "confianca IS NULL OR (confianca BETWEEN 0 AND 1)");
            });
        });
    }

    private static void ConfigurarVotacao(ModelBuilder mb)
    {
        mb.Entity<VotacaoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Proposicao).WithMany().HasForeignKey(x => x.ProposicaoId);
            // 🔴 Guardado como TEXTO, ⛔ nunca como inteiro. A coluna é lida e escrita
            //    pelo ETL Python, e um enum persistido por ordinal transformaria
            //    'CAMARA' em 0 — a restrição do banco recusaria toda inserção, e o ETL
            //    pararia de escrever sem que nada em C# quebrasse.
            e.HasIndex(x => new { x.Casa, x.Legislatura, x.Plenario, x.Categoria })
                .HasDatabaseName("ix_votacao_matriz");
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_votacao_casa", "casa IN ('CAMARA','SENADO')");
                t.HasCheckConstraint("ck_votacao_categoria",
                    "categoria IN ('PROCEDIMENTAL','DESTAQUE','SUBSTANTIVA','AUTORIDADE')");
            });
        });

        mb.Entity<VotoModel>(e =>
        {
            e.HasKey(x => new { x.VotacaoId, x.PessoaId });
            e.HasOne(x => x.Votacao).WithMany(v => v.Votos).HasForeignKey(x => x.VotacaoId);
            e.HasOne(x => x.Pessoa).WithMany(p => p.Votos).HasForeignKey(x => x.PessoaId);
            e.Property(x => x.UfNoVoto).HasMaxLength(2);
            // RN-03: domínio fechado
            e.ToTable(t => t.HasCheckConstraint(
                "ck_voto_valor", "valor IS NULL OR valor IN (-1, 0, 1)"));
        });

        mb.Entity<ProposicaoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            // ano = 0 sinaliza PPP/parecer, não matéria real
            e.ToTable(t => t.HasCheckConstraint("ck_proposicao_ano", "ano IS NULL OR ano <> 0"));
        });
    }

    private static void ConfigurarQuestionario(ModelBuilder mb)
    {
        mb.Entity<PerguntaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Votacao).WithMany().HasForeignKey(x => x.VotacaoId);
            e.HasIndex(x => x.VotacaoId).IsUnique();
            // 🔴 RN-08: sem polaridade não entra pergunta nenhuma
            e.ToTable(t => t.HasCheckConstraint(
                "ck_pergunta_polaridade", "polaridade IN (-1, 1)"));
        });
    }

    private static void ConfigurarDespesa(ModelBuilder mb)
    {
        mb.Entity<DespesaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Pessoa).WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.Cascade);

            // ⭐ A consulta da ficha é sempre "as despesas DESTE deputado, por ano".
            e.HasIndex(x => new { x.PessoaId, x.Ano })
                .HasDatabaseName("ix_despesa_pessoa_ano");

            e.Property(x => x.ValorLiquido).HasPrecision(14, 2);
            e.Property(x => x.CnpjOuHash).HasMaxLength(64);

            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_despesa_mes", "mes BETWEEN 1 AND 12");
                // ⚠️ Valor negativo existe: é estorno. ⛔ Zero não.
                t.HasCheckConstraint("ck_despesa_valor", "valor_liquido <> 0");
            });
        });
    }

    private static void ConfigurarDinheiro(ModelBuilder mb)
    {
        mb.Entity<ReceitaDeCampanhaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Pessoa).WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.PessoaId, x.AnoEleicao })
                .HasDatabaseName("ix_receita_pessoa_eleicao");

            e.Property(x => x.Valor).HasPrecision(14, 2);
            e.Property(x => x.DoadorCnpjOuHash).HasMaxLength(64);

            // ⚠️ Receita zero é linha administrativa; negativa é estorno e FICA.
            e.ToTable(t => t.HasCheckConstraint("ck_receita_valor", "valor <> 0"));
        });

        mb.Entity<EmendaModel>(e =>
        {
            e.HasKey(x => x.Id);

            // ⚠️ `SetNull`, ⛔ não `Cascade`: apagar a pessoa ⛔ não pode apagar a emenda.
            //    O gasto público continua tendo existido — o que se perde é o vínculo.
            e.HasOne(x => x.Pessoa).WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.SetNull);

            // 🔴 A chave natural é (código do autor, código da emenda) — ⛔ NÃO envolve
            //    `pessoa_id`, que pode ser nulo e mudar na reconciliação.
            e.HasIndex(x => new { x.CodigoAutor, x.CodigoEmenda }).IsUnique()
                .HasDatabaseName("ux_emenda_autor_codigo");

            e.Property(x => x.CodigoAutor).HasMaxLength(16);
            e.HasIndex(x => x.PessoaId).HasDatabaseName("ix_emenda_pessoa");

            e.Property(x => x.ValorEmpenhado).HasPrecision(16, 2);
            e.Property(x => x.ValorLiquidado).HasPrecision(16, 2);
            e.Property(x => x.ValorPago).HasPrecision(16, 2);
            e.Property(x => x.ValorRestoPago).HasPrecision(16, 2);
        });

        mb.Entity<AutorDeEmendaModel>(e =>
        {
            e.HasKey(x => x.Codigo);
            e.Property(x => x.Codigo).HasMaxLength(16);
            e.Property(x => x.AtualizadoEm).HasDefaultValueSql("now()");

            e.HasOne(x => x.Pessoa).WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.SetNull);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_autor_metodo", "metodo IN ('AUTOMATICO','MANUAL','NAO_RESOLVIDO')"));
        });
    }

    private static void ConfigurarAnalise(ModelBuilder mb)
    {
        mb.Entity<ExecucaoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.IniciadaEm).HasDefaultValueSql("now()");
            e.ToTable(t =>
            {
                // ⚠️ Esta faltava. `votacoes.casa` era protegida desde o início e
                //    `execucoes.casa` não — e é o ETL Python quem escreve as duas. Um
                //    erro de digitação aqui produzia execução que nenhuma consulta
                //    encontra: a tela mostraria "a análise ainda não rodou", que é
                //    exatamente a mensagem do caso legítimo.
                t.HasCheckConstraint("ck_execucao_casa", "casa IN ('CAMARA','SENADO')");
                t.HasCheckConstraint(
                    "ck_execucao_status", "status IN ('EM_ANDAMENTO','CONCLUIDA','FALHOU')");
            });
        });

        mb.Entity<OrientacaoModel>(e =>
        {
            // ⭐ A chave é (votação, bancada): uma bancada orienta uma vez por votação.
            //    Reingerir o ano ⛔ não duplica.
            e.HasKey(x => new { x.VotacaoId, x.Bancada });
            e.HasOne(x => x.Votacao).WithMany()
                .HasForeignKey(x => x.VotacaoId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_orientacao_nao_vazia", "orientacao <> ''"));
        });

        mb.Entity<SimilaridadeModel>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Metrica });
            e.HasOne<ExecucaoModel>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);

            // 🔴 Os DOIS lados apontam para `pessoas` — ver a nota em `NoMetricaModel`.
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaA)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaB)
                .OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_sim_metrica", "metrica IN ('CONCORDANCIA','COSSENO')");
                t.HasCheckConstraint("ck_sim_valor", "valor BETWEEN 0 AND 1");
                t.HasCheckConstraint("ck_sim_minimo", "n_votacoes_comuns >= 20");   // RN-02
                t.HasCheckConstraint("ck_sim_ordem", "pessoa_a < pessoa_b");        // I3
            });
        });

        mb.Entity<ArestaGrafoModel>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Tipo });
            e.HasOne<ExecucaoModel>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);

            // 🔴 Aresta para quem não existe vira ponto sem nome no desenho.
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaA)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaB)
                .OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_aresta_tipo",
                    "tipo IN ('SIMILARIDADE_VOTO','COMISSAO_COMUM','COAUTORIA')");
                t.HasCheckConstraint("ck_aresta_ordem", "pessoa_a < pessoa_b");     // I3
            });
        });

        mb.Entity<NoMetricaModel>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaId });
            e.HasOne<ExecucaoModel>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);

            // 🔴 FK para `pessoas` — faltava, e o furo apareceu de verdade.
            //
            // ⚠️ Ao remover 12 parlamentares fictícios do banco, seus nós ficaram em
            //    `nos_metrica` sem ninguém do outro lado. O grafo desenhou 12 pontos
            //    SEM NOME e nada acusou — o banco aceitou calado. É o formato de bug
            //    que este projeto mais teme: não quebra, produz resultado plausível.
            //
            // ⭐ CASCADE, e não RESTRICT: métrica é retrato derivado, e apagar a pessoa
            //    deve levar junto o que se calculou sobre ela. É o oposto de `segue`,
            //    que é registro de convicção e por isso BARRA a exclusão.
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigurarUsuario(ModelBuilder mb)
    {
        mb.Entity<UsuarioModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.GoogleSub).IsUnique();
            e.Property(x => x.CriadoEm).HasDefaultValueSql("now()");
            e.Property(x => x.VistoEm).HasDefaultValueSql("now()");
            e.Property(x => x.SessaoVersao).HasDefaultValue((short)0);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_usuario_email", "position('@' in email) > 1"));
        });

        mb.Entity<SegueModel>(e =>
        {
            // 🔴 Nome da tabela FIXADO, e é a única do schema que precisa disto.
            //
            // As demais tiram o nome do DbSet no plural (`Pessoas` -> `pessoas`), que
            // ⛔ não colide com o nome da classe. Aqui o DbSet chama `Segue`, igual à
            // classe — e renomear a classe para `SegueModel` renomeou o DbSet junto,
            // gerando um `RenameTable` para `segue_model`. Numa tabela que é registro
            // de convicção política (LGPD art. 5º, II), migrar por acidente de
            // nomenclatura é inaceitável.
            e.ToTable("segue");
            e.HasKey(x => new { x.UsuarioId, x.PessoaId });
            // ⭐ CASCADE: a exclusão da LGPD art. 18 é UM DELETE
            e.HasOne(x => x.Usuario).WithMany(u => u.Segue)
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            // ⛔ RESTRICT: nunca apagar parlamentar que alguém segue
            e.HasOne(x => x.Pessoa).WithMany()
                .HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.PessoaId);
            e.Property(x => x.CriadoEm).HasDefaultValueSql("now()");
        });

        mb.Entity<ConsentimentoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Usuario).WithMany(u => u.Consentimentos)
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.AceitoEm).HasDefaultValueSql("now()");
            // um consentimento vivo por finalidade
            e.HasIndex(x => new { x.UsuarioId, x.Finalidade })
                .IsUnique().HasFilter("revogado_em IS NULL");
            e.ToTable(t => t.HasCheckConstraint(
                "ck_consentimento_finalidade", "finalidade IN ('EMAIL_NOTICIAS')"));
        });

        mb.Entity<TokenEmailModel>(e =>
        {
            e.HasKey(x => x.Token);
            e.HasOne(x => x.Usuario).WithMany()
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.CriadoEm).HasDefaultValueSql("now()");
            e.ToTable(t => t.HasCheckConstraint(
                "ck_token_proposito", "proposito IN ('DESCADASTRO')"));
        });
    }

    private static void ConfigurarNoticia(ModelBuilder mb)
    {
        mb.Entity<NoticiaModel>(e =>
        {
            e.HasKey(x => x.Id);
            // ⭐ dedup em duas frentes: mesma URL, e mesma matéria republicada com outra URL
            e.HasIndex(x => x.Url).IsUnique();
            e.HasIndex(x => x.HashTitulo);
            e.HasIndex(x => x.PublicadaEm);
            e.Property(x => x.ColetadaEm).HasDefaultValueSql("now()");
            // 🔴 RF-38: trecho CURTO. O limite é a regra virando constraint —
            //    se alguém tentar gravar o corpo da matéria, o banco recusa.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_noticia_trecho", "trecho IS NULL OR length(trecho) <= 500"));
        });

        mb.Entity<NoticiaPessoaModel>(e =>
        {
            e.HasKey(x => new { x.NoticiaId, x.PessoaId });
            e.HasOne(x => x.Noticia).WithMany(n => n.Pessoas)
                .HasForeignKey(x => x.NoticiaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Pessoa).WithMany()
                .HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.PessoaId);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_np_confianca", "confianca BETWEEN 0 AND 1");
                t.HasCheckConstraint("ck_np_metodo",
                    "metodo IN ('NOME_COMPLETO','NOME_PARLAMENTAR','SOBRENOME')");
            });
        });

        mb.Entity<NoticiaTemaModel>(e =>
        {
            e.HasKey(x => new { x.NoticiaId, x.Tema });
            e.HasOne(x => x.Noticia).WithMany()
                .HasForeignKey(x => x.NoticiaId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigurarAvaliacao(ModelBuilder mb)
    {
        mb.Entity<AvaliacaoQuestionarioModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.RegistradaEm).HasDefaultValueSql("now()");

            // 🔴 A escala tem limite fechado. Sem o CHECK, um front com bug gravaria
            //    valores fora da escala e a análise do TCC sairia errada em silêncio.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_avaliacao_posicao",
                "posicao_autodeclarada IS NULL OR posicao_autodeclarada BETWEEN -3 AND 3"));
        });

        // ⛔ Nenhuma relação com `usuario` — ver o comentário da entidade.
        //    Se alguém acrescentar um `usuario_id` aqui, a tabela deixa de ser amostra
        //    de pesquisa e vira cadastro de ideologia por pessoa identificada.
    }
}