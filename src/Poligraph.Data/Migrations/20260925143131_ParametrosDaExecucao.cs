using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ParametrosDaExecucao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "minimo_votacoes_comuns",
                table: "execucoes",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "peso_autoridade",
                table: "execucoes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "peso_destaque",
                table: "execucoes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "razao_recencia",
                table: "execucoes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_execucao_parametros",
                table: "execucoes",
                sql: "(minimo_votacoes_comuns IS NULL OR minimo_votacoes_comuns > 0) AND (razao_recencia IS NULL OR razao_recencia BETWEEN 0 AND 1) AND (peso_destaque IS NULL OR peso_destaque BETWEEN 0 AND 1) AND (peso_autoridade IS NULL OR peso_autoridade BETWEEN 0 AND 1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_execucao_parametros",
                table: "execucoes");

            migrationBuilder.DropColumn(
                name: "minimo_votacoes_comuns",
                table: "execucoes");

            migrationBuilder.DropColumn(
                name: "peso_autoridade",
                table: "execucoes");

            migrationBuilder.DropColumn(
                name: "peso_destaque",
                table: "execucoes");

            migrationBuilder.DropColumn(
                name: "razao_recencia",
                table: "execucoes");
        }
    }
}
