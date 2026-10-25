using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class InteiroTeorDaProposicao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "url_inteiro_teor_carga_id",
                table: "proposicoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_proposicoes_url_inteiro_teor_carga_id",
                table: "proposicoes",
                column: "url_inteiro_teor_carga_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_proposicao_inteiro_teor",
                table: "proposicoes",
                sql: "url_inteiro_teor IS NULL OR url_inteiro_teor = '' OR url_inteiro_teor ~ '^https://[^[:space:]]+$'");

            migrationBuilder.AddForeignKey(
                name: "fk_proposicoes_cargas_url_inteiro_teor_carga_id",
                table: "proposicoes",
                column: "url_inteiro_teor_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_proposicoes_cargas_url_inteiro_teor_carga_id",
                table: "proposicoes");

            migrationBuilder.DropIndex(
                name: "ix_proposicoes_url_inteiro_teor_carga_id",
                table: "proposicoes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_proposicao_inteiro_teor",
                table: "proposicoes");

            migrationBuilder.DropColumn(
                name: "url_inteiro_teor_carga_id",
                table: "proposicoes");
        }
    }
}
