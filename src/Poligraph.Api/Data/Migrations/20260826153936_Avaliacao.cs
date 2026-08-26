using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Avaliacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "avaliacoes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    perguntas_respondidas = table.Column<int>(type: "integer", nullable: false),
                    acordos_do_primeiro = table.Column<int>(type: "integer", nullable: false),
                    comparaveis_do_primeiro = table.Column<int>(type: "integer", nullable: false),
                    acertou = table.Column<bool>(type: "boolean", nullable: true),
                    posicao_autodeclarada = table.Column<short>(type: "smallint", nullable: true),
                    registrada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_avaliacoes", x => x.id);
                    table.CheckConstraint("ck_avaliacao_posicao", "posicao_autodeclarada IS NULL OR posicao_autodeclarada BETWEEN -3 AND 3");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "avaliacoes");
        }
    }
}
