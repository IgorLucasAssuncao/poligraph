using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrientacaoDeBancada : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "orientacoes",
                columns: table => new
                {
                    votacao_id = table.Column<string>(type: "text", nullable: false),
                    bancada = table.Column<string>(type: "text", nullable: false),
                    orientacao = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_orientacoes", x => new { x.votacao_id, x.bancada });
                    table.CheckConstraint("ck_orientacao_nao_vazia", "orientacao <> ''");
                    table.ForeignKey(
                        name: "fk_orientacoes_votacoes_votacao_id",
                        column: x => x.votacao_id,
                        principalTable: "votacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "orientacoes");
        }
    }
}
