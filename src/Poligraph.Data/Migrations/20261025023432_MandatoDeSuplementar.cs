using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class MandatoDeSuplementar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_mandato_anos",
                table: "mandatos");

            migrationBuilder.AddCheckConstraint(
                name: "ck_mandato_anos",
                table: "mandatos",
                sql: "primeiro_ano BETWEEN ano_eleicao + 1 AND ultimo_ano");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_mandato_anos",
                table: "mandatos");

            migrationBuilder.AddCheckConstraint(
                name: "ck_mandato_anos",
                table: "mandatos",
                sql: "primeiro_ano = ano_eleicao + 1 AND ultimo_ano >= primeiro_ano");
        }
    }
}
