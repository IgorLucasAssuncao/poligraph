using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class AutoriaInferidaDaEmenda : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "autoria_inferida",
                table: "emendas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "ck_emenda_autoria_inferida",
                table: "emendas",
                sql: "NOT autoria_inferida OR (pessoa_id IS NULL AND codigo_emenda ~ '^[0-9]+I[0-9]+$')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_emenda_autoria_inferida",
                table: "emendas");

            migrationBuilder.DropColumn(
                name: "autoria_inferida",
                table: "emendas");
        }
    }
}
