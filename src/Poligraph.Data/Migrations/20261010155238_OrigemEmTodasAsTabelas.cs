using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrigemEmTodasAsTabelas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "redes_sociais",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "proposicoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "pessoas",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "municipios",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "gestoes",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "emendas_convenios",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "convenios",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "carga_id",
                table: "autores_de_emenda",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_redes_sociais_carga_id",
                table: "redes_sociais",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_proposicoes_carga_id",
                table: "proposicoes",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_pessoas_carga_id",
                table: "pessoas",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_municipios_carga_id",
                table: "municipios",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_gestoes_carga_id",
                table: "gestoes",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_emendas_convenios_carga_id",
                table: "emendas_convenios",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_convenios_carga_id",
                table: "convenios",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_autores_de_emenda_carga_id",
                table: "autores_de_emenda",
                column: "carga_id");

            migrationBuilder.AddForeignKey(
                name: "fk_autores_de_emenda_cargas_carga_id",
                table: "autores_de_emenda",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_convenios_cargas_carga_id",
                table: "convenios",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_emendas_convenios_cargas_carga_id",
                table: "emendas_convenios",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_gestoes_cargas_carga_id",
                table: "gestoes",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_municipios_cargas_carga_id",
                table: "municipios",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_pessoas_cargas_carga_id",
                table: "pessoas",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_proposicoes_cargas_carga_id",
                table: "proposicoes",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_redes_sociais_cargas_carga_id",
                table: "redes_sociais",
                column: "carga_id",
                principalTable: "cargas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_autores_de_emenda_cargas_carga_id",
                table: "autores_de_emenda");

            migrationBuilder.DropForeignKey(
                name: "fk_convenios_cargas_carga_id",
                table: "convenios");

            migrationBuilder.DropForeignKey(
                name: "fk_emendas_convenios_cargas_carga_id",
                table: "emendas_convenios");

            migrationBuilder.DropForeignKey(
                name: "fk_gestoes_cargas_carga_id",
                table: "gestoes");

            migrationBuilder.DropForeignKey(
                name: "fk_municipios_cargas_carga_id",
                table: "municipios");

            migrationBuilder.DropForeignKey(
                name: "fk_pessoas_cargas_carga_id",
                table: "pessoas");

            migrationBuilder.DropForeignKey(
                name: "fk_proposicoes_cargas_carga_id",
                table: "proposicoes");

            migrationBuilder.DropForeignKey(
                name: "fk_redes_sociais_cargas_carga_id",
                table: "redes_sociais");

            migrationBuilder.DropIndex(
                name: "ix_redes_sociais_carga_id",
                table: "redes_sociais");

            migrationBuilder.DropIndex(
                name: "ix_proposicoes_carga_id",
                table: "proposicoes");

            migrationBuilder.DropIndex(
                name: "ix_pessoas_carga_id",
                table: "pessoas");

            migrationBuilder.DropIndex(
                name: "ix_municipios_carga_id",
                table: "municipios");

            migrationBuilder.DropIndex(
                name: "ix_gestoes_carga_id",
                table: "gestoes");

            migrationBuilder.DropIndex(
                name: "ix_emendas_convenios_carga_id",
                table: "emendas_convenios");

            migrationBuilder.DropIndex(
                name: "ix_convenios_carga_id",
                table: "convenios");

            migrationBuilder.DropIndex(
                name: "ix_autores_de_emenda_carga_id",
                table: "autores_de_emenda");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "redes_sociais");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "proposicoes");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "pessoas");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "municipios");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "gestoes");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "emendas_convenios");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "convenios");

            migrationBuilder.DropColumn(
                name: "carga_id",
                table: "autores_de_emenda");
        }
    }
}
