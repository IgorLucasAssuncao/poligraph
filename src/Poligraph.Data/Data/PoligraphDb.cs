using Microsoft.EntityFrameworkCore;

namespace Poligraph.Data;

/// <summary>
/// O EF é DONO do schema. O ETL Python lê estas mesmas tabelas e nunca cria nenhuma.
/// Por isso o `UseSnakeCaseNamingConvention()` no registro do contexto não é estilo:
/// removê-lo quebra o ETL sem erro de compilação.
/// </summary>
public class PoligraphDb(DbContextOptions<PoligraphDb> opcoes) : DbContext(opcoes)
{
    public DbSet<PessoaModel> Pessoas => Set<PessoaModel>();
    public DbSet<MandatoModel> Mandatos => Set<MandatoModel>();
    public DbSet<PessoaFonteIdModel> PessoaFonteIds => Set<PessoaFonteIdModel>();
    public DbSet<VotacaoModel> Votacoes => Set<VotacaoModel>();
    public DbSet<VotoModel> Votos => Set<VotoModel>();
    public DbSet<ProposicaoModel> Proposicoes => Set<ProposicaoModel>();
    public DbSet<PerguntaModel> Perguntas => Set<PerguntaModel>();
    public DbSet<DespesaModel> Despesas => Set<DespesaModel>();
    public DbSet<ReceitaDeCampanhaModel> ReceitasDeCampanha => Set<ReceitaDeCampanhaModel>();
    public DbSet<EmendaModel> Emendas => Set<EmendaModel>();
    public DbSet<AutorDeEmendaModel> AutoresDeEmenda => Set<AutorDeEmendaModel>();
    public DbSet<EmendaFavorecidoModel> EmendasFavorecidos => Set<EmendaFavorecidoModel>();
    public DbSet<ConvenioModel> Convenios => Set<ConvenioModel>();
    public DbSet<EmendaConvenioModel> EmendasConvenios => Set<EmendaConvenioModel>();
    public DbSet<OrcamentoPorFuncaoModel> OrcamentoPorFuncao => Set<OrcamentoPorFuncaoModel>();
    public DbSet<EncargoEspecialModel> EncargosEspeciais => Set<EncargoEspecialModel>();
    public DbSet<DividaFederalModel> DividaFederal => Set<DividaFederalModel>();
    public DbSet<SelicDoAnoModel> SelicPorAno => Set<SelicDoAnoModel>();
    public DbSet<GastoSigilosoModel> GastosSigilosos => Set<GastoSigilosoModel>();
    public DbSet<GastoDaDefesaCivilModel> GastosDaDefesaCivil => Set<GastoDaDefesaCivilModel>();
    public DbSet<ViagensDoOrgaoModel> ViagensDoOrgao => Set<ViagensDoOrgaoModel>();
    public DbSet<DestinoDeViagemModel> DestinosDeViagem => Set<DestinoDeViagemModel>();
    public DbSet<ContratacoesDoOrgaoModel> ContratacoesDoOrgao => Set<ContratacoesDoOrgaoModel>();
    public DbSet<ContratadoDoGovernoModel> ContratadosDoGoverno => Set<ContratadoDoGovernoModel>();
    public DbSet<SancaoDeEmpresaModel> SancoesDeEmpresas => Set<SancaoDeEmpresaModel>();
    public DbSet<CompraCentralizadaNoCartaoModel> ComprasCentralizadasNoCartao => Set<CompraCentralizadaNoCartaoModel>();
    public DbSet<ReceitaPorOrigemModel> ReceitasPorOrigem => Set<ReceitaPorOrigemModel>();
    public DbSet<MunicipioModel> Municipios => Set<MunicipioModel>();
    public DbSet<ContasDoMunicipioModel> ContasDosMunicipios => Set<ContasDoMunicipioModel>();
    public DbSet<CnpjMunicipioModel> CnpjsMunicipio => Set<CnpjMunicipioModel>();
    public DbSet<ExecucaoModel> Execucoes => Set<ExecucaoModel>();
    public DbSet<SimilaridadeModel> Similaridades => Set<SimilaridadeModel>();
    public DbSet<ArestaGrafoModel> ArestasGrafo => Set<ArestaGrafoModel>();
    public DbSet<NoMetricaModel> NosMetrica => Set<NoMetricaModel>();
    public DbSet<OrientacaoModel> Orientacoes => Set<OrientacaoModel>();
    public DbSet<UsuarioModel> Usuarios => Set<UsuarioModel>();
    public DbSet<SegueModel> Segue => Set<SegueModel>();
    public DbSet<ConsentimentoModel> Consentimentos => Set<ConsentimentoModel>();
    public DbSet<AvaliacaoQuestionarioModel> Avaliacoes => Set<AvaliacaoQuestionarioModel>();
    public DbSet<RedeSocialModel> RedesSociais => Set<RedeSocialModel>();
    public DbSet<PatrimonioModel> Patrimonios => Set<PatrimonioModel>();
    public DbSet<CargaModel> Cargas => Set<CargaModel>();
    public DbSet<ReconciliacaoModel> Reconciliacoes => Set<ReconciliacaoModel>();
    public DbSet<VotacoesSimbolicasModel> VotacoesSimbolicas => Set<VotacoesSimbolicasModel>();
    public DbSet<ReconciliacaoMotivoModel> ReconciliacaoMotivos => Set<ReconciliacaoMotivoModel>();
    public DbSet<EventoModel> Eventos => Set<EventoModel>();
    public DbSet<InscricaoNoNavegadorModel> InscricoesNoNavegador => Set<InscricaoNoNavegadorModel>();
    public DbSet<AvisoEnviadoModel> AvisosEnviados => Set<AvisoEnviadoModel>();
    public DbSet<EmExercicioModel> EmExercicio => Set<EmExercicioModel>();
    public DbSet<SeguidoEncerradoModel> SeguidosEncerrados => Set<SeguidoEncerradoModel>();

