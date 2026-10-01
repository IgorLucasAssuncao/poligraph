using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class PerfilDoGoverno : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "restos_a_pagar_pagos",
                table: "orcamento_por_funcao",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "encargos_especiais",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    codigo_subfuncao = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    subfuncao = table.Column<string>(type: "text", nullable: false),
                    dotacao_atualizada = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    empenhado = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    pago = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    restos_a_pagar_pagos = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_encargos_especiais", x => new { x.ano, x.codigo_subfuncao });
                    table.CheckConstraint("ck_encargo_subfuncao", "codigo_subfuncao ~ '^[0-9]{3}$'");
                });

            migrationBuilder.CreateTable(
                name: "gestoes",
                columns: table => new
                {
                    eleicao = table.Column<short>(type: "smallint", nullable: false),
                    primeiro_ano = table.Column<short>(type: "smallint", nullable: false),
                    ultimo_ano = table.Column<short>(type: "smallint", nullable: false),
                    presidente_nome = table.Column<string>(type: "text", nullable: false),
                    presidente_nome_de_urna = table.Column<string>(type: "text", nullable: false),
                    presidente_partido = table.Column<string>(type: "text", nullable: false),
                    vice_nome = table.Column<string>(type: "text", nullable: false),
                    vice_nome_de_urna = table.Column<string>(type: "text", nullable: false),
                    vice_partido = table.Column<string>(type: "text", nullable: false),
                    coligacao = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gestoes", x => x.eleicao);
                    table.CheckConstraint("ck_gestao_mandato", "ultimo_ano = primeiro_ano + 3");
                    table.CheckConstraint("ck_gestao_posse", "primeiro_ano = eleicao + 1");
                });

            migrationBuilder.CreateTable(
                name: "receitas_por_origem",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    categoria = table.Column<string>(type: "text", nullable: false),
                    origem = table.Column<string>(type: "text", nullable: false),
                    prevista = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    realizada = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    gerado_em = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_receitas_por_origem", x => new { x.ano, x.categoria, x.origem });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "encargos_especiais");

            migrationBuilder.DropTable(
                name: "gestoes");

            migrationBuilder.DropTable(
                name: "receitas_por_origem");

            migrationBuilder.DropColumn(
                name: "restos_a_pagar_pagos",
                table: "orcamento_por_funcao");
        }
    }
}
