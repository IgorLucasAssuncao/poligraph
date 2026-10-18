using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class AvisosNoNavegador : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos");

            migrationBuilder.CreateTable(
                name: "avisos_enviados",
                columns: table => new
                {
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    chave = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    enviado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_avisos_enviados", x => new { x.usuario_id, x.chave });
                    table.CheckConstraint("ck_aviso_chave", "chave ~ '^(A2:[^:]+:[0-9]+|A3:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}|A[45]:[0-9]{4}-[0-9]{2})$'");
                    table.ForeignKey(
                        name: "fk_avisos_enviados_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "eventos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tipo = table.Column<string>(type: "text", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    processado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_eventos", x => x.id);
                    table.CheckConstraint("ck_evento_tipo", "tipo IN ('ROTINA_SEMANAL','ROTINA_MENSAL')");
                });

            migrationBuilder.CreateTable(
                name: "inscricoes_no_navegador",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<long>(type: "bigint", nullable: false),
                    endereco = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    p256dh = table.Column<string>(type: "text", nullable: false),
                    auth = table.Column<string>(type: "text", nullable: false),
                    criada_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inscricoes_no_navegador", x => x.id);
                    table.CheckConstraint("ck_inscricao_chaves", "length(p256dh) BETWEEN 80 AND 100 AND length(auth) BETWEEN 16 AND 32");
                    table.CheckConstraint("ck_inscricao_endereco", "endereco LIKE 'https://%'");
                    table.ForeignKey(
                        name: "fk_inscricoes_no_navegador_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos",
                sql: "finalidade IN ('SEGUIR_PARLAMENTARES','AVISOS_NO_NAVEGADOR')");

            migrationBuilder.CreateIndex(
                name: "ix_evento_pendente",
                table: "eventos",
                column: "criado_em",
                filter: "processado_em IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_inscricoes_no_navegador_endereco",
                table: "inscricoes_no_navegador",
                column: "endereco",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inscricoes_no_navegador_usuario_id",
                table: "inscricoes_no_navegador",
                column: "usuario_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "avisos_enviados");

            migrationBuilder.DropTable(
                name: "eventos");

            migrationBuilder.DropTable(
                name: "inscricoes_no_navegador");

            migrationBuilder.DropCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos");

            migrationBuilder.AddCheckConstraint(
                name: "ck_consentimento_finalidade",
                table: "consentimentos",
                sql: "finalidade IN ('SEGUIR_PARLAMENTARES')");
        }
    }
}
