using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ComprasCentralizadasNoCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "compras_centralizadas_no_cartao",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    mes = table.Column<short>(type: "smallint", nullable: false),
                    orgao_superior = table.Column<string>(type: "text", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    transacoes = table.Column<int>(type: "integer", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_compras_centralizadas_no_cartao", x => new { x.ano, x.mes, x.orgao_superior });
                    table.CheckConstraint("ck_cpcc_mes", "mes BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_cpcc_transacoes", "transacoes > 0");
                    table.ForeignKey(
                        name: "fk_compras_centralizadas_no_cartao_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_compras_centralizadas_no_cartao_carga_id",
                table: "compras_centralizadas_no_cartao",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "compras_centralizadas_no_cartao");
        }
    }
}