    /// <summary>
    /// <b>Todo enum é gravado como TEXTO.</b>
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
    /// É <b>convenção do modelo</b>, não uma chamada por propriedade, de
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
        ConfigurarProcedencia(mb);
        ConfigurarReconciliacao(mb);
        ConfigurarVotacoesSimbolicas(mb);
        ConfigurarUsuario(mb);
        ConfigurarAvisos(mb);
        ConfigurarAvaliacao(mb);
        ConfigurarFuncoes(mb);
    }

    private static void ConfigurarIdentidade(ModelBuilder mb)
    {
        mb.Entity<PessoaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.CpfHash).HasMaxLength(64);
            e.Property(x => x.TituloHash).HasMaxLength(64);
            e.HasIndex(x => x.TituloHash).HasFilter("titulo_hash IS NOT NULL");
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_pessoa_sexo", "sexo IS NULL OR sexo IN ('M','F')");
                t.HasCheckConstraint("ck_pessoa_nascimento",
                    "data_nascimento IS NULL OR data_nascimento BETWEEN '1900-01-01' AND '2100-12-31'");
            });

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

        mb.Entity<MandatoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.SqCandidato).HasMaxLength(20);
            e.Property(x => x.Uf).HasMaxLength(2).IsFixedLength();
            e.Property(x => x.CodigoMunicipioTse).HasMaxLength(5);
            e.Property(x => x.CodigoMunicipioIbge).HasMaxLength(7).IsFixedLength();
            e.Property(x => x.Partido).HasMaxLength(20);
            e.Property(x => x.NomeDeUrna).HasMaxLength(120);
            e.HasIndex(x => new { x.AnoEleicao, x.Uf, x.CodigoMunicipioTse, x.Cargo, x.SqCandidato }).IsUnique().AreNullsDistinct(false);
            e.HasIndex(x => x.PessoaId);
            e.HasIndex(x => new { x.Cargo, x.Uf });
            e.HasIndex(x => x.CodigoMunicipioIbge);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<MunicipioModel>().WithMany().HasForeignKey(x => x.CodigoMunicipioIbge).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<CargaModel>().WithMany().HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_mandato_cargo",
                    "cargo IN ('PRESIDENTE','VICE_PRESIDENTE','SENADOR','DEPUTADO_FEDERAL','GOVERNADOR','VICE_GOVERNADOR',"
                    + "'DEPUTADO_ESTADUAL','DEPUTADO_DISTRITAL','PREFEITO','VICE_PREFEITO')");
                t.HasCheckConstraint("ck_mandato_eleicao", "ano_eleicao BETWEEN 1994 AND 2100 AND ano_eleicao % 2 = 0");
                t.HasCheckConstraint("ck_mandato_anos", "primeiro_ano = ano_eleicao + 1 AND ultimo_ano >= primeiro_ano");
                t.HasCheckConstraint("ck_mandato_uf", "uf IS NULL OR uf ~ '^[A-Z]{2}$'");
                t.HasCheckConstraint("ck_mandato_ente",
                    "CASE WHEN cargo IN ('PREFEITO','VICE_PREFEITO') THEN uf IS NOT NULL AND codigo_municipio_tse IS NOT NULL "
                    + "WHEN cargo IN ('PRESIDENTE','VICE_PRESIDENTE') THEN uf IS NULL AND codigo_municipio_tse IS NULL AND codigo_municipio_ibge IS NULL "
                    + "ELSE uf IS NOT NULL AND codigo_municipio_tse IS NULL AND codigo_municipio_ibge IS NULL END");
            });
        });
    }

    /// <summary>
    /// Pendência 72: a carga de cada linha de dado de fonte. A FK é <c>RESTRICT</c>: carga não se
    /// apaga enquanto houver linha apontando para ela, senão a procedência sumiria calada.
    /// </summary>
    /// <remarks>
    /// <para>O <c>CHECK</c> do hash aceita só hexadecimal minúsculo de 64 caracteres: um hash em maiúsculas ou cortado seria outra string, e a comparação com o arquivo guardado falharia sem dizer por quê.</para>
    /// <para>Índice nas três tabelas: o modo análise (Pendência 73) lista as linhas de uma carga. Em <c>votos</c>, com 2,2 milhões de linhas, são ~50 MB.</para>
    /// <para>As tabelas de dinheiro (cota, emendas, campanha, patrimônio, sede de CNPJ) levam a mesma chave, e o índice que o EF cria para toda FK: o modo análise conta quantas linhas vieram de cada arquivo.</para>
    /// </remarks>
    private static void ConfigurarProcedencia(ModelBuilder mb)
    {
        mb.Entity<CargaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Sha256).HasMaxLength(64).IsFixedLength();
            e.Property(x => x.BaixadoEm).HasDefaultValueSql("now()");
            e.Property(x => x.Versao).HasMaxLength(64);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_carga_fonte",
                    "fonte IN ('CAMARA','SENADO','TSE','PORTAL_TRANSPARENCIA','RECEITA','IBGE','TESOURO','BANCO_CENTRAL')");
                t.HasCheckConstraint("ck_carga_sha256", "sha256 ~ '^[0-9a-f]{64}$'");
                t.HasCheckConstraint("ck_carga_bytes", "bytes >= 0");
                t.HasCheckConstraint("ck_carga_url", "url <> ''");
            });
        });

        mb.Entity<ContasDoMunicipioModel>(e =>
        {
            e.HasKey(x => new { x.CodigoIbge, x.Ano });
            e.Property(x => x.CodigoIbge).HasMaxLength(7).IsFixedLength();
            e.HasOne<MunicipioModel>().WithMany().HasForeignKey(x => x.CodigoIbge).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<CargaModel>().WithMany().HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_contas_municipio_ano", "ano BETWEEN 2000 AND 2100");
                t.HasCheckConstraint("ck_contas_municipio_receita", "receita_bruta >= 0");
                t.HasCheckConstraint("ck_contas_municipio_despesa", "despesa_empenhada >= 0 AND despesa_paga >= 0");
            });
        });

        mb.Entity<VotacaoModel>(e =>
        {
            e.HasOne<CargaModel>().WithMany().HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.CargaId);
        });
        mb.Entity<VotoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<OrientacaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);

        mb.Entity<DespesaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<EmendaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<EmendaFavorecidoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ReceitaDeCampanhaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<PatrimonioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<CnpjMunicipioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ConvenioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.ComplementoCargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<PessoaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CpfCargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<PessoaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.NomeCivilCargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ProposicaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.PalavrasChaveCargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<VotacaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.ProposicaoCargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ConvenioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<EmendaConvenioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<MunicipioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<MunicipioModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.PopulacaoCargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<PessoaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ProposicaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<RedeSocialModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<AutorDeEmendaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<OrcamentoPorFuncaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<EncargoEspecialModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<DividaFederalModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<SelicDoAnoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ReceitaPorOrigemModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<GastoSigilosoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<GastoDaDefesaCivilModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ViagensDoOrgaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<DestinoDeViagemModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ContratacoesDoOrgaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<ContratadoDoGovernoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<SancaoDeEmpresaModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<CompraCentralizadaNoCartaoModel>().HasOne<CargaModel>().WithMany()
            .HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
    }

    /// <summary>A reconciliação dos totais de dinheiro com a fonte (Pendência 81).</summary>
    /// <remarks>
    /// <para>Os domínios viram <c>CHECK</c>: um motivo escrito errado na ETL seria uma justificativa que nenhuma tela sabe ler.</para>
    /// </remarks>
    private static void ConfigurarVotacoesSimbolicas(ModelBuilder mb)
    {
        mb.Entity<VotacoesSimbolicasModel>(e =>
        {
            e.ToTable("votacoes_simbolicas", t =>
            {
                t.HasCheckConstraint("ck_simbolicas_casa", "casa IN ('CAMARA','SENADO')");
                t.HasCheckConstraint("ck_simbolicas_quantidade", "quantidade >= 0");
                t.HasCheckConstraint("ck_simbolicas_legislatura", "legislatura BETWEEN 40 AND 70");
            });
            e.HasKey(x => new { x.Casa, x.Ano, x.Legislatura, x.Plenario });
            e.HasOne<CargaModel>().WithMany().HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigurarReconciliacao(ModelBuilder mb)
    {
        mb.Entity<ReconciliacaoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Conjunto, x.Medida, x.Ano }).IsUnique().HasDatabaseName("ux_reconciliacao");
            e.Property(x => x.Conjunto).HasMaxLength(16);
            e.Property(x => x.Medida).HasMaxLength(16);
            e.Property(x => x.TotalNaFonte).HasPrecision(18, 2);
            e.Property(x => x.TotalNaBase).HasPrecision(18, 2);
            e.Property(x => x.TotalInferido).HasPrecision(18, 2);
            e.Property(x => x.CalculadoEm).HasDefaultValueSql("now()");
            e.HasOne<CargaModel>().WithMany().HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Motivos).WithOne().HasForeignKey(x => x.ReconciliacaoId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_reconciliacao_conjunto",
                    "conjunto IN ('EMENDAS','PAGAMENTOS','PAGO_X_RECEBIDO','COTA_CAMARA','COTA_SENADO','GOVERNO_FEDERAL')");
                t.HasCheckConstraint("ck_reconciliacao_medida",
                    "(conjunto = 'EMENDAS' AND medida IN ('EMPENHADO','PAGO')) OR (conjunto = 'PAGAMENTOS' AND medida = 'RECEBIDO')"
                    + " OR (conjunto = 'PAGO_X_RECEBIDO' AND medida = 'PAGO')"
                    + " OR (conjunto IN ('COTA_CAMARA','COTA_SENADO') AND medida = 'VALOR_LIQUIDO')"
                    + " OR (conjunto = 'GOVERNO_FEDERAL' AND medida = 'PAGO')");
            });
        });

        mb.Entity<ReconciliacaoMotivoModel>(e =>
        {
            e.HasKey(x => new { x.ReconciliacaoId, x.Motivo });
            e.Property(x => x.Motivo).HasMaxLength(40);
            e.Property(x => x.Valor).HasPrecision(18, 2);
            e.ToTable(t => t.HasCheckConstraint("ck_reconciliacao_motivo",
                "motivo IN ('RELATOR_SEM_AUTOR','COMISSAO_SEM_AUTOR','BANCADA_SEM_AUTOR_E_SEM_UF','INDIVIDUAL_SEM_AUTOR',"
                + "'OUTRA_SEM_AUTOR','INCOERENTE','PAGAMENTO_SEM_CODIGO_DE_EMENDA','EMENDA_DE_ANO_NAO_CARREGADO','EMENDA_FORA_DA_BASE',"
                + "'SEM_PARLAMENTAR','FORA_DO_DE_PARA','PAGO_SEM_RECEBEDOR','RECEBIDO_ACIMA_DO_PAGO','MENSAL_DIFERENTE_DO_ANUAL')"));
        });
    }

    private static void ConfigurarVotacao(ModelBuilder mb)
    {
        mb.Entity<VotacaoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Proposicao)
                .WithMany()
                .HasForeignKey(x => new { x.Casa, x.ProposicaoId })
                .HasPrincipalKey(p => new { p.Casa, p.Id });
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
            e.Property(x => x.Presenca).HasMaxLength(20);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_voto_valor", "valor IS NULL OR valor IN (-1, 0, 1)");
                t.HasCheckConstraint(
                    "ck_voto_presenca", "presenca IS NULL OR presenca IN ('PRESENTE','AUSENTE_JUSTIFICADO','AUSENTE')");
                t.HasCheckConstraint("ck_voto_posicao_presente", "valor IS NULL OR presenca IS NULL OR presenca = 'PRESENTE'");
            });
        });

        mb.Entity<ProposicaoModel>(e =>
        {
            e.HasKey(x => new { x.Casa, x.Id });
            e.Property(x => x.Id).ValueGeneratedNever();
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
            e.ToTable(t => t.HasCheckConstraint(
                "ck_pergunta_polaridade", "polaridade IN (-1, 1)"));
        });
    }

    /// <remarks>
    /// <para>O índice por ano carrega o valor (<c>INCLUDE</c>) para a soma da cota da legislatura, no painel do Início, ler só o índice. MEDIDO em 2026-10-18, banco local, 5,6 milhões de despesas: a soma de 2023 a 2026 foi de 1,7 s (leitura da tabela inteira, 1,6 GB) para 0,09 s; em produção o rastro mostrou 2,7 s.</para>
    /// </remarks>
    private static void ConfigurarDespesa(ModelBuilder mb)
    {
        mb.Entity<DespesaModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Pessoa).WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.PessoaId, x.Ano })
                .HasDatabaseName("ix_despesa_pessoa_ano");

            e.HasIndex(x => x.Ano)
                .IncludeProperties(x => x.ValorLiquido)
                .HasDatabaseName("ix_despesa_ano");

            e.Property(x => x.ValorLiquido).HasPrecision(14, 2);
            e.Property(x => x.CnpjOuHash).HasMaxLength(64);

            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_despesa_mes", "mes BETWEEN 1 AND 12");
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

            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_receita_valor", "valor <> 0");
                t.HasCheckConstraint("ck_receita_origem", "origem_receita IS NULL OR origem_receita IN ("
                    + "'Recursos de partido político','Recursos de pessoas físicas','Recursos de pessoas jurídicas',"
                    + "'Recursos próprios','Recursos de outros candidatos','Recursos de financiamento coletivo',"
                    + "'Doações pela internet','Comercialização de bens ou realização de eventos',"
                    + "'Rendimentos de aplicações financeiras','Recursos de origens não identificadas')");
            });
        });

        mb.Entity<EmendaModel>(e =>
        {
            e.HasKey(x => x.Id);

            e.HasOne(x => x.Pessoa).WithMany().HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => new { x.CodigoEmenda, x.Localidade, x.CodigoAcao, x.CodigoPlanoOrcamentario })
                .IsUnique()
                .AreNullsDistinct(false)
                .HasDatabaseName("ux_emenda_programacao");
            e.HasIndex(x => x.CodigoEmenda).HasDatabaseName("ix_emenda_codigo");

            e.Property(x => x.CodigoEmenda).HasMaxLength(16);
            e.Property(x => x.CodigoMunicipioIbge).HasMaxLength(7);
            e.ToTable(t =>
            {
                t.HasCheckConstraint(
                    "ck_emenda_municipio_ibge",
                    "codigo_municipio_ibge IS NULL OR codigo_municipio_ibge ~ '^[0-9]{7}$'");
                t.HasCheckConstraint(
                    "ck_emenda_autoria_inferida",
                    "NOT autoria_inferida OR (pessoa_id IS NULL AND codigo_emenda ~ '^[0-9]+I[0-9]+$')");
            });

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

        ConfigurarDestinoDeEmenda(mb);
        ConfigurarOrcamento(mb);
    }

    /// <summary>
    /// Favorecidos e convênios das emendas.
    /// </summary>
    /// <remarks>
    /// <para>A identificação do favorecido segue o tipo: CNPJ de 14 dígitos com nome, código de unidade gestora de 6 dígitos com nome, ou nada. Pessoa nunca tem documento nem nome gravado.</para>
    /// <para>Só pessoa jurídica pode ser intermediária: o intermediário medido é o Banco do Brasil.</para>
    /// </remarks>
    private static void ConfigurarDestinoDeEmenda(ModelBuilder mb)
    {
        mb.Entity<EmendaFavorecidoModel>(e =>
        {
            e.ToTable("emendas_favorecidos", t =>
            {
                t.HasCheckConstraint(
                    "ck_favorecido_tipo",
                    "tipo IN ('PESSOA_JURIDICA','UNIDADE_GESTORA','PESSOA','SEM_INFORMACAO')");
                t.HasCheckConstraint(
                    "ck_favorecido_identificacao",
                    "(tipo = 'PESSOA_JURIDICA' AND documento ~ '^[0-9]{14}$' AND nome IS NOT NULL)"
                    + " OR (tipo = 'UNIDADE_GESTORA' AND documento ~ '^[0-9]{6}$' AND nome IS NOT NULL)"
                    + " OR (tipo IN ('PESSOA','SEM_INFORMACAO') AND documento IS NULL AND nome IS NULL)");
                t.HasCheckConstraint(
                    "ck_favorecido_intermediario", "NOT intermediario OR tipo = 'PESSOA_JURIDICA'");
                t.HasCheckConstraint("ck_favorecido_valor", "valor <> 0");
                t.HasCheckConstraint(
                    "ck_favorecido_competencia", "EXTRACT(DAY FROM competencia) = 1");
            });

            e.HasKey(x => x.Id);
            e.HasIndex(x => new
            {
                x.CodigoEmenda, x.Competencia, x.Tipo, x.Documento,
                x.NaturezaJuridica, x.Uf, x.Municipio,
            })
                .IsUnique()
                .AreNullsDistinct(false)
                .HasDatabaseName("ux_favorecido_pagamento");
            e.HasIndex(x => x.CodigoEmenda).HasDatabaseName("ix_favorecido_emenda");

            e.Property(x => x.CodigoEmenda).HasMaxLength(16);
            e.Property(x => x.Documento).HasMaxLength(14);
            e.Property(x => x.Uf).HasMaxLength(2);
            e.Property(x => x.Valor).HasPrecision(16, 2);
        });

        mb.Entity<ConvenioModel>(e =>
        {
            e.HasKey(x => x.Numero);
            e.Property(x => x.Numero).HasMaxLength(16);
            e.Property(x => x.Valor).HasPrecision(16, 2);
            e.Property(x => x.ValorLiberado).HasPrecision(16, 2);
            e.Property(x => x.CnpjConvenente).HasMaxLength(14);
            e.HasIndex(x => x.CnpjConvenente);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_convenio_valor", "valor > 0");
                t.HasCheckConstraint("ck_convenio_cnpj", "cnpj_convenente IS NULL OR cnpj_convenente ~ '^[0-9]{14}$'");
            });
        });

        mb.Entity<RedeSocialModel>(e =>
        {
            e.ToTable("redes_sociais", t =>
            {
                t.HasCheckConstraint("ck_rede_url", "url ~ '^https?://[^[:space:]]+$'");
                t.HasCheckConstraint(
                    "ck_rede_tipo", "rede IN ('INSTAGRAM','FACEBOOK','X','YOUTUBE','TIKTOK','LINKEDIN','OUTRA')");
                t.HasCheckConstraint("ck_rede_fonte", "fonte IN ('CAMARA','TSE')");
            });
            e.HasKey(x => new { x.PessoaId, x.Url });
            e.Property(x => x.Rede).HasMaxLength(10);
            e.Property(x => x.Fonte).HasMaxLength(6);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
        });

        mb.Entity<PatrimonioModel>(e =>
        {
            e.ToTable("patrimonios", t =>
            {
                t.HasCheckConstraint("ck_patrimonio_ano", "ano_eleicao BETWEEN 2002 AND 2100 AND ano_eleicao % 2 = 0");
                t.HasCheckConstraint("ck_patrimonio_quantidade", "quantidade > 0");
            });
            e.HasKey(x => new { x.PessoaId, x.AnoEleicao, x.TipoBem });
            e.Property(x => x.Valor).HasPrecision(16, 2);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
        });

        mb.Entity<EmendaConvenioModel>(e =>
        {
            e.ToTable("emendas_convenios");
            e.HasKey(x => new { x.CodigoEmenda, x.NumeroConvenio });
            e.Property(x => x.CodigoEmenda).HasMaxLength(16);
            e.HasOne(x => x.Convenio).WithMany().HasForeignKey(x => x.NumeroConvenio)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigurarOrcamento(ModelBuilder mb)
    {
        mb.Entity<OrcamentoPorFuncaoModel>(e =>
        {
            e.ToTable("orcamento_por_funcao", t =>
            {
                t.HasCheckConstraint("ck_orcamento_funcao", "codigo_funcao ~ '^[0-9]{2}$'");
                t.HasCheckConstraint(
                    "ck_orcamento_acima_da_dotacao", "empenhado_acima_da_dotacao >= 0");
            });

            e.HasKey(x => new { x.Ano, x.CodigoFuncao });
            e.Property(x => x.CodigoFuncao).HasMaxLength(2);

            e.Property(x => x.DotacaoInicial).HasPrecision(18, 2);
            e.Property(x => x.DotacaoAtualizada).HasPrecision(18, 2);
            e.Property(x => x.Empenhado).HasPrecision(18, 2);
            e.Property(x => x.Pago).HasPrecision(18, 2);
            e.Property(x => x.EmpenhadoAcimaDaDotacao).HasPrecision(18, 2);
            e.Property(x => x.RestosAPagarPagos).HasPrecision(18, 2);
        });

        mb.Entity<EncargoEspecialModel>(e =>
        {
            e.ToTable("encargos_especiais", t =>
                t.HasCheckConstraint("ck_encargo_subfuncao", "codigo_subfuncao ~ '^[0-9]{3}$'"));

            e.HasKey(x => new { x.Ano, x.CodigoSubfuncao });
            e.Property(x => x.CodigoSubfuncao).HasMaxLength(3);
            e.Property(x => x.DotacaoAtualizada).HasPrecision(18, 2);
            e.Property(x => x.Empenhado).HasPrecision(18, 2);
            e.Property(x => x.Pago).HasPrecision(18, 2);
            e.Property(x => x.RestosAPagarPagos).HasPrecision(18, 2);
        });

        mb.Entity<DividaFederalModel>(e =>
        {
            e.ToTable("divida_federal", t =>
            {
                t.HasCheckConstraint("ck_divida_valores", "juros_pagos >= 0 AND amortizacao_paga >= 0 AND refinanciamento_pago >= 0");
                t.HasCheckConstraint("ck_divida_ano", "ano BETWEEN 2000 AND 2100");
            });
            e.HasKey(x => x.Ano);
            e.Property(x => x.Ano).ValueGeneratedNever();
            e.Property(x => x.JurosPagos).HasPrecision(18, 2);
            e.Property(x => x.AmortizacaoPaga).HasPrecision(18, 2);
            e.Property(x => x.RefinanciamentoPago).HasPrecision(18, 2);
        });

        mb.Entity<SelicDoAnoModel>(e =>
        {
            e.ToTable("selic_por_ano", t =>
            {
                t.HasCheckConstraint("ck_selic_meses", "meses BETWEEN 1 AND 12");
                t.HasCheckConstraint("ck_selic_taxa", "taxa_no_ano > -100 AND taxa_no_ano < 1000");
                t.HasCheckConstraint("ck_selic_ano", "ano BETWEEN 1986 AND 2100");
            });
            e.HasKey(x => x.Ano);
            e.Property(x => x.Ano).ValueGeneratedNever();
            e.Property(x => x.TaxaNoAno).HasPrecision(9, 4);
        });

        mb.Entity<GastoSigilosoModel>(e =>
        {
            e.ToTable("gastos_sigilosos", t =>
            {
                t.HasCheckConstraint("ck_sigilo_origem", "origem IN ('CARTAO_CORPORATIVO','ACAO_SIGILOSA')");
                t.HasCheckConstraint("ck_sigilo_meses", "meses BETWEEN 1 AND 12");
                t.HasCheckConstraint(
                    "ck_sigilo_base",
                    "(origem = 'ACAO_SIGILOSA' AND total = sigiloso AND lancamentos IS NULL) "
                    + "OR (origem = 'CARTAO_CORPORATIVO' AND lancamentos >= 0)");
            });

            e.HasKey(x => new { x.Ano, x.Origem, x.OrgaoSuperior });
            e.Property(x => x.Origem).HasMaxLength(20);
            e.Property(x => x.Sigiloso).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
        });

        mb.Entity<GastoDaDefesaCivilModel>(e =>
        {
            e.ToTable("gastos_da_defesa_civil", t =>
            {
                t.HasCheckConstraint("ck_defesa_civil_mes", "mes BETWEEN 1 AND 12");
                t.HasCheckConstraint("ck_defesa_civil_esfera", "esfera IN ('MUNICIPAL','ESTADUAL','NAO_INFORMADA')");
                t.HasCheckConstraint("ck_defesa_civil_uf",
                    "(esfera = 'NAO_INFORMADA' AND uf IS NULL) OR (esfera <> 'NAO_INFORMADA' AND uf ~ '^[A-Z]{2}$')");
                t.HasCheckConstraint("ck_defesa_civil_cnpj", "cnpj_convenente ~ '^[0-9]{14}$'");
                t.HasCheckConstraint("ck_defesa_civil_transacoes", "transacoes > 0");
            });

            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Ano, x.Mes, x.Executor, x.Uf, x.CnpjConvenente })
                .IsUnique().AreNullsDistinct(false).HasDatabaseName("ux_defesa_civil_mes_executor");
            e.Property(x => x.Uf).HasMaxLength(2);
            e.Property(x => x.Esfera).HasMaxLength(13);
            e.Property(x => x.CnpjConvenente).HasMaxLength(14);
            e.Property(x => x.Valor).HasPrecision(18, 2);
        });

        mb.Entity<ViagensDoOrgaoModel>(e =>
        {
            e.ToTable("viagens_do_orgao", t =>
            {
                t.HasCheckConstraint("ck_viagens_contagens", "viagens >= 0 AND urgentes BETWEEN 0 AND viagens AND nao_realizadas BETWEEN 0 AND viagens");
                t.HasCheckConstraint("ck_viagens_valores", "diarias >= 0 AND passagens >= 0 AND restituicao >= 0 AND seguro >= 0");
                t.HasCheckConstraint("ck_viagens_sigiloso", "pago_com_orgao_sigiloso BETWEEN 0 AND diarias + passagens + restituicao + seguro");
            });
            e.HasKey(x => new { x.Ano, x.OrgaoSuperior });
            e.Property(x => x.Diarias).HasPrecision(18, 2);
            e.Property(x => x.Passagens).HasPrecision(18, 2);
            e.Property(x => x.Restituicao).HasPrecision(18, 2);
            e.Property(x => x.Seguro).HasPrecision(18, 2);
            e.Property(x => x.PagoComOrgaoSigiloso).HasPrecision(18, 2);
        });

        mb.Entity<DestinoDeViagemModel>(e =>
        {
            e.ToTable("destinos_de_viagem", t =>
            {
                t.HasCheckConstraint("ck_destino_chegadas", "chegadas > 0");
                t.HasCheckConstraint("ck_destino_uf_no_brasil", "(pais = 'Brasil') = (uf IS NOT NULL)");
            });
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Ano, x.OrgaoSuperior, x.Pais, x.Uf, x.Cidade })
                .IsUnique().AreNullsDistinct(false).HasDatabaseName("ux_destino_de_viagem");
            e.Property(x => x.NumeroDeDiarias).HasPrecision(12, 2);
        });

        mb.Entity<ContratacoesDoOrgaoModel>(e =>
        {
            e.ToTable("contratacoes_do_orgao", t =>
            {
                t.HasCheckConstraint("ck_contratacoes_mes", "mes BETWEEN 1 AND 12");
                t.HasCheckConstraint("ck_contratacoes_contagens",
                    "contratos > 0 AND sigilosos BETWEEN 0 AND contratos AND divergentes BETWEEN 0 AND contratos");
                t.HasCheckConstraint("ck_contratacoes_descartado", "valor_descartado >= 0 AND (divergentes > 0 OR valor_descartado = 0)");
            });
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Ano, x.Mes, x.OrgaoSuperior, x.Modalidade }).IsUnique().HasDatabaseName("ux_contratacoes_mes_orgao_modalidade");
            e.Property(x => x.Valor).HasPrecision(18, 2);
            e.Property(x => x.ValorDescartado).HasPrecision(18, 2);
        });

        mb.Entity<ContratadoDoGovernoModel>(e =>
        {
            e.ToTable("contratados_do_governo", t =>
            {
                t.HasCheckConstraint("ck_contratado_cnpj", "cnpj ~ '^[0-9]{14}$'");
                t.HasCheckConstraint("ck_contratado_contratos", "contratos > 0");
            });
            e.HasKey(x => new { x.Ano, x.Cnpj });
            e.Property(x => x.Cnpj).HasMaxLength(14);
            e.Property(x => x.Valor).HasPrecision(18, 2);
        });

        mb.Entity<SancaoDeEmpresaModel>(e =>
        {
            e.ToTable("sancoes_de_empresas", t =>
            {
                t.HasCheckConstraint("ck_sancao_cadastro", "cadastro IN ('CEIS','CNEP')");
                t.HasCheckConstraint("ck_sancao_cnpj", "cnpj ~ '^[0-9]{14}$'");
                t.HasCheckConstraint("ck_sancao_esfera", "esfera IS NULL OR esfera IN ('FEDERAL','ESTADUAL','MUNICIPAL')");
                t.HasCheckConstraint("ck_sancao_periodo", "fim IS NULL OR inicio IS NULL OR fim >= inicio");
                t.HasCheckConstraint("ck_sancao_multa", "valor_da_multa IS NULL OR cadastro = 'CNEP'");
            });
            e.HasKey(x => new { x.Cadastro, x.CodigoDaSancao });
            e.HasIndex(x => x.Cnpj).HasDatabaseName("ix_sancao_cnpj");
            e.Property(x => x.Cadastro).HasMaxLength(4);
            e.Property(x => x.Cnpj).HasMaxLength(14);
            e.Property(x => x.Esfera).HasMaxLength(9);
            e.Property(x => x.ValorDaMulta).HasPrecision(18, 2);
        });

        mb.Entity<CompraCentralizadaNoCartaoModel>(e =>
        {
            e.ToTable("compras_centralizadas_no_cartao", t =>
            {
                t.HasCheckConstraint("ck_cpcc_mes", "mes BETWEEN 1 AND 12");
                t.HasCheckConstraint("ck_cpcc_transacoes", "transacoes > 0");
            });
            e.HasKey(x => new { x.Ano, x.Mes, x.OrgaoSuperior });
            e.Property(x => x.Valor).HasPrecision(18, 2);
        });

        mb.Entity<ReceitaPorOrigemModel>(e =>
        {
            e.ToTable("receitas_por_origem");
            e.HasKey(x => new { x.Ano, x.Categoria, x.Origem });
            e.Property(x => x.Prevista).HasPrecision(18, 2);
            e.Property(x => x.Realizada).HasPrecision(18, 2);
        });

        mb.Entity<MunicipioModel>(e =>
        {
            e.ToTable("municipios", t =>
            {
                t.HasCheckConstraint("ck_municipio_ibge", "codigo_ibge ~ '^[0-9]{7}$'");
                t.HasCheckConstraint("ck_municipio_tom", "codigo_tom ~ '^[0-9]{4}$'");
                t.HasCheckConstraint("ck_municipio_uf", "uf ~ '^[A-Z]{2}$'");
                t.HasCheckConstraint("ck_municipio_nome", "nome <> ''");
                t.HasCheckConstraint("ck_municipio_populacao",
                    "(populacao IS NULL AND populacao_ano IS NULL) OR (populacao > 0 AND populacao_ano BETWEEN 2000 AND 2100)");
            });
            e.HasKey(x => x.CodigoIbge);
            e.Property(x => x.CodigoIbge).HasMaxLength(7);
            e.Property(x => x.CodigoTom).HasMaxLength(4);
            e.Property(x => x.Uf).HasMaxLength(2);
            e.HasIndex(x => x.CodigoTom).IsUnique().HasDatabaseName("ux_municipio_tom");
        });

        mb.Entity<CnpjMunicipioModel>(e =>
        {
            e.ToTable("cnpjs_municipio", t =>
                t.HasCheckConstraint("ck_cnpj_municipio_cnpj", "cnpj ~ '^[0-9]{14}$'"));
            e.HasKey(x => x.Cnpj);
            e.Property(x => x.Cnpj).HasMaxLength(14);
            e.Property(x => x.CodigoIbge).HasMaxLength(7);
            e.HasOne(x => x.Municipio).WithMany().HasForeignKey(x => x.CodigoIbge)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.CodigoIbge).HasDatabaseName("ix_cnpj_municipio_ibge");
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
                t.HasCheckConstraint("ck_execucao_casa", "casa IN ('CAMARA','SENADO')");
                t.HasCheckConstraint(
                    "ck_execucao_status", "status IN ('EM_ANDAMENTO','CONCLUIDA','FALHOU')");
                t.HasCheckConstraint(
                    "ck_execucao_parametros",
                    "(minimo_votacoes_comuns IS NULL OR minimo_votacoes_comuns > 0)"
                    + " AND (razao_recencia IS NULL OR razao_recencia BETWEEN 0 AND 1)"
                    + " AND (peso_destaque IS NULL OR peso_destaque BETWEEN 0 AND 1)"
                    + " AND (peso_autoridade IS NULL OR peso_autoridade BETWEEN 0 AND 1)");
            });
        });

        mb.Entity<OrientacaoModel>(e =>
        {
            e.HasKey(x => new { x.VotacaoId, x.Bancada });
            e.HasOne(x => x.Votacao).WithMany()
                .HasForeignKey(x => x.VotacaoId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t => t.HasCheckConstraint(
                "ck_orientacao_valor", "orientacao IN ('Sim','Não','Obstrução','Liberado','Abstenção')"));
        });

        mb.Entity<SimilaridadeModel>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Metrica });
            e.HasOne<ExecucaoModel>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaA)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaB)
                .OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_sim_metrica", "metrica IN ('CONCORDANCIA','COSSENO')");
                t.HasCheckConstraint("ck_sim_valor", "valor BETWEEN 0 AND 1");
                t.HasCheckConstraint("ck_sim_minimo", "n_votacoes_comuns >= 20");
                t.HasCheckConstraint("ck_sim_ordem", "pessoa_a < pessoa_b");
            });
        });

        mb.Entity<ArestaGrafoModel>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaA, x.PessoaB, x.Tipo });
            e.HasOne<ExecucaoModel>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaA)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaB)
                .OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_aresta_tipo",
                    "tipo IN ('SIMILARIDADE_VOTO','COMISSAO_COMUM','COAUTORIA')");
                t.HasCheckConstraint("ck_aresta_ordem", "pessoa_a < pessoa_b");
            });
        });

        mb.Entity<NoMetricaModel>(e =>
        {
            e.HasKey(x => new { x.ExecucaoId, x.PessoaId });
            e.ToTable(t => t.HasCheckConstraint(
                "ck_no_base_disciplina", "base_disciplina IS NULL OR base_disciplina > 0"));
            e.HasOne<ExecucaoModel>().WithMany().HasForeignKey(x => x.ExecucaoId)
                .OnDelete(DeleteBehavior.Cascade);

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
            e.ToTable("segue");
            e.HasKey(x => new { x.UsuarioId, x.PessoaId });
            e.HasOne(x => x.Usuario).WithMany(u => u.Segue)
                .HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
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
            e.HasIndex(x => new { x.UsuarioId, x.Finalidade })
                .IsUnique().HasFilter("revogado_em IS NULL");
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_consentimento_finalidade", "finalidade IN ('SEGUIR_PARLAMENTARES','AVISOS_NO_NAVEGADOR')");
                t.HasCheckConstraint("ck_consentimento_versao", "length(versao) BETWEEN 1 AND 40");
            });
        });
    }

    /// <summary>Os avisos no navegador (Pendência 89): o evento da ETL, os navegadores inscritos, o que já foi avisado, quem está em exercício e quem saiu da lista de seguidos por ter deixado o mandato.</summary>
    /// <remarks>
    /// <para>O índice parcial em <c>eventos</c> é o que o worker lê: só os pendentes.</para>
    /// <para>A chave do aviso tem formato fixo (<c>A2:votacao:pessoa</c>, <c>A3:pessoa:data</c>, <c>A4:ano-mes</c>, <c>A5:ano-mes</c>), e o <c>CHECK</c> recusa outro: é pelo formato que deixar de seguir apaga as chaves daquele parlamentar.</para>
    /// </remarks>
    private static void ConfigurarAvisos(ModelBuilder mb)
    {
        mb.Entity<EventoModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.CriadoEm).HasDefaultValueSql("now()");
            e.HasIndex(x => x.CriadoEm).HasFilter("processado_em IS NULL").HasDatabaseName("ix_evento_pendente");
            e.ToTable(t => t.HasCheckConstraint("ck_evento_tipo", "tipo IN ('ROTINA_SEMANAL','ROTINA_MENSAL')"));
        });

        mb.Entity<InscricaoNoNavegadorModel>(e =>
        {
            e.ToTable("inscricoes_no_navegador", t =>
            {
                t.HasCheckConstraint("ck_inscricao_endereco", "endereco LIKE 'https://%'");
                t.HasCheckConstraint("ck_inscricao_chaves", "length(p256dh) BETWEEN 80 AND 100 AND length(auth) BETWEEN 16 AND 32");
            });
            e.HasKey(x => x.Id);
            e.HasOne<UsuarioModel>().WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.Endereco).IsUnique();
            e.Property(x => x.Endereco).HasMaxLength(1024);
            e.Property(x => x.CriadaEm).HasDefaultValueSql("now()");
        });

        mb.Entity<EmExercicioModel>(e =>
        {
            e.ToTable("em_exercicio", t => t.HasCheckConstraint("ck_em_exercicio_casa", "casa IN ('CAMARA','SENADO')"));
            e.HasKey(x => x.PessoaId);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<CargaModel>().WithMany().HasForeignKey(x => x.CargaId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Casa);
        });

        mb.Entity<SeguidoEncerradoModel>(e =>
        {
            e.ToTable("seguidos_encerrados");
            e.HasKey(x => new { x.UsuarioId, x.PessoaId });
            e.HasOne<UsuarioModel>().WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<PessoaModel>().WithMany().HasForeignKey(x => x.PessoaId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.EncerradoEm).HasDefaultValueSql("now()");
        });

        mb.Entity<AvisoEnviadoModel>(e =>
        {
            e.ToTable("avisos_enviados", t => t.HasCheckConstraint("ck_aviso_chave",
                "chave ~ '^(A2:[^:]+:[0-9]+|A3:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}|A[45]:[0-9]{4}-[0-9]{2})$'"));
            e.HasKey(x => new { x.UsuarioId, x.Chave });
            e.HasOne<UsuarioModel>().WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Chave).HasMaxLength(80);
            e.Property(x => x.EnviadoEm).HasDefaultValueSql("now()");
        });
    }

    private static void ConfigurarAvaliacao(ModelBuilder mb)
    {
        mb.Entity<AvaliacaoQuestionarioModel>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.RegistradaEm).HasDefaultValueSql("now()");

            e.ToTable(t => t.HasCheckConstraint(
                "ck_avaliacao_posicao",
                "posicao_autodeclarada IS NULL OR posicao_autodeclarada BETWEEN -3 AND 3"));
        });

    }

    /// <summary>As funções do Postgres que as consultas chamam: ver <see cref="FuncoesDoBanco"/>.</summary>
    private static void ConfigurarFuncoes(ModelBuilder mb) =>
        mb.HasDbFunction(typeof(FuncoesDoBanco).GetMethod(nameof(FuncoesDoBanco.CasaComPadrao))!)
          .HasName("regexp_like")
          .IsBuiltIn();
}
