using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class DividaFederalESelic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas");

            migrationBuilder.CreateTable(
                name: "divida_federal",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    juros_pagos = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    amortizacao_paga = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    refinanciamento_pago = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    gerado_em = table.Column<DateOnly>(type: "date", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_divida_federal", x => x.ano);
                    table.CheckConstraint("ck_divida_ano", "ano BETWEEN 2000 AND 2100");
                    table.CheckConstraint("ck_divida_valores", "juros_pagos >= 0 AND amortizacao_paga >= 0 AND refinanciamento_pago >= 0");
                    table.ForeignKey(
                        name: "fk_divida_federal_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "selic_por_ano",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    taxa_no_ano = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    meses = table.Column<short>(type: "smallint", nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_selic_por_ano", x => x.ano);
                    table.CheckConstraint("ck_selic_ano", "ano BETWEEN 1986 AND 2100");
                    table.CheckConstraint("ck_selic_meses", "meses BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_selic_taxa", "taxa_no_ano > -100 AND taxa_no_ano < 1000");
                    table.ForeignKey(
                        name: "fk_selic_por_ano_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas",
                sql: "fonte IN ('CAMARA','SENADO','TSE','PORTAL_TRANSPARENCIA','RECEITA','IBGE','TESOURO','BANCO_CENTRAL')");

            migrationBuilder.CreateIndex(
                name: "ix_divida_federal_carga_id",
                table: "divida_federal",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_selic_por_ano_carga_id",
                table: "selic_por_ano",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "divida_federal");

            migrationBuilder.DropTable(
                name: "selic_por_ano");

            migrationBuilder.DropCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas");

            migrationBuilder.AddCheckConstraint(
                name: "ck_carga_fonte",
                table: "cargas",
                sql: "fonte IN ('CAMARA','SENADO','TSE','PORTAL_TRANSPARENCIA','RECEITA','IBGE','TESOURO')");
        }
    }
}
