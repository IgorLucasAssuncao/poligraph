using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class Mandatos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "titulo_hash",
                table: "pessoas",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "mandatos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    cargo = table.Column<string>(type: "text", nullable: false),
                    ano_eleicao = table.Column<short>(type: "smallint", nullable: false),
                    sq_candidato = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    primeiro_ano = table.Column<short>(type: "smallint", nullable: false),
                    ultimo_ano = table.Column<short>(type: "smallint", nullable: false),
                    uf = table.Column<string>(type: "character(2)", fixedLength: true, maxLength: 2, nullable: true),
                    codigo_municipio_tse = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    codigo_municipio_ibge = table.Column<string>(type: "character(7)", fixedLength: true, maxLength: 7, nullable: true),
                    partido = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    nome_de_urna = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    carga_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_mandatos", x => x.id);
                    table.CheckConstraint("ck_mandato_anos", "primeiro_ano = ano_eleicao + 1 AND ultimo_ano >= primeiro_ano");
                    table.CheckConstraint("ck_mandato_cargo", "cargo IN ('PRESIDENTE','VICE_PRESIDENTE','SENADOR','DEPUTADO_FEDERAL','GOVERNADOR','VICE_GOVERNADOR','DEPUTADO_ESTADUAL','DEPUTADO_DISTRITAL','PREFEITO','VICE_PREFEITO')");
                    table.CheckConstraint("ck_mandato_eleicao", "ano_eleicao BETWEEN 1994 AND 2100 AND ano_eleicao % 2 = 0");
                    table.CheckConstraint("ck_mandato_ente", "CASE WHEN cargo IN ('PREFEITO','VICE_PREFEITO') THEN uf IS NOT NULL AND codigo_municipio_tse IS NOT NULL WHEN cargo IN ('PRESIDENTE','VICE_PRESIDENTE') THEN uf IS NULL AND codigo_municipio_tse IS NULL AND codigo_municipio_ibge IS NULL ELSE uf IS NOT NULL AND codigo_municipio_tse IS NULL AND codigo_municipio_ibge IS NULL END");
                    table.CheckConstraint("ck_mandato_uf", "uf IS NULL OR uf ~ '^[A-Z]{2}$'");
                    table.ForeignKey(
                        name: "fk_mandatos_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_mandatos_municipios_codigo_municipio_ibge",
                        column: x => x.codigo_municipio_ibge,
                        principalTable: "municipios",
                        principalColumn: "codigo_ibge",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_mandatos_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_pessoas_titulo_hash",
                table: "pessoas",
                column: "titulo_hash",
                filter: "titulo_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_mandatos_ano_eleicao_uf_codigo_municipio_tse_cargo_sq_candi",
                table: "mandatos",
                columns: new[] { "ano_eleicao", "uf", "codigo_municipio_tse", "cargo", "sq_candidato" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_mandatos_carga_id",
                table: "mandatos",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_mandatos_cargo_uf",
                table: "mandatos",
                columns: new[] { "cargo", "uf" });

            migrationBuilder.CreateIndex(
                name: "ix_mandatos_codigo_municipio_ibge",
                table: "mandatos",
                column: "codigo_municipio_ibge");

            migrationBuilder.CreateIndex(
                name: "ix_mandatos_pessoa_id",
                table: "mandatos",
                column: "pessoa_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mandatos");

            migrationBuilder.DropIndex(
                name: "ix_pessoas_titulo_hash",
                table: "pessoas");

            migrationBuilder.DropColumn(
                name: "titulo_hash",
                table: "pessoas");
        }
    }
}
