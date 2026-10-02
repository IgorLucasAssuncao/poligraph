using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class BaseDaDisciplina : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "base_disciplina",
                table: "nos_metrica",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_no_base_disciplina",
                table: "nos_metrica",
                sql: "base_disciplina IS NULL OR base_disciplina > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_no_base_disciplina",
                table: "nos_metrica");

            migrationBuilder.DropColumn(
                name: "base_disciplina",
                table: "nos_metrica");
        }
    }
}
