using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ComponentesPrincipais : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<float>(
                name: "componente1",
                table: "nos_metrica",
                type: "real",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "componente2",
                table: "nos_metrica",
                type: "real",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "componente1",
                table: "nos_metrica");

            migrationBuilder.DropColumn(
                name: "componente2",
                table: "nos_metrica");
        }
    }
}
