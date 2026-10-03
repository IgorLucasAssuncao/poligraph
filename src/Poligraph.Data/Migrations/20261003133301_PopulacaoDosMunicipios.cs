using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class PopulacaoDosMunicipios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "populacao",
                table: "municipios",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "populacao_ano",
                table: "municipios",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_municipio_populacao",
                table: "municipios",
                sql: "(populacao IS NULL AND populacao_ano IS NULL) OR (populacao > 0 AND populacao_ano BETWEEN 2000 AND 2100)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_municipio_populacao",
                table: "municipios");

            migrationBuilder.DropColumn(
                name: "populacao",
                table: "municipios");

            migrationBuilder.DropColumn(
                name: "populacao_ano",
                table: "municipios");
        }
    }
}
