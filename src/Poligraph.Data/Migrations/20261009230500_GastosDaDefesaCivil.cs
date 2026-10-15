using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class GastosDaDefesaCivil : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gastos_da_defesa_civil",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    mes = table.Column<short>(type: "smallint", nullable: false),
                    executor = table.Column<string>(type: "text", nullable: false),
                    uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    esfera = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                    cnpj_convenente = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    transacoes = table.Column<int>(type: "integer", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gastos_da_defesa_civil", x => x.id);
                    table.CheckConstraint("ck_defesa_civil_cnpj", "cnpj_convenente ~ '^[0-9]{14}$'");
                    table.CheckConstraint("ck_defesa_civil_esfera", "esfera IN ('MUNICIPAL','ESTADUAL','NAO_INFORMADA')");
                    table.CheckConstraint("ck_defesa_civil_mes", "mes BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_defesa_civil_transacoes", "transacoes > 0");
                    table.CheckConstraint("ck_defesa_civil_uf", "(esfera = 'NAO_INFORMADA' AND uf IS NULL) OR (esfera <> 'NAO_INFORMADA' AND uf ~ '^[A-Z]{2}$')");
                    table.ForeignKey(
                        name: "fk_gastos_da_defesa_civil_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_gastos_da_defesa_civil_carga_id",
                table: "gastos_da_defesa_civil",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ux_defesa_civil_mes_executor",
                table: "gastos_da_defesa_civil",
                columns: new[] { "ano", "mes", "executor", "uf", "cnpj_convenente" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gastos_da_defesa_civil");
        }
    }
}
