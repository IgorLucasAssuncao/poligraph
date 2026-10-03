namespace Poligraph.Data;

/// <summary>
/// Quanto um total da base fecha com o mesmo total na fonte, num ano: o da fonte, o da base, e o
/// que ficou fora, por motivo em <see cref="ReconciliacaoMotivoModel"/>.
/// </summary>
/// <remarks>
/// <para>Regra do autor (2026-10-02): o orçamento tem de fechar, e o que não fecha precisa de justificativa. A conta é fonte = base + soma dos motivos; o <c>conferir</c> da ETL dá ERRO se ela não fechar, ou se a base mudar depois da carga.</para>
/// <para>Recalculada a cada carga, para os anos que a carga trouxe.</para>
/// </remarks>
public class ReconciliacaoModel
{
    public long Id { get; set; }

    /// <summary><c>EMENDAS</c> (por ano da emenda), <c>PAGAMENTOS</c> (por ano do pagamento), <c>COTA_CAMARA</c> ou <c>COTA_SENADO</c>.</summary>
    public required string Conjunto { get; set; }

    /// <summary><c>EMPENHADO</c> e <c>PAGO</c> nas emendas; <c>RECEBIDO</c> nos pagamentos; <c>VALOR_LIQUIDO</c> na cota.</summary>
    public required string Medida { get; set; }

    public short Ano { get; set; }

    public decimal TotalNaFonte { get; set; }

    public decimal TotalNaBase { get; set; }

    /// <summary>A parte da base com autoria inferida (a bancada pela UF, Pendência 81). Já está dentro de <see cref="TotalNaBase"/>.</summary>
    public decimal TotalInferido { get; set; }

    public long? CargaId { get; set; }

    public DateTimeOffset CalculadoEm { get; set; }

    public List<ReconciliacaoMotivoModel> Motivos { get; set; } = [];
}

/// <summary>Um motivo de parte do total da fonte ter ficado fora da base, com o valor.</summary>
public class ReconciliacaoMotivoModel
{
    public long ReconciliacaoId { get; set; }

    public required string Motivo { get; set; }

    public decimal Valor { get; set; }
}
