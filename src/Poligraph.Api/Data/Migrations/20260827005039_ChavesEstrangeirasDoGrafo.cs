using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ChavesEstrangeirasDoGrafo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 🔴 Limpa ANTES de criar a chave, senão a migration não aplica.
            //
            // ⚠️ Não é hipótese: o banco de desenvolvimento tinha 12 linhas em
            //    `nos_metrica` apontando para parlamentares que já não existiam — foi
            //    justamente a AUSÊNCIA desta FK que permitiu que ficassem lá. Sem esta
            //    limpeza, a migration falha, o projeto de migrations morre, e o
            //    `WaitForCompletion` do Aspire trava a API atrás dele para sempre.
            //
            // ⭐ Só apaga o que JÁ ESTÁ inconsistente. Linha com pessoa existente não é
            //    tocada, então é seguro rodar em produção.
            migrationBuilder.Sql("""
                DELETE FROM nos_metrica n
                 WHERE NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = n.pessoa_id);

                DELETE FROM arestas_grafo a
                 WHERE NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = a.pessoa_a)
                    OR NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = a.pessoa_b);

                DELETE FROM similaridades s
                 WHERE NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = s.pessoa_a)
                    OR NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = s.pessoa_b);
                """);

            migrationBuilder.CreateIndex(
                name: "ix_similaridades_pessoa_a",
                table: "similaridades",
                column: "pessoa_a");

            migrationBuilder.CreateIndex(
                name: "ix_similaridades_pessoa_b",
                table: "similaridades",
                column: "pessoa_b");

            migrationBuilder.CreateIndex(
                name: "ix_nos_metrica_pessoa_id",
                table: "nos_metrica",
                column: "pessoa_id");

            migrationBuilder.CreateIndex(
                name: "ix_arestas_grafo_pessoa_a",
                table: "arestas_grafo",
                column: "pessoa_a");

            migrationBuilder.CreateIndex(
                name: "ix_arestas_grafo_pessoa_b",
                table: "arestas_grafo",
                column: "pessoa_b");

            migrationBuilder.AddForeignKey(
                name: "fk_arestas_grafo_pessoas_pessoa_a",
                table: "arestas_grafo",
                column: "pessoa_a",
                principalTable: "pessoas",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_arestas_grafo_pessoas_pessoa_b",
                table: "arestas_grafo",
                column: "pessoa_b",
                principalTable: "pessoas",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_nos_metrica_pessoas_pessoa_id",
                table: "nos_metrica",
                column: "pessoa_id",
                principalTable: "pessoas",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_similaridades_pessoas_pessoa_a",
                table: "similaridades",
                column: "pessoa_a",
                principalTable: "pessoas",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_similaridades_pessoas_pessoa_b",
                table: "similaridades",
                column: "pessoa_b",
                principalTable: "pessoas",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_arestas_grafo_pessoas_pessoa_a",
                table: "arestas_grafo");

            migrationBuilder.DropForeignKey(
                name: "fk_arestas_grafo_pessoas_pessoa_b",
                table: "arestas_grafo");

            migrationBuilder.DropForeignKey(
                name: "fk_nos_metrica_pessoas_pessoa_id",
                table: "nos_metrica");

            migrationBuilder.DropForeignKey(
                name: "fk_similaridades_pessoas_pessoa_a",
                table: "similaridades");

            migrationBuilder.DropForeignKey(
                name: "fk_similaridades_pessoas_pessoa_b",
                table: "similaridades");

            migrationBuilder.DropIndex(
                name: "ix_similaridades_pessoa_a",
                table: "similaridades");

            migrationBuilder.DropIndex(
                name: "ix_similaridades_pessoa_b",
                table: "similaridades");

            migrationBuilder.DropIndex(
                name: "ix_nos_metrica_pessoa_id",
                table: "nos_metrica");

            migrationBuilder.DropIndex(
                name: "ix_arestas_grafo_pessoa_a",
                table: "arestas_grafo");

            migrationBuilder.DropIndex(
                name: "ix_arestas_grafo_pessoa_b",
                table: "arestas_grafo");
        }
    }
}
