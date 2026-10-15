using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <summary>
    /// Pendência 62: tira as tabelas das notícias e do e-mail, que saíram na Pendência 61, e passa
    /// <c>consentimentos</c> a guardar o consentimento de seguir. As linhas de <c>EMAIL_NOTICIAS</c>
    /// são apagadas: a finalidade deixou de existir, e o e-mail nunca foi enviado.
    /// </summary>
    public partial class ConsentimentoDeSeguir : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "noticia_pessoas");

            migrationBuilder.DropTable(
                name: "noticia_temas");

            migrationBuilder.DropTable(
                name: "tokens_email");

            migrationBuilder.DropTable(
                name: "noticias");

            migrationBuilder.DropCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos");

            migrationBuilder.Sql("DELETE FROM consentimentos WHERE finalidade = 'EMAIL_NOTICIAS';");

            migrationBuilder.AddCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos",
                sql: "finalidade IN ('SEGUIR_PARLAMENTARES')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_consentimento_versao",
                table: "consentimentos",
                sql: "length(versao) BETWEEN 1 AND 40");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos");

            migrationBuilder.DropCheckConstraint(
                name: "ck_consentimento_versao",
                table: "consentimentos");

            migrationBuilder.CreateTable(
                name: "noticias",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    coletada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    hash_titulo = table.Column<string>(type: "text", nullable: false),
                    publicada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    titulo = table.Column<string>(type: "text", nullable: false),
                    trecho = table.Column<string>(type: "text", nullable: true),
                    url = table.Column<string>(type: "text", nullable: false),
                    veiculo = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_noticias", x => x.id);
                    table.CheckConstraint("ck_noticia_trecho", "trecho IS NULL OR length(trecho) <= 500");
                });

            migrationBuilder.CreateTable(
                name: "tokens_email",
                columns: table => new
                {
                    token = table.Column<string>(type: "text", nullable: false),
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    proposito = table.Column<string>(type: "text", nullable: false),
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
                name: "noticia_pessoas",
                columns: table => new
                {
                    noticia_id = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    confianca = table.Column<float>(type: "real", nullable: false),
                    metodo = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_noticia_pessoas", x => new { x.noticia_id, x.pessoa_id });
                    table.CheckConstraint("ck_np_confianca", "confianca BETWEEN 0 AND 1");
                    table.CheckConstraint("ck_np_metodo", "metodo IN ('NOME_COMPLETO','NOME_PARLAMENTAR','SOBRENOME')");
                    table.ForeignKey(
                        name: "fk_noticia_pessoas_noticias_noticia_id",
                        column: x => x.noticia_id,
                        principalTable: "noticias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_noticia_pessoas_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "noticia_temas",
                columns: table => new
                {
                    noticia_id = table.Column<long>(type: "bigint", nullable: false),
                    tema = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_noticia_temas", x => new { x.noticia_id, x.tema });
                    table.ForeignKey(
                        name: "fk_noticia_temas_noticias_noticia_id",
                        column: x => x.noticia_id,
                        principalTable: "noticias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos",
                sql: "finalidade IN ('EMAIL_NOTICIAS')");

            migrationBuilder.CreateIndex(
                name: "ix_noticia_pessoas_pessoa_id",
                table: "noticia_pessoas",
                column: "pessoa_id");

            migrationBuilder.CreateIndex(
                name: "ix_noticias_hash_titulo",
                table: "noticias",
                column: "hash_titulo");

            migrationBuilder.CreateIndex(
                name: "ix_noticias_publicada_em",
                table: "noticias",
                column: "publicada_em");

            migrationBuilder.CreateIndex(
                name: "ix_noticias_url",
                table: "noticias",
                column: "url",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tokens_email_usuario_id",
                table: "tokens_email",
                column: "usuario_id");
        }
    }
}
