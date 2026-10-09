using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ViagensAServico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "destinos_de_viagem",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    pais = table.Column<string>(type: "text", nullable: false),
                    uf = table.Column<string>(type: "text", nullable: true),
                    cidade = table.Column<string>(type: "text", nullable: false),
                    chegadas = table.Column<int>(type: "integer", nullable: false),
                    numero_de_diarias = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_destinos_de_viagem", x => x.id);
                    table.CheckConstraint("ck_destino_chegadas", "chegadas > 0");
                    table.CheckConstraint("ck_destino_uf_no_brasil", "(pais = 'Brasil') = (uf IS NOT NULL)");
                    table.ForeignKey(
                        name: "fk_destinos_de_viagem_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "viagens_do_orgao",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    orgao_superior = table.Column<string>(type: "text", nullable: false),
                    viagens = table.Column<int>(type: "integer", nullable: false),
                    urgentes = table.Column<int>(type: "integer", nullable: false),
                    nao_realizadas = table.Column<int>(type: "integer", nullable: false),
                    diarias = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    passagens = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    restituicao = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    seguro = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_viagens_do_orgao", x => new { x.ano, x.orgao_superior });
                    table.CheckConstraint("ck_viagens_contagens", "viagens >= 0 AND urgentes BETWEEN 0 AND viagens AND nao_realizadas BETWEEN 0 AND viagens");
                    table.CheckConstraint("ck_viagens_valores", "diarias >= 0 AND passagens >= 0 AND restituicao >= 0 AND seguro >= 0");
                    table.ForeignKey(
                        name: "fk_viagens_do_orgao_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_destinos_de_viagem_carga_id",
                table: "destinos_de_viagem",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ux_destino_de_viagem",
                table: "destinos_de_viagem",
                columns: new[] { "ano", "pais", "uf", "cidade" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_viagens_do_orgao_carga_id",
                table: "viagens_do_orgao",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "destinos_de_viagem");

            migrationBuilder.DropTable(
                name: "viagens_do_orgao");
        }
    }
}
