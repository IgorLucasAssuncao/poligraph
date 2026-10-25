using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class Procedencia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "votos",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "votacoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "orientacoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "cargas",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    fonte = table.Column<string>(type: "text", nullable: false),
                    url = table.Column<string>(type: "text", nullable: false),
                    baixado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    sha256 = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    bytes = table.Column<long>(type: "bigint", nullable: false),
                    etag_da_fonte = table.Column<string>(type: "text", nullable: true),
                    modificado_na_fonte = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    comando = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cargas", x => x.id);
                    table.CheckConstraint("ck_carga_bytes", "bytes >= 0");
                    table.CheckConstraint("ck_carga_fonte", "fonte IN ('CAMARA','SENADO','TSE','PORTAL_TRANSPARENCIA','RECEITA','IBGE')");
                    table.CheckConstraint("ck_carga_sha256", "sha256 ~ '^[0-9a-f]{64}$'");
                    table.CheckConstraint("ck_carga_url", "url <> ''");
                });

            migrationBuilder.CreateIndex(
                name: "ix_votos_carga_id",
                table: "votos",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_votacoes_carga_id",
                table: "votacoes",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_orientacoes_carga_id",
                table: "orientacoes",
                column: "carga_id");

            migrationBuilder.AddForeignKey(
                name: "fk_orientacoes_cargas_carga_id",
                table: "orientacoes",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_votacoes_cargas_carga_id",
                table: "votacoes",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_votos_cargas_carga_id",
                table: "votos",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_orientacoes_cargas_carga_id",
                table: "orientacoes");

            migrationBuilder.DropForeignKey(
                name: "fk_votacoes_cargas_carga_id",
                table: "votacoes");

            migrationBuilder.DropForeignKey(
                name: "fk_votos_cargas_carga_id",
                table: "votos");

            migrationBuilder.DropTable(
                name: "cargas");

            migrationBuilder.DropIndex(
                name: "ix_votos_carga_id",
                table: "votos");

            migrationBuilder.DropIndex(
                name: "ix_votacoes_carga_id",
                table: "votacoes");

            migrationBuilder.DropIndex(
                name: "ix_orientacoes_carga_id",
                table: "orientacoes");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "votos");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "votacoes");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "orientacoes");
        }
    }
}
