using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProposicaoPorCasa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_votacoes_proposicoes_proposicao_id",
                table: "votacoes");

            migrationBuilder.DropIndex(
                name: "ix_votacoes_proposicao_id",
                table: "votacoes");

            migrationBuilder.DropPrimaryKey(
                name: "pk_proposicoes",
                table: "proposicoes");

            // 🔴 `defaultValue: "CAMARA"`, ⛔ NÃO string vazia — que foi o que o
            //    scaffold gerou.
            //
            //    Toda proposição já gravada é da Câmara: até aqui só ela era ingerida.
            //    Com `casa = ''`, o `AddForeignKey` logo abaixo ⛔ NÃO encontraria
            //    nenhuma linha para os 1.587 vínculos existentes — a migration falharia
            //    na primeira aplicação, e num banco com dado real ela falharia DEPOIS
            //    de já ter derrubado a chave antiga.
            migrationBuilder.AddColumn<string>(
                name: "casa",
                table: "proposicoes",
                type: "text",
                nullable: false,
                defaultValue: "CAMARA");

            // ⚠️ O default existe só para preencher o que já estava lá. Mantê-lo faria
            //    um `INSERT` sem `casa` cair silenciosamente na Câmara — e uma matéria
            //    do Senado gravada assim viraria proposição da casa errada, sem erro.
            migrationBuilder.Sql("ALTER TABLE proposicoes ALTER COLUMN casa DROP DEFAULT");

            migrationBuilder.AddPrimaryKey(
                name: "ak_proposicoes_casa_id",
                table: "proposicoes",
                columns: new[] { "casa", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_votacoes_casa_proposicao_id",
                table: "votacoes",
                columns: new[] { "casa", "proposicao_id" });

            migrationBuilder.AddForeignKey(
                name: "fk_votacoes_proposicoes_casa_proposicao_id",
                table: "votacoes",
                columns: new[] { "casa", "proposicao_id" },
                principalTable: "proposicoes",
                principalColumns: new[] { "casa", "id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_votacoes_proposicoes_casa_proposicao_id",
                table: "votacoes");

            migrationBuilder.DropIndex(
                name: "ix_votacoes_casa_proposicao_id",
                table: "votacoes");

            migrationBuilder.DropPrimaryKey(
                name: "ak_proposicoes_casa_id",
                table: "proposicoes");

            migrationBuilder.DropColumn(
                name: "casa",
                table: "proposicoes");

            migrationBuilder.AddPrimaryKey(
                name: "pk_proposicoes",
                table: "proposicoes",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "ix_votacoes_proposicao_id",
                table: "votacoes",
                column: "proposicao_id");

            migrationBuilder.AddForeignKey(
                name: "fk_votacoes_proposicoes_proposicao_id",
                table: "votacoes",
                column: "proposicao_id",
                principalTable: "proposicoes",
                principalColumn: "id");
        }
    }
}
