namespace Poligraph.Data;

/// <summary>
/// "Algo terminou" (Pendência 89): a última etapa da rotina da ETL grava, e o worker de
/// notificações consome. É a ideia do Outbox: um registro no próprio banco que outro processo lê.
/// </summary>
/// <remarks>
/// <para>DECISÃO (2026-10-18): o evento só existe se a rotina passou pelo <c>conferir</c>. Rotina que falhou no meio não grava nada, e ninguém é avisado sobre dado pela metade.</para>
/// <para>ATENÇÃO: não é o Outbox completo. A rotina grava uma transação por fonte, então dado e evento não saem na mesma transação; o evento é o marco de "terminou bem".</para>
/// </remarks>
public class EventoModel
{
    public long Id { get; set; }

    public TipoDeEvento Tipo { get; set; }

    public DateTimeOffset CriadoEm { get; set; }

    /// <summary>Quando o worker distribuiu os avisos. Nulo enquanto pendente.</summary>
    public DateTimeOffset? ProcessadoEm { get; set; }
}
