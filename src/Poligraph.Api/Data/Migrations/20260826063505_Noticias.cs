using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Noticias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "noticias",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    url = table.Column<string>(type: "text", nullable: false),
                    titulo = table.Column<string>(type: "text", nullable: false),
                    veiculo = table.Column<string>(type: "text", nullable: false),
                    publicada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    trecho = table.Column<string>(type: "text", nullable: true),
                    hash_titulo = table.Column<string>(type: "text", nullable: false),
                    coletada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_noticias", x => x.id);
                    table.CheckConstraint("ck_noticia_trecho", "trecho IS NULL OR length(trecho) <= 500");
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "noticia_pessoas");

            migrationBuilder.DropTable(
                name: "noticia_temas");

            migrationBuilder.DropTable(
                name: "noticias");
        }
    }
}
