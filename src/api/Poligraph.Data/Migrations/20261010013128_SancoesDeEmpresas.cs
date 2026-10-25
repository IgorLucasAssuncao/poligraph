using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class SancoesDeEmpresas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sancoes_de_empresas",
                columns: table => new
                {
                    cadastro = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    codigo_da_sancao = table.Column<string>(type: "text", nullable: false),
                    cnpj = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: false),
                    nome = table.Column<string>(type: "text", nullable: false),
                    categoria = table.Column<string>(type: "text", nullable: false),
                    inicio = table.Column<DateOnly>(type: "date", nullable: true),
                    fim = table.Column<DateOnly>(type: "date", nullable: true),
                    orgao_sancionador = table.Column<string>(type: "text", nullable: false),
                    esfera = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                    fundamentacao_legal = table.Column<string>(type: "text", nullable: true),
                    valor_da_multa = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sancoes_de_empresas", x => new { x.cadastro, x.codigo_da_sancao });
                    table.CheckConstraint("ck_sancao_cadastro", "cadastro IN ('CEIS','CNEP')");
                    table.CheckConstraint("ck_sancao_cnpj", "cnpj ~ '^[0-9]{14}$'");
                    table.CheckConstraint("ck_sancao_esfera", "esfera IS NULL OR esfera IN ('FEDERAL','ESTADUAL','MUNICIPAL')");
                    table.CheckConstraint("ck_sancao_multa", "valor_da_multa IS NULL OR cadastro = 'CNEP'");
                    table.CheckConstraint("ck_sancao_periodo", "fim IS NULL OR inicio IS NULL OR fim >= inicio");
                    table.ForeignKey(
                        name: "fk_sancoes_de_empresas_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_sancao_cnpj",
                table: "sancoes_de_empresas",
                column: "cnpj");

            migrationBuilder.CreateIndex(
                name: "ix_sancoes_de_empresas_carga_id",
                table: "sancoes_de_empresas",
                column: "carga_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sancoes_de_empresas");
        }
    }
}
