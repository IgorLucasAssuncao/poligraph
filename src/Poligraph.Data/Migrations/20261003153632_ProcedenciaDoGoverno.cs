using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProcedenciaDoGoverno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "receitas_por_origem",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "orcamento_por_funcao",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "gastos_sigilosos",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "encargos_especiais",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_receitas_por_origem_carga_id",
                table: "receitas_por_origem",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_orcamento_por_funcao_carga_id",
                table: "orcamento_por_funcao",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_gastos_sigilosos_carga_id",
                table: "gastos_sigilosos",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_encargos_especiais_carga_id",
                table: "encargos_especiais",
                column: "carga_id");

            migrationBuilder.AddForeignKey(
                name: "fk_encargos_especiais_cargas_carga_id",
                table: "encargos_especiais",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_gastos_sigilosos_cargas_carga_id",
                table: "gastos_sigilosos",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_orcamento_por_funcao_cargas_carga_id",
                table: "orcamento_por_funcao",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_receitas_por_origem_cargas_carga_id",
                table: "receitas_por_origem",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_encargos_especiais_cargas_carga_id",
                table: "encargos_especiais");

            migrationBuilder.DropForeignKey(
                name: "fk_gastos_sigilosos_cargas_carga_id",
                table: "gastos_sigilosos");

            migrationBuilder.DropForeignKey(
                name: "fk_orcamento_por_funcao_cargas_carga_id",
                table: "orcamento_por_funcao");

            migrationBuilder.DropForeignKey(
                name: "fk_receitas_por_origem_cargas_carga_id",
                table: "receitas_por_origem");

            migrationBuilder.DropIndex(
                name: "ix_receitas_por_origem_carga_id",
                table: "receitas_por_origem");

            migrationBuilder.DropIndex(
                name: "ix_orcamento_por_funcao_carga_id",
                table: "orcamento_por_funcao");

            migrationBuilder.DropIndex(
                name: "ix_gastos_sigilosos_carga_id",
                table: "gastos_sigilosos");

            migrationBuilder.DropIndex(
                name: "ix_encargos_especiais_carga_id",
                table: "encargos_especiais");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "receitas_por_origem");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "orcamento_por_funcao");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "gastos_sigilosos");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "encargos_especiais");
        }
    }
}
