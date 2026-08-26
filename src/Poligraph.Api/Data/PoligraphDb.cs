using Microsoft.EntityFrameworkCore;

namespace Poligraph.Api.Data;

/// <summary>
/// 🔴 O EF é DONO do schema. O ETL Python lê estas mesmas tabelas e nunca cria nenhuma.
/// Por isso o `UseSnakeCaseNamingConvention()` no registro do contexto não é estilo:
/// removê-lo quebra o ETL sem erro de compilação.
/// </summary>
public class PoligraphDb(DbContextOptions<PoligraphDb> opcoes) : DbContext(opcoes)
{
    public DbSet<Pessoa> Pessoas => Set<Pessoa>();
    public DbSet<PessoaFonteId> PessoaFonteIds => Set<PessoaFonteId>();
    public DbSet<Votacao> Votacoes => Set<Votacao>();
    public DbSet<Voto> Votos => Set<Voto>();
    public DbSet<Proposicao> Proposicoes => Set<Proposicao>();
    public DbSet<Pergunta> Perguntas => Set<Pergunta>();
    public DbSet<Execucao> Execucoes => Set<Execucao>();
    public DbSet<Similaridade> Similaridades => Set<Similaridade>();
    public DbSet<ArestaGrafo> ArestasGrafo => Set<ArestaGrafo>();
    public DbSet<NoMetrica> NosMetrica => Set<NoMetrica>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Segue> Segue => Set<Segue>();
    public DbSet<Consentimento> Consentimentos => Set<Consentimento>();
    public DbSet<TokenEmail> TokensEmail => Set<TokenEmail>();
    public DbSet<Noticia> Noticias => Set<Noticia>();
    public DbSet<NoticiaPessoa> NoticiaPessoas => Set<NoticiaPessoa>();
    public DbSet<NoticiaTema> NoticiaTemas => Set<NoticiaTema>();
    public DbSet<AvaliacaoQuestionario> Avaliacoes => Set<AvaliacaoQuestionario>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        ConfigurarIdentidade(mb);
        ConfigurarVotacao(mb);
        ConfigurarQuestionario(mb);
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
        mb.Entity<Pessoa>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.CpfHash).HasMaxLength(64);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_pessoa_sexo", "sexo IS NULL OR sexo IN ('M','F')"));
        });

        mb.Entity<PessoaFonteId>(e =>
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
        mb.Entity<Votacao>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Proposicao).WithMany().HasForeignKey(x => x.ProposicaoId);
            e.HasIndex(x => new { x.Casa, x.Legislatura, x.Plenario, x.Categoria })
                .HasDatabaseName("ix_votacao_matriz");
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_votacao_casa", "casa IN ('CAMARA','SENADO')");
                t.HasCheckConstraint("ck_votacao_categoria",
                    "categoria IN ('PROCEDIMENTAL','DESTAQUE','SUBSTANTIVA','AUTORIDADE')");
            });
        });

        mb.Entity<Voto>(e =>
        {
            e.HasKey(x => new { x.VotacaoId, x.PessoaId });
            e.HasOne(x => x.Votacao).WithMany(v => v.Votos).HasForeignKey(x => x.VotacaoId);
            e.HasOne(x => x.Pessoa).WithMany(p => p.Votos).HasForeignKey(x => x.PessoaId);
            e.Property(x => x.UfNoVoto).HasMaxLength(2);
            // RN-03: domínio fechado
            e.ToTable(t => t.HasCheckConstraint(
                "ck_voto_valor", "valor IS NULL OR valor IN (-1, 0, 1)"));
        });

        mb.Entity<Proposicao>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            // ano = 0 sinaliza PPP/parecer, não matéria real
            e.ToTable(t => t.HasCheckConstraint("ck_proposicao_ano", "ano IS NULL OR ano <> 0"));
        });
    }

    private static void ConfigurarQuestionario(ModelBuilder mb)
    {
        mb.Entity<Pergunta>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Votacao).WithMany().HasForeignKey(x => x.VotacaoId);
            e.HasIndex(x => x.VotacaoId).IsUnique();
            // 🔴 RN-08: sem polaridade não entra pergunta nenhuma
            e.ToTable(t => t.HasCheckConstraint(
                "ck_pergunta_polaridade", "polaridade IN (-1, 1)"));
        });
    }

    private static void ConfigurarAnalise(ModelBuilder mb)
    {
        mb.Entity<Execucao>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.IniciadaEm).HasDefaultValueSql("now()");
            e.ToTable(t => t.HasCheckConstraint(
                "ck_execucao_status", "status IN ('EM_ANDAMENTO','CONCLUIDA','FALHOU')"));
        });

        mb.Entity<Similaridade>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Metrica });
            e.HasOne<Execucao>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_sim_metrica", "metrica IN ('CONCORDANCIA','COSSENO')");
                t.HasCheckConstraint("ck_sim_valor", "valor BETWEEN 0 AND 1");
                t.HasCheckConstraint("ck_sim_minimo", "n_votacoes_comuns >= 20");   // RN-02
                t.HasCheckConstraint("ck_sim_ordem", "pessoa_a < pessoa_b");        // I3
            });
        });

        mb.Entity<ArestaGrafo>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Tipo });
            e.HasOne<Execucao>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_aresta_tipo",
                    "tipo IN ('SIMILARIDADE_VOTO','COMISSAO_COMUM','COAUTORIA')");
                t.HasCheckConstraint("ck_aresta_ordem", "pessoa_a < pessoa_b");     // I3
            });
        });

        mb.Entity<NoMetrica>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaId });
            e.HasOne<Execucao>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigurarUsuario(ModelBuilder mb)
    {
        mb.Entity<Usuario>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.GoogleSub).IsUnique();
            e.Property(x => x.CriadoEm).HasDefaultValueSql("now()");
            e.Property(x => x.VistoEm).HasDefaultValueSql("now()");
            e.Property(x => x.SessaoVersao).HasDefaultValue((short)0);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_usuario_email", "position('@' in email) > 1"));
        });

        mb.Entity<Segue>(e =>
        {
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

        mb.Entity<Consentimento>(e =>
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

        mb.Entity<TokenEmail>(e =>
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
        mb.Entity<Noticia>(e =>
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

        mb.Entity<NoticiaPessoa>(e =>
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

        mb.Entity<NoticiaTema>(e =>
        {
            e.HasKey(x => new { x.NoticiaId, x.Tema });
            e.HasOne(x => x.Noticia).WithMany()
                .HasForeignKey(x => x.NoticiaId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigurarAvaliacao(ModelBuilder mb)
    {
        mb.Entity<AvaliacaoQuestionario>(e =>
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