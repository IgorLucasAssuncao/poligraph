using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CotaParlamentar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "despesas",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    mes = table.Column<short>(type: "smallint", nullable: false),
                    categoria = table.Column<string>(type: "text", nullable: false),
                    fornecedor = table.Column<string>(type: "text", nullable: true),
                    cnpj_ou_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    fornecedor_eh_pessoa_fisica = table.Column<bool>(type: "boolean", nullable: false),
                    valor_liquido = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    data_emissao = table.Column<DateOnly>(type: "date", nullable: true),
                    url_documento = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_despesas", x => x.id);
                    table.CheckConstraint("ck_despesa_mes", "mes BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_despesa_valor", "valor_liquido <> 0");
                    table.ForeignKey(
                        name: "fk_despesas_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_despesa_pessoa_ano",
                table: "despesas",
                columns: new[] { "pessoa_id", "ano" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "despesas");
        }
    }
}
