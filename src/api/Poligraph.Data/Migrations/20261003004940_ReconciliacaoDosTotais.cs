using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReconciliacaoDosTotais : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reconciliacoes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    conjunto = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    medida = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    total_na_fonte = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    total_na_base = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    total_inferido = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true),
                    calculado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reconciliacoes", x => x.id);
                    table.CheckConstraint("ck_reconciliacao_conjunto", "conjunto IN ('EMENDAS','PAGAMENTOS')");
                    table.CheckConstraint("ck_reconciliacao_medida", "(conjunto = 'EMENDAS' AND medida IN ('EMPENHADO','PAGO')) OR (conjunto = 'PAGAMENTOS' AND medida = 'RECEBIDO')");
                    table.ForeignKey(
                        name: "fk_reconciliacoes_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "reconciliacao_motivos",
                columns: table => new
                {
                    reconciliacao_id = table.Column<long>(type: "bigint", nullable: false),
                    motivo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reconciliacao_motivos", x => new { x.reconciliacao_id, x.motivo });
                    table.CheckConstraint("ck_reconciliacao_motivo", "motivo IN ('RELATOR_SEM_AUTOR','COMISSAO_SEM_AUTOR','BANCADA_SEM_AUTOR_E_SEM_UF','INDIVIDUAL_SEM_AUTOR','OUTRA_SEM_AUTOR','INCOERENTE','PAGAMENTO_SEM_CODIGO_DE_EMENDA','EMENDA_DE_ANO_NAO_CARREGADO','EMENDA_FORA_DA_BASE')");
                    table.ForeignKey(
                        name: "fk_reconciliacao_motivos_reconciliacoes_reconciliacao_id",
                        column: x => x.reconciliacao_id,
                        principalTable: "reconciliacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_reconciliacoes_carga_id",
                table: "reconciliacoes",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ux_reconciliacao",
                table: "reconciliacoes",
                columns: new[] { "conjunto", "medida", "ano" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reconciliacao_motivos");

            migrationBuilder.DropTable(
                name: "reconciliacoes");
        }
    }
}
