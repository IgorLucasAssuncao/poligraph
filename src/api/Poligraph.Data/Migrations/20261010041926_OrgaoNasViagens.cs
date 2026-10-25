using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrgaoNasViagens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_destino_de_viagem",
                table: "destinos_de_viagem");

            migrationBuilder.AddColumn<decimal>(
                name: "pago_com_orgao_sigiloso",
                table: "viagens_do_orgao",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "orgao_superior",
                table: "destinos_de_viagem",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddCheckConstraint(
                name: "ck_viagens_sigiloso",
                table: "viagens_do_orgao",
                sql: "pago_com_orgao_sigiloso BETWEEN 0 AND diarias + passagens + restituicao + seguro");

            migrationBuilder.CreateIndex(
                name: "ux_destino_de_viagem",
                table: "destinos_de_viagem",
                columns: new[] { "ano", "orgao_superior", "pais", "uf", "cidade" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_viagens_sigiloso",
                table: "viagens_do_orgao");

            migrationBuilder.DropIndex(
                name: "ux_destino_de_viagem",
                table: "destinos_de_viagem");

            migrationBuilder.DropColumn(
                name: "pago_com_orgao_sigiloso",
                table: "viagens_do_orgao");

            migrationBuilder.DropColumn(
                name: "orgao_superior",
                table: "destinos_de_viagem");

            migrationBuilder.CreateIndex(
                name: "ux_destino_de_viagem",
                table: "destinos_de_viagem",
                columns: new[] { "ano", "pais", "uf", "cidade" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);
        }
    }
}
