using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class EmExercicioESeguidosEncerrados : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "em_exercicio",
                columns: table => new
                {
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    casa = table.Column<string>(type: "text", nullable: false),
                    legislatura = table.Column<short>(type: "smallint", nullable: true),
                    carga_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_em_exercicio", x => x.pessoa_id);
                    table.CheckConstraint("ck_em_exercicio_casa", "casa IN ('CAMARA','SENADO')");
                    table.ForeignKey(
                        name: "fk_em_exercicio_cargas_carga_id",
                        column: x => x.carga_id,
                        principalTable: "cargas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_em_exercicio_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "seguidos_encerrados",
                columns: table => new
                {
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    pessoa_id = table.Column<long>(type: "bigint", nullable: false),
                    encerrado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seguidos_encerrados", x => new { x.usuario_id, x.pessoa_id });
                    table.ForeignKey(
                        name: "fk_seguidos_encerrados_pessoas_pessoa_id",
                        column: x => x.pessoa_id,
                        principalTable: "pessoas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_seguidos_encerrados_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_em_exercicio_carga_id",
                table: "em_exercicio",
                column: "carga_id");

            migrationBuilder.CreateIndex(
                name: "ix_em_exercicio_casa",
                table: "em_exercicio",
                column: "casa");

            migrationBuilder.CreateIndex(
                name: "ix_seguidos_encerrados_pessoa_id",
                table: "seguidos_encerrados",
                column: "pessoa_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "em_exercicio");

            migrationBuilder.DropTable(
                name: "seguidos_encerrados");
        }
    }
}
