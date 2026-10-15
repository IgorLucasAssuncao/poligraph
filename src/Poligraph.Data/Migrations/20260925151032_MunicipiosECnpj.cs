using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class MunicipiosECnpj : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "municipios",
                columns: table => new
                {
                    codigo_ibge = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    codigo_tom = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    nome = table.Column<string>(type: "text", nullable: false),
                    uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_municipios", x => x.codigo_ibge);
                    table.CheckConstraint("ck_municipio_ibge", "codigo_ibge ~ '^[0-9]{7}$'");
                    table.CheckConstraint("ck_municipio_tom", "codigo_tom ~ '^[0-9]{4}$'");
                    table.CheckConstraint("ck_municipio_uf", "uf ~ '^[A-Z]{2}$'");
                });

            migrationBuilder.CreateTable(
                name: "cnpjs_municipio",
                columns: table => new
                {
                    cnpj = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: false),
                    codigo_ibge = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    cadastro_de = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnpjs_municipio", x => x.cnpj);
                    table.CheckConstraint("ck_cnpj_municipio_cnpj", "cnpj ~ '^[0-9]{14}$'");
                    table.ForeignKey(
                        name: "fk_cnpjs_municipio_municipios_codigo_ibge",
                        column: x => x.codigo_ibge,
                        principalTable: "municipios",
                        principalColumn: "codigo_ibge",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_cnpj_municipio_ibge",
                table: "cnpjs_municipio",
                column: "codigo_ibge");

            migrationBuilder.CreateIndex(
                name: "ux_municipio_tom",
                table: "municipios",
                column: "codigo_tom",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cnpjs_municipio");

            migrationBuilder.DropTable(
                name: "municipios");
        }
    }
}
