using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProcedenciaDoDinheiro : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "receitas_de_campanha",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "patrimonios",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "emendas_favorecidos",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "emendas",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "despesas",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "cnpjs_municipio",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "versao",
                table: "cargas",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_receitas_de_campanha_carga_id",
                table: "receitas_de_campanha",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_patrimonios_carga_id",
                table: "patrimonios",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_emendas_favorecidos_carga_id",
                table: "emendas_favorecidos",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_emendas_carga_id",
                table: "emendas",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_despesas_carga_id",
                table: "despesas",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_cnpjs_municipio_carga_id",
                table: "cnpjs_municipio",
                column: "carga_id");

            migrationBuilder.AddForeignKey(
                name: "fk_cnpjs_municipio_cargas_carga_id",
                table: "cnpjs_municipio",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_despesas_cargas_carga_id",
                table: "despesas",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_emendas_cargas_carga_id",
                table: "emendas",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_emendas_favorecidos_cargas_carga_id",
                table: "emendas_favorecidos",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_patrimonios_cargas_carga_id",
                table: "patrimonios",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_receitas_de_campanha_cargas_carga_id",
                table: "receitas_de_campanha",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_cnpjs_municipio_cargas_carga_id",
                table: "cnpjs_municipio");

            migrationBuilder.DropForeignKey(
                name: "fk_despesas_cargas_carga_id",
                table: "despesas");

            migrationBuilder.DropForeignKey(
                name: "fk_emendas_cargas_carga_id",
                table: "emendas");

            migrationBuilder.DropForeignKey(
                name: "fk_emendas_favorecidos_cargas_carga_id",
                table: "emendas_favorecidos");

            migrationBuilder.DropForeignKey(
                name: "fk_patrimonios_cargas_carga_id",
                table: "patrimonios");

            migrationBuilder.DropForeignKey(
                name: "fk_receitas_de_campanha_cargas_carga_id",
                table: "receitas_de_campanha");

            migrationBuilder.DropIndex(
                name: "ix_receitas_de_campanha_carga_id",
                table: "receitas_de_campanha");

            migrationBuilder.DropIndex(
                name: "ix_patrimonios_carga_id",
                table: "patrimonios");

            migrationBuilder.DropIndex(
                name: "ix_emendas_favorecidos_carga_id",
                table: "emendas_favorecidos");

            migrationBuilder.DropIndex(
                name: "ix_emendas_carga_id",
                table: "emendas");

            migrationBuilder.DropIndex(
                name: "ix_despesas_carga_id",
                table: "despesas");

            migrationBuilder.DropIndex(
                name: "ix_cnpjs_municipio_carga_id",
                table: "cnpjs_municipio");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "receitas_de_campanha");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "patrimonios");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "emendas_favorecidos");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "emendas");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "despesas");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "cnpjs_municipio");

            migrationBuilder.DropColumn(
                name: "versao",
                table: "cargas");
        }
    }
}
