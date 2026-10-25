using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ApagarGestoes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gestoes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gestoes",
                columns: table => new
                {
                    eleicao = table.Column<short>(type: "smallint", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true),
                    coligacao = table.Column<string>(type: "text", nullable: true),
                    presidente_nome = table.Column<string>(type: "text", nullable: false),
                    presidente_nome_de_urna = table.Column<string>(type: "text", nullable: false),
                    presidente_partido = table.Column<string>(type: "text", nullable: false),
                    primeiro_ano = table.Column<short>(type: "smallint", nullable: false),
                    ultimo_ano = table.Column<short>(type: "smallint", nullable: false),
                    vice_nome = table.Column<string>(type: "text", nullable: false),
                    vice_nome_de_urna = table.Column<string>(type: "text", nullable: false),
                    vice_partido = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gestoes", x => x.eleicao);
                    table.CheckConstraint("ck_gestao_mandato", "ultimo_ano = primeiro_ano + 3");
                    table.CheckConstraint("ck_gestao_posse", "primeiro_ano = eleicao + 1");
                    table.ForeignKey(
                        name: "fk_gestoes_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_gestoes_carga_id",
                table: "gestoes",
                column: "carga_id");
        }
    }
}
