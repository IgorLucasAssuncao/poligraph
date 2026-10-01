using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class PresencaNoVoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "presenca",
                table: "votos",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE votos SET presenca = 'PRESENTE'
                  FROM votacoes
                 WHERE votos.votacao_id = votacoes.id AND votacoes.casa = 'CAMARA'
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_voto_posicao_presente",
                table: "votos",
                sql: "valor IS NULL OR presenca IS NULL OR presenca = 'PRESENTE'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_voto_presenca",
                table: "votos",
                sql: "presenca IS NULL OR presenca IN ('PRESENTE','AUSENTE_JUSTIFICADO','AUSENTE')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_voto_posicao_presente",
                table: "votos");

            migrationBuilder.DropCheckConstraint(
                name: "ck_voto_presenca",
                table: "votos");

            migrationBuilder.DropColumn(
                name: "presenca",
                table: "votos");
        }
    }
}
