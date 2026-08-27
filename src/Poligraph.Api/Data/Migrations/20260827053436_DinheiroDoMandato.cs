using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DinheiroDoMandato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "autores_de_emenda",
                columns: table => new
                {
                    codigo = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    nome_autor = table.Column<string>(type: "text", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: true),
                    metodo = table.Column<string>(type: "text", nullable: false),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_autores_de_emenda", x => x.codigo);
                    table.CheckConstraint("ck_autor_metodo", "metodo IN ('AUTOMATICO','MANUAL','NAO_RESOLVIDO')");
                    table.ForeignKey(
                        name: "fk_autores_de_emenda_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "emendas",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: true),
                    codigo_autor = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    nome_autor = table.Column<string>(type: "text", nullable: false),
                    codigo_emenda = table.Column<string>(type: "text", nullable: false),
                    ano = table.Column<short>(type: "smallint", nullable: false),
                    tipo = table.Column<string>(type: "text", nullable: true),
                    localidade = table.Column<string>(type: "text", nullable: true),
                    funcao = table.Column<string>(type: "text", nullable: true),
                    subfuncao = table.Column<string>(type: "text", nullable: true),
                    valor_empenhado = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false),
                    valor_liquidado = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false),
                    valor_pago = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false),
                    valor_resto_pago = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_emendas", x => x.id);
                    table.ForeignKey(
                        name: "fk_emendas_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "receitas_de_campanha",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    ano_eleicao = table.Column<short>(type: "smallint", nullable: false),
                    fonte_receita = table.Column<string>(type: "text", nullable: false),
                    origem_receita = table.Column<string>(type: "text", nullable: true),
                    doador = table.Column<string>(type: "text", nullable: true),
                    doador_cnpj_ou_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    doador_eh_pessoa_fisica = table.Column<bool>(type: "boolean", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_receitas_de_campanha", x => x.id);
                    table.CheckConstraint("ck_receita_valor", "valor <> 0");
                    table.ForeignKey(
                        name: "fk_receitas_de_campanha_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_autores_de_emenda_pessoa_id",
                table: "autores_de_emenda",
                column: "pessoa_id");

            migrationBuilder.CreateIndex(
                name: "ix_emenda_pessoa",
                table: "emendas",
                column: "pessoa_id");

            migrationBuilder.CreateIndex(
                name: "ux_emenda_autor_codigo",
                table: "emendas",
                columns: new[] { "codigo_autor", "codigo_emenda" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_receita_pessoa_eleicao",
                table: "receitas_de_campanha",
                columns: new[] { "pessoa_id", "ano_eleicao" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "autores_de_emenda");

            migrationBuilder.DropTable(
                name: "emendas");

            migrationBuilder.DropTable(
                name: "receitas_de_campanha");
        }
    }
}
