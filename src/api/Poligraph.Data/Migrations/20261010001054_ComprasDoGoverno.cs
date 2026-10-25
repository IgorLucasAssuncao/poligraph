using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ComprasDoGoverno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "contratacoes_do_orgao",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    mes = table.Column<short>(type: "smallint", nullable: false),
                    orgao_superior = table.Column<string>(type: "text", nullable: false),
                    modalidade = table.Column<string>(type: "text", nullable: false),
                    contratos = table.Column<int>(type: "integer", nullable: false),
                    sigilosos = table.Column<int>(type: "integer", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    divergentes = table.Column<int>(type: "integer", nullable: false),
                    valor_descartado = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contratacoes_do_orgao", x => x.id);
                    table.CheckConstraint("ck_contratacoes_contagens", "contratos > 0 AND sigilosos BETWEEN 0 AND contratos AND divergentes BETWEEN 0 AND contratos");
                    table.CheckConstraint("ck_contratacoes_descartado", "valor_descartado >= 0 AND (divergentes > 0 OR valor_descartado = 0)");
                    table.CheckConstraint("ck_contratacoes_mes", "mes BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "fk_contratacoes_do_orgao_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "contratados_do_governo",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    cnpj = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: false),
                    nome = table.Column<string>(type: "text", nullable: false),
                    contratos = table.Column<int>(type: "integer", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contratados_do_governo", x => new { x.ano, x.cnpj });
                    table.CheckConstraint("ck_contratado_cnpj", "cnpj ~ '^[0-9]{14}$'");
                    table.CheckConstraint("ck_contratado_contratos", "contratos > 0");
                    table.ForeignKey(
                        name: "fk_contratados_do_governo_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_contratacoes_do_orgao_carga_id",
                table: "contratacoes_do_orgao",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ux_contratacoes_mes_orgao_modalidade",
                table: "contratacoes_do_orgao",
                columns: new[] { "ano", "mes", "orgao_superior", "modalidade" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_contratados_do_governo_carga_id",
                table: "contratados_do_governo",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "contratacoes_do_orgao");

            migrationBuilder.DropTable(
                name: "contratados_do_governo");
        }
    }
}
