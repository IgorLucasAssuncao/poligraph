using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrigemDaPopulacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "populacao_carga_id",
                table: "municipios",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_municipios_populacao_carga_id",
                table: "municipios",
                column: "populacao_carga_id");

            migrationBuilder.AddForeignKey(
                name: "fk_municipios_cargas_populacao_carga_id",
                table: "municipios",
                column: "populacao_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_municipios_cargas_populacao_carga_id",
                table: "municipios");

            migrationBuilder.DropIndex(
                name: "ix_municipios_populacao_carga_id",
                table: "municipios");

            migrationBuilder.DropColumn(
                name: "populacao_carga_id",
                table: "municipios");
        }
    }
}
