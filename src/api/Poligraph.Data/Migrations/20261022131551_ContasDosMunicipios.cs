using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ContasDosMunicipios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas");

            migrationBuilder.CreateTable(
                name: "contas_dos_municipios",
                columns: table => new
                {
                    codigo_ibge = table.Column<string>(type: "character(7)", fixedLength: true, maxLength: 7, nullable: false),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    receita_bruta = table.Column<decimal>(type: "numeric", nullable: false),
                    deducoes = table.Column<decimal>(type: "numeric", nullable: false),
                    despesa_empenhada = table.Column<decimal>(type: "numeric", nullable: false),
                    despesa_paga = table.Column<decimal>(type: "numeric", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contas_dos_municipios", x => new { x.codigo_ibge, x.ano });
                    table.CheckConstraint("ck_contas_municipio_ano", "ano BETWEEN 2000 AND 2100");
                    table.CheckConstraint("ck_contas_municipio_despesa", "despesa_empenhada >= 0 AND despesa_paga >= 0");
                    table.CheckConstraint("ck_contas_municipio_receita", "receita_bruta >= 0 AND deducoes >= 0");
                    table.ForeignKey(
                        name: "fk_contas_dos_municipios_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_contas_dos_municipios_municipios_codigo_ibge",
                        column: x => x.codigo_ibge,
                        principalTable: "municipios",
                        principalColumn: "codigo_ibge",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas",
                sql: "fonte IN ('CAMARA','SENADO','TSE','PORTAL_TRANSPARENCIA','RECEITA','IBGE','TESOURO')");

            migrationBuilder.CreateIndex(
                name: "ix_contas_dos_municipios_carga_id",
                table: "contas_dos_municipios",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "contas_dos_municipios");

            migrationBuilder.DropCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas");

            migrationBuilder.AddCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas",
                sql: "fonte IN ('CAMARA','SENADO','TSE','PORTAL_TRANSPARENCIA','RECEITA','IBGE')");
        }
    }
}
