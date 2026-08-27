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
