using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class VotacoesSimbolicas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "votacoes_simbolicas",
                columns: table => new
                {
                    casa = table.Column<string>(type: "text", nullable: false),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    legislatura = table.Column<short>(type: "smallint", nullable: false),
                    plenario = table.Column<bool>(type: "boolean", nullable: false),
                    quantidade = table.Column<int>(type: "integer", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_votacoes_simbolicas", x => new { x.casa, x.ano, x.legislatura, x.plenario });
                    table.CheckConstraint("ck_simbolicas_casa", "casa IN ('CAMARA','SENADO')");
                    table.CheckConstraint("ck_simbolicas_legislatura", "legislatura BETWEEN 40 AND 70");
                    table.CheckConstraint("ck_simbolicas_quantidade", "quantidade >= 0");
                    table.ForeignKey(
                        name: "fk_votacoes_simbolicas_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_votacoes_simbolicas_carga_id",
                table: "votacoes_simbolicas",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "votacoes_simbolicas");
        }
    }
}
