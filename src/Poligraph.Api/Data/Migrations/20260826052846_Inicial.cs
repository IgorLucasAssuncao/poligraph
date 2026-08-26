using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "execucoes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    casa = table.Column<string>(type: "text", nullable: false),
                    legislatura = table.Column<short>(type: "smallint", nullable: false),
                    k = table.Column<short>(type: "smallint", nullable: false),
                    versao_carga = table.Column<string>(type: "text", nullable: false),
                    iniciada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    concluida_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_execucoes", x => x.id);
                    table.CheckConstraint("ck_execucao_status", "status IN ('EM_ANDAMENTO','CONCLUIDA','FALHOU')");
                });

            migrationBuilder.CreateTable(
                name: "pessoas",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nome_civil = table.Column<string>(type: "text", nullable: false),
                    nome_exibicao = table.Column<string>(type: "text", nullable: false),
                    data_nascimento = table.Column<DateOnly>(type: "date", nullable: true),
                    sexo = table.Column<string>(type: "text", nullable: true),
                    cpf_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pessoas", x => x.id);
                    table.CheckConstraint("ck_pessoa_sexo", "sexo IS NULL OR sexo IN ('M','F')");
                });

            migrationBuilder.CreateTable(
                name: "proposicoes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false),
                    sigla_tipo = table.Column<string>(type: "text", nullable: true),
                    numero = table.Column<int>(type: "integer", nullable: true),
                    ano = table.Column<short>(type: "smallint", nullable: true),
                    ementa = table.Column<string>(type: "text", nullable: true),
                    url_inteiro_teor = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proposicoes", x => x.id);
                    table.CheckConstraint("ck_proposicao_ano", "ano IS NULL OR ano <> 0");
                });

            migrationBuilder.CreateTable(
                name: "usuarios",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    google_sub = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    email_verificado = table.Column<bool>(type: "boolean", nullable: false),
                    nome = table.Column<string>(type: "text", nullable: true),
                    primeiro_nome = table.Column<string>(type: "text", nullable: true),
                    sobrenome = table.Column<string>(type: "text", nullable: true),
                    foto_url = table.Column<string>(type: "text", nullable: true),
                    locale = table.Column<string>(type: "text", nullable: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    visto_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    sessao_versao = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios", x => x.id);
                    table.CheckConstraint("ck_usuario_email", "position('@' in email) > 1");
                });

            migrationBuilder.CreateTable(
                name: "arestas_grafo",
                columns: table => new
                {
                    execucao_id = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_a = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_b = table.Column<long>(type: "bigint", nullable: false),
                    tipo = table.Column<string>(type: "text", nullable: false),
                    peso = table.Column<float>(type: "real", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_arestas_grafo", x => new { x.execucao_id, x.pessoa_a, x.pessoa_b, x.tipo });
                    table.CheckConstraint("ck_aresta_ordem", "pessoa_a < pessoa_b");
                    table.CheckConstraint("ck_aresta_tipo", "tipo IN ('SIMILARIDADE_VOTO','COMISSAO_COMUM','COAUTORIA')");
                    table.ForeignKey(
                        name: "fk_arestas_grafo_execucoes_execucao_id",
                        column: x => x.execucao_id,
                        principalTable: "execucoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "nos_metrica",
                columns: table => new
                {
                    execucao_id = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    comunidade = table.Column<short>(type: "smallint", nullable: true),
                    eixo_x = table.Column<float>(type: "real", nullable: true),
                    eixo_y = table.Column<float>(type: "real", nullable: true),
                    governismo = table.Column<float>(type: "real", nullable: true),
                    disciplina = table.Column<float>(type: "real", nullable: true),
                    n_votacoes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_nos_metrica", x => new { x.execucao_id, x.pessoa_id });
                    table.ForeignKey(
                        name: "fk_nos_metrica_execucoes_execucao_id",
                        column: x => x.execucao_id,
                        principalTable: "execucoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "similaridades",
                columns: table => new
                {
                    execucao_id = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_a = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_b = table.Column<long>(type: "bigint", nullable: false),
                    metrica = table.Column<string>(type: "text", nullable: false),
                    valor = table.Column<float>(type: "real", nullable: false),
                    n_votacoes_comuns = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_similaridades", x => new { x.execucao_id, x.pessoa_a, x.pessoa_b, x.metrica });
                    table.CheckConstraint("ck_sim_metrica", "metrica IN ('CONCORDANCIA','COSSENO')");
                    table.CheckConstraint("ck_sim_minimo", "n_votacoes_comuns >= 20");
                    table.CheckConstraint("ck_sim_ordem", "pessoa_a < pessoa_b");
                    table.CheckConstraint("ck_sim_valor", "valor BETWEEN 0 AND 1");
                    table.ForeignKey(
                        name: "fk_similaridades_execucoes_execucao_id",
                        column: x => x.execucao_id,
                        principalTable: "execucoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pessoa_fonte_ids",
                columns: table => new
                {
                    fonte = table.Column<string>(type: "text", nullable: false),
                    id_externo = table.Column<string>(type: "text", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    metodo = table.Column<string>(type: "text", nullable: false),
                    confianca = table.Column<float>(type: "real", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pessoa_fonte_ids", x => new { x.fonte, x.id_externo });
                    table.CheckConstraint("ck_confianca", "confianca IS NULL OR (confianca BETWEEN 0 AND 1)");
                    table.CheckConstraint("ck_fonte", "fonte IN ('CAMARA','SENADO','TSE')");
                    table.CheckConstraint("ck_metodo", "metodo IN ('CPF','FUZZY','MANUAL')");
                    table.ForeignKey(
                        name: "fk_pessoa_fonte_ids_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "votacoes",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    casa = table.Column<string>(type: "text", nullable: false),
                    legislatura = table.Column<short>(type: "smallint", nullable: false),
                    data = table.Column<DateOnly>(type: "date", nullable: false),
                    orgao = table.Column<string>(type: "text", nullable: true),
                    descricao = table.Column<string>(type: "text", nullable: true),
                    proposicao_id = table.Column<long>(type: "bigint", nullable: true),
                    categoria = table.Column<string>(type: "text", nullable: false),
                    secreta = table.Column<bool>(type: "boolean", nullable: false),
                    plenario = table.Column<bool>(type: "boolean", nullable: false),
                    votos_sim = table.Column<int>(type: "integer", nullable: true),
                    votos_nao = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_votacoes", x => x.id);
                    table.CheckConstraint("ck_votacao_casa", "casa IN ('CAMARA','SENADO')");
                    table.CheckConstraint("ck_votacao_categoria", "categoria IN ('PROCEDIMENTAL','DESTAQUE','SUBSTANTIVA','AUTORIDADE')");
                    table.ForeignKey(
                        name: "fk_votacoes_proposicoes_proposicao_id",
                        column: x => x.proposicao_id,
                        principalTable: "proposicoes",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "consentimentos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    finalidade = table.Column<string>(type: "text", nullable: false),
                    versao = table.Column<string>(type: "text", nullable: false),
                    aceito_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    revogado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_consentimentos", x => x.id);
                    table.CheckConstraint("ck_consentimento_finalidade", "finalidade IN ('EMAIL_NOTICIAS')");
                    table.ForeignKey(
                        name: "fk_consentimentos_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "segue",
                columns: table => new
                {
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_segue", x => new { x.usuario_id, x.pessoa_id });
                    table.ForeignKey(
                        name: "fk_segue_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_segue_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tokens_email",
                columns: table => new
                {
                    token = table.Column<string>(type: "text", nullable: false),
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    proposito = table.Column<string>(type: "text", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    usado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tokens_email", x => x.token);
                    table.CheckConstraint("ck_token_proposito", "proposito IN ('DESCADASTRO')");
                    table.ForeignKey(
                        name: "fk_tokens_email_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "perguntas",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    votacao_id = table.Column<string>(type: "text", nullable: false),
                    texto = table.Column<string>(type: "text", nullable: false),
                    polaridade = table.Column<short>(type: "smallint", nullable: false),
                    ordem = table.Column<short>(type: "smallint", nullable: false),
                    ativa = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_perguntas", x => x.id);
                    table.CheckConstraint("ck_pergunta_polaridade", "polaridade IN (-1, 1)");
                    table.ForeignKey(
                        name: "fk_perguntas_votacoes_votacao_id",
                        column: x => x.votacao_id,
                        principalTable: "votacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "votos",
                columns: table => new
                {
                    votacao_id = table.Column<string>(type: "text", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    valor = table.Column<short>(type: "smallint", nullable: true),
                    partido_no_voto = table.Column<string>(type: "text", nullable: false),
                    uf_no_voto = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_votos", x => new { x.votacao_id, x.pessoa_id });
                    table.CheckConstraint("ck_voto_valor", "valor IS NULL OR valor IN (-1, 0, 1)");
                    table.ForeignKey(
                        name: "fk_votos_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_votos_votacoes_votacao_id",
                        column: x => x.votacao_id,
                        principalTable: "votacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_consentimentos_usuario_id_finalidade",
                table: "consentimentos",
                columns: new[] { "usuario_id", "finalidade" },
                unique: true,
                filter: "revogado_em IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_perguntas_votacao_id",
                table: "perguntas",
                column: "votacao_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pessoa_fonte_ids_pessoa_id",
                table: "pessoa_fonte_ids",
                column: "pessoa_id");

            migrationBuilder.CreateIndex(
                name: "ix_segue_pessoa_id",
                table: "segue",
                column: "pessoa_id");

            migrationBuilder.CreateIndex(
                name: "ix_tokens_email_usuario_id",
                table: "tokens_email",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_google_sub",
                table: "usuarios",
                column: "google_sub",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_votacao_matriz",
                table: "votacoes",
                columns: new[] { "casa", "legislatura", "plenario", "categoria" });

            migrationBuilder.CreateIndex(
                name: "ix_votacoes_proposicao_id",
                table: "votacoes",
                column: "proposicao_id");

            migrationBuilder.CreateIndex(
                name: "ix_votos_pessoa_id",
                table: "votos",
                column: "pessoa_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "arestas_grafo");

            migrationBuilder.DropTable(
                name: "consentimentos");

            migrationBuilder.DropTable(
                name: "nos_metrica");

            migrationBuilder.DropTable(
                name: "perguntas");

            migrationBuilder.DropTable(
                name: "pessoa_fonte_ids");

            migrationBuilder.DropTable(
                name: "segue");

            migrationBuilder.DropTable(
                name: "similaridades");

            migrationBuilder.DropTable(
                name: "tokens_email");

            migrationBuilder.DropTable(
                name: "votos");

            migrationBuilder.DropTable(
                name: "execucoes");

            migrationBuilder.DropTable(
                name: "usuarios");

            migrationBuilder.DropTable(
                name: "pessoas");

            migrationBuilder.DropTable(
                name: "votacoes");

            migrationBuilder.DropTable(
                name: "proposicoes");
        }
    }
}
