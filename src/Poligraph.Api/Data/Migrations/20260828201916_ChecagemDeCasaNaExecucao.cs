using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ChecagemDeCasaNaExecucao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_execucao_casa",
                table: "execucoes",
                sql: "casa IN ('CAMARA','SENADO')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_execucao_casa",
                table: "execucoes");
        }
    }
}
