using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class EmendasPorArquivoEOrcamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_emenda_autor_codigo",
                table: "emendas");

            migrationBuilder.AlterColumn<string>(
                name: "codigo_emenda",
                table: "emendas",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "codigo_acao",
                table: "emendas",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codigo_municipio_ibge",
                table: "emendas",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codigo_plano_orcamentario",
                table: "emendas",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "convenios",
                columns: table => new
                {
                    numero = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    convenente = table.Column<string>(type: "text", nullable: false),
                    objeto = table.Column<string>(type: "text", nullable: true),
                    data_publicacao = table.Column<DateOnly>(type: "date", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_convenios", x => x.numero);
                    table.CheckConstraint("ck_convenio_valor", "valor > 0");
                });

            migrationBuilder.CreateTable(
                name: "emendas_favorecidos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    codigo_emenda = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    competencia = table.Column<DateOnly>(type: "date", nullable: false),
                    tipo = table.Column<string>(type: "text", nullable: false),
                    documento = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    nome = table.Column<string>(type: "text", nullable: true),
                    natureza_juridica = table.Column<string>(type: "text", nullable: true),
                    uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    municipio = table.Column<string>(type: "text", nullable: true),
                    valor = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false),
                    intermediario = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_emendas_favorecidos", x => x.id);
                    table.CheckConstraint("ck_favorecido_competencia", "EXTRACT(DAY FROM competencia) = 1");
                    table.CheckConstraint("ck_favorecido_identificacao", "(tipo = 'PESSOA_JURIDICA' AND documento ~ '^[0-9]{14}$' AND nome IS NOT NULL) OR (tipo = 'UNIDADE_GESTORA' AND documento ~ '^[0-9]{6}$' AND nome IS NOT NULL) OR (tipo IN ('PESSOA','SEM_INFORMACAO') AND documento IS NULL AND nome IS NULL)");
                    table.CheckConstraint("ck_favorecido_intermediario", "NOT intermediario OR tipo = 'PESSOA_JURIDICA'");
                    table.CheckConstraint("ck_favorecido_tipo", "tipo IN ('PESSOA_JURIDICA','UNIDADE_GESTORA','PESSOA','SEM_INFORMACAO')");
                    table.CheckConstraint("ck_favorecido_valor", "valor <> 0");
                });

            migrationBuilder.CreateTable(
                name: "orcamento_por_funcao",
                columns: table => new
                {
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    codigo_funcao = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    funcao = table.Column<string>(type: "text", nullable: false),
                    dotacao_inicial = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    dotacao_atualizada = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    empenhado = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    pago = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    empenhado_acima_da_dotacao = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    gerado_em = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_orcamento_por_funcao", x => new { x.ano, x.codigo_funcao });
                    table.CheckConstraint("ck_orcamento_acima_da_dotacao", "empenhado_acima_da_dotacao >= 0");
                    table.CheckConstraint("ck_orcamento_funcao", "codigo_funcao ~ '^[0-9]{2}$'");
                });

            migrationBuilder.CreateTable(
                name: "emendas_convenios",
                columns: table => new
                {
                    codigo_emenda = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    numero_convenio = table.Column<string>(type: "character varying(16)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_emendas_convenios", x => new { x.codigo_emenda, x.numero_convenio });
                    table.ForeignKey(
                        name: "fk_emendas_convenios_convenios_numero_convenio",
                        column: x => x.numero_convenio,
                        principalTable: "convenios",
                        principalColumn: "numero",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_emenda_codigo",
                table: "emendas",
                column: "codigo_emenda");

            migrationBuilder.CreateIndex(
                name: "ux_emenda_programacao",
                table: "emendas",
                columns: new[] { "codigo_emenda", "localidade", "codigo_acao", "codigo_plano_orcamentario" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddCheckConstraint(
                name: "ck_emenda_municipio_ibge",
                table: "emendas",
                sql: "codigo_municipio_ibge IS NULL OR codigo_municipio_ibge ~ '^[0-9]{7}$'");

            migrationBuilder.CreateIndex(
                name: "ix_emendas_convenios_numero_convenio",
                table: "emendas_convenios",
                column: "numero_convenio");

            migrationBuilder.CreateIndex(
                name: "ix_favorecido_emenda",
                table: "emendas_favorecidos",
                column: "codigo_emenda");

            migrationBuilder.CreateIndex(
                name: "ux_favorecido_pagamento",
                table: "emendas_favorecidos",
                columns: new[] { "codigo_emenda", "competencia", "tipo", "documento", "natureza_juridica", "uf", "municipio" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "emendas_convenios");

            migrationBuilder.DropTable(
                name: "emendas_favorecidos");

            migrationBuilder.DropTable(
                name: "orcamento_por_funcao");

            migrationBuilder.DropTable(
                name: "convenios");

            migrationBuilder.DropIndex(
                name: "ix_emenda_codigo",
                table: "emendas");

            migrationBuilder.DropIndex(
                name: "ux_emenda_programacao",
                table: "emendas");

            migrationBuilder.DropCheckConstraint(
                name: "ck_emenda_municipio_ibge",
                table: "emendas");

            migrationBuilder.DropColumn(
                name: "codigo_acao",
                table: "emendas");

            migrationBuilder.DropColumn(
                name: "codigo_municipio_ibge",
                table: "emendas");

            migrationBuilder.DropColumn(
                name: "codigo_plano_orcamentario",
                table: "emendas");

            migrationBuilder.AlterColumn<string>(
                name: "codigo_emenda",
                table: "emendas",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16);

            migrationBuilder.CreateIndex(
                name: "ux_emenda_autor_codigo",
                table: "emendas",
                columns: new[] { "codigo_autor", "codigo_emenda" },
                unique: true);
        }
    }
}
