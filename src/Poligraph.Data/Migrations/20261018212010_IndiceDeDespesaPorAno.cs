using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class IndiceDeDespesaPorAno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_despesa_ano",
                table: "despesas",
                column: "ano")
                .Annotation("Npgsql:IndexInclude", new[] { "valor_liquido" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_despesa_ano",
                table: "despesas");
        }
    }
}
