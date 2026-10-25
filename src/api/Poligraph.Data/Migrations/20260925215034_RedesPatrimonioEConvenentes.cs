using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class RedesPatrimonioEConvenentes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cnpj_convenente",
                table: "convenios",
                type: "character varying(14)",
                maxLength: 14,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "situacao",
                table: "convenios",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "valor_liberado",
                table: "convenios",
                type: "numeric(16,2)",
                precision: 16,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "patrimonios",
                columns: table => new
                {
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    ano_eleicao = table.Column<short>(type: "smallint", nullable: false),
                    tipo_bem = table.Column<string>(type: "text", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(16,2)", precision: 16, scale: 2, nullable: false),
                    quantidade = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_patrimonios", x => new { x.pessoa_id, x.ano_eleicao, x.tipo_bem });
                    table.CheckConstraint("ck_patrimonio_ano", "ano_eleicao BETWEEN 2002 AND 2100 AND ano_eleicao % 2 = 0");
                    table.CheckConstraint("ck_patrimonio_quantidade", "quantidade > 0");
                    table.ForeignKey(
                        name: "fk_patrimonios_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "redes_sociais",
                columns: table => new
                {
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    url = table.Column<string>(type: "text", nullable: false),
                    rede = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    fonte = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_redes_sociais", x => new { x.pessoa_id, x.url });
                    table.CheckConstraint("ck_rede_fonte", "fonte IN ('CAMARA','TSE')");
                    table.CheckConstraint("ck_rede_tipo", "rede IN ('INSTAGRAM','FACEBOOK','X','YOUTUBE','TIKTOK','LINKEDIN','OUTRA')");
                    table.CheckConstraint("ck_rede_url", "url ~ '^https?://[^[:space:]]+$'");
                    table.ForeignKey(
                        name: "fk_redes_sociais_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_convenios_cnpj_convenente",
                table: "convenios",
                column: "cnpj_convenente");

            migrationBuilder.AddCheckConstraint(
                name: "ck_convenio_cnpj",
                table: "convenios",
                sql: "cnpj_convenente IS NULL OR cnpj_convenente ~ '^[0-9]{14}$'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "patrimonios");

            migrationBuilder.DropTable(
                name: "redes_sociais");

            migrationBuilder.DropIndex(
                name: "ix_convenios_cnpj_convenente",
                table: "convenios");

            migrationBuilder.DropCheckConstraint(
                name: "ck_convenio_cnpj",
                table: "convenios");

            migrationBuilder.DropColumn(
                name: "cnpj_convenente",
                table: "convenios");

            migrationBuilder.DropColumn(
                name: "situacao",
                table: "convenios");

            migrationBuilder.DropColumn(
                name: "valor_liberado",
                table: "convenios");
        }
    }
}
