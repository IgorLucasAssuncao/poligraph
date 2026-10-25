using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class DeducaoComSinal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_contas_municipio_receita",
                table: "contas_dos_municipios");

            migrationBuilder.AddCheckConstraint(
                name: "ck_contas_municipio_receita",
                table: "contas_dos_municipios",
                sql: "receita_bruta >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_contas_municipio_receita",
                table: "contas_dos_municipios");

            migrationBuilder.AddCheckConstraint(
                name: "ck_contas_municipio_receita",
                table: "contas_dos_municipios",
                sql: "receita_bruta >= 0 AND deducoes >= 0");
        }
    }
}
