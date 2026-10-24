using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReconciliacaoDoGovernoFederal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_reconciliacao_conjunto",
                table: "reconciliacoes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_reconciliacao_medida",
                table: "reconciliacoes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_reconciliacao_motivo",
                table: "reconciliacao_motivos");

            migrationBuilder.AddCheckConstraint(
                name: "ck_reconciliacao_conjunto",
                table: "reconciliacoes",
                sql: "conjunto IN ('EMENDAS','PAGAMENTOS','PAGO_X_RECEBIDO','COTA_CAMARA','COTA_SENADO','GOVERNO_FEDERAL')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_reconciliacao_medida",
                table: "reconciliacoes",
                sql: "(conjunto = 'EMENDAS' AND medida IN ('EMPENHADO','PAGO')) OR (conjunto = 'PAGAMENTOS' AND medida = 'RECEBIDO') OR (conjunto = 'PAGO_X_RECEBIDO' AND medida = 'PAGO') OR (conjunto IN ('COTA_CAMARA','COTA_SENADO') AND medida = 'VALOR_LIQUIDO') OR (conjunto = 'GOVERNO_FEDERAL' AND medida = 'PAGO')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_reconciliacao_motivo",
                table: "reconciliacao_motivos",
                sql: "motivo IN ('RELATOR_SEM_AUTOR','COMISSAO_SEM_AUTOR','BANCADA_SEM_AUTOR_E_SEM_UF','INDIVIDUAL_SEM_AUTOR','OUTRA_SEM_AUTOR','INCOERENTE','PAGAMENTO_SEM_CODIGO_DE_EMENDA','EMENDA_DE_ANO_NAO_CARREGADO','EMENDA_FORA_DA_BASE','SEM_PARLAMENTAR','FORA_DO_DE_PARA','PAGO_SEM_RECEBEDOR','RECEBIDO_ACIMA_DO_PAGO','MENSAL_DIFERENTE_DO_ANUAL')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_reconciliacao_conjunto",
                table: "reconciliacoes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_reconciliacao_medida",
                table: "reconciliacoes");

            migrationBuilder.DropCheckConstraint(
                name: "ck_reconciliacao_motivo",
                table: "reconciliacao_motivos");

            migrationBuilder.AddCheckConstraint(
                name: "ck_reconciliacao_conjunto",
                table: "reconciliacoes",
                sql: "conjunto IN ('EMENDAS','PAGAMENTOS','PAGO_X_RECEBIDO','COTA_CAMARA','COTA_SENADO')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_reconciliacao_medida",
                table: "reconciliacoes",
                sql: "(conjunto = 'EMENDAS' AND medida IN ('EMPENHADO','PAGO')) OR (conjunto = 'PAGAMENTOS' AND medida = 'RECEBIDO') OR (conjunto = 'PAGO_X_RECEBIDO' AND medida = 'PAGO') OR (conjunto IN ('COTA_CAMARA','COTA_SENADO') AND medida = 'VALOR_LIQUIDO')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_reconciliacao_motivo",
                table: "reconciliacao_motivos",
                sql: "motivo IN ('RELATOR_SEM_AUTOR','COMISSAO_SEM_AUTOR','BANCADA_SEM_AUTOR_E_SEM_UF','INDIVIDUAL_SEM_AUTOR','OUTRA_SEM_AUTOR','INCOERENTE','PAGAMENTO_SEM_CODIGO_DE_EMENDA','EMENDA_DE_ANO_NAO_CARREGADO','EMENDA_FORA_DA_BASE','SEM_PARLAMENTAR','FORA_DO_DE_PARA','PAGO_SEM_RECEBEDOR','RECEBIDO_ACIMA_DO_PAGO')");
        }
    }
}
