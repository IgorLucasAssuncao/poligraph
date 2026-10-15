using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class GastosSigilosos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gastos_sigilosos",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    origem = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    orgao_superior = table.Column<string>(type: "text", nullable: false),
                    sigiloso = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    lancamentos = table.Column<int>(type: "integer", nullable: true),
                    meses = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gastos_sigilosos", x => new { x.ano, x.origem, x.orgao_superior });
                    table.CheckConstraint("ck_sigilo_base", "(origem = 'ACAO_SIGILOSA' AND total = sigiloso AND lancamentos IS NULL) OR (origem = 'CARTAO_CORPORATIVO' AND lancamentos >= 0)");
                    table.CheckConstraint("ck_sigilo_meses", "meses BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_sigilo_origem", "origem IN ('CARTAO_CORPORATIVO','ACAO_SIGILOSA')");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gastos_sigilosos");
        }
    }
}
