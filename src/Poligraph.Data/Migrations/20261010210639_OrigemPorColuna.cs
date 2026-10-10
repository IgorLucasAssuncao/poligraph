using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrigemPorColuna : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "proposicao_carga_id",
                table: "votacoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "palavras_chave_carga_id",
                table: "proposicoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "cpf_carga_id",
                table: "pessoas",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "nome_civil_carga_id",
                table: "pessoas",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "complemento_carga_id",
                table: "convenios",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_votacoes_proposicao_carga_id",
                table: "votacoes",
                column: "proposicao_carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_proposicoes_palavras_chave_carga_id",
                table: "proposicoes",
                column: "palavras_chave_carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_pessoas_cpf_carga_id",
                table: "pessoas",
                column: "cpf_carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_pessoas_nome_civil_carga_id",
                table: "pessoas",
                column: "nome_civil_carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_convenios_complemento_carga_id",
                table: "convenios",
                column: "complemento_carga_id");

            migrationBuilder.AddForeignKey(
                name: "fk_convenios_cargas_complemento_carga_id",
                table: "convenios",
                column: "complemento_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_pessoas_cargas_cpf_carga_id",
                table: "pessoas",
                column: "cpf_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_pessoas_cargas_nome_civil_carga_id",
                table: "pessoas",
                column: "nome_civil_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_proposicoes_cargas_palavras_chave_carga_id",
                table: "proposicoes",
                column: "palavras_chave_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_votacoes_cargas_proposicao_carga_id",
                table: "votacoes",
                column: "proposicao_carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_convenios_cargas_complemento_carga_id",
                table: "convenios");

            migrationBuilder.DropForeignKey(
                name: "fk_pessoas_cargas_cpf_carga_id",
                table: "pessoas");

            migrationBuilder.DropForeignKey(
                name: "fk_pessoas_cargas_nome_civil_carga_id",
                table: "pessoas");

            migrationBuilder.DropForeignKey(
                name: "fk_proposicoes_cargas_palavras_chave_carga_id",
                table: "proposicoes");

            migrationBuilder.DropForeignKey(
                name: "fk_votacoes_cargas_proposicao_carga_id",
                table: "votacoes");

            migrationBuilder.DropIndex(
                name: "ix_votacoes_proposicao_carga_id",
                table: "votacoes");

            migrationBuilder.DropIndex(
                name: "ix_proposicoes_palavras_chave_carga_id",
                table: "proposicoes");

            migrationBuilder.DropIndex(
                name: "ix_pessoas_cpf_carga_id",
                table: "pessoas");

            migrationBuilder.DropIndex(
                name: "ix_pessoas_nome_civil_carga_id",
                table: "pessoas");

            migrationBuilder.DropIndex(
                name: "ix_convenios_complemento_carga_id",
                table: "convenios");

            migrationBuilder.DropColumn(
                name: "proposicao_carga_id",
                table: "votacoes");

            migrationBuilder.DropColumn(
                name: "palavras_chave_carga_id",
                table: "proposicoes");

            migrationBuilder.DropColumn(
                name: "cpf_carga_id",
                table: "pessoas");

            migrationBuilder.DropColumn(
                name: "nome_civil_carga_id",
                table: "pessoas");

            migrationBuilder.DropColumn(
                name: "complemento_carga_id",
                table: "convenios");
        }
    }
}
