using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <summary>
    /// A orientação vira valor fechado (<c>ck_orientacao_valor</c>). Antes, apaga as linhas fora dele: MEDIDO em
    /// 2026-10-24, eram só as 6.725 com o texto "nan", a célula vazia do CSV da Câmara, que a ETL devia ter descartado.
    /// </summary>
    public partial class OrientacaoFechada : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_orientacao_nao_vazia",
                table: "orientacoes");

            migrationBuilder.Sql(
                "DELETE FROM orientacoes WHERE orientacao NOT IN ('Sim','Não','Obstrução','Liberado','Abstenção');");

            migrationBuilder.AddCheckConstraint(
                name: "ck_orientacao_valor",
                table: "orientacoes",
                sql: "orientacao IN ('Sim','Não','Obstrução','Liberado','Abstenção')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_orientacao_valor",
                table: "orientacoes");

            migrationBuilder.AddCheckConstraint(
                name: "ck_orientacao_nao_vazia",
                table: "orientacoes",
                sql: "orientacao <> ''");
        }
    }
}
