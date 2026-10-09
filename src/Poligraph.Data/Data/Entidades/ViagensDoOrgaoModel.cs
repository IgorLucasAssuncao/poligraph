namespace Poligraph.Data;

/// <summary>
/// As viagens a serviço de um órgão superior do Executivo federal num ano, e quanto foi pago por elas, por tipo.
/// </summary>
/// <remarks>
/// <para>Fonte: <c>download-de-dados/viagens/AAAA</c>. As contagens saem de <c>Viagem.csv</c>; os valores, de <c>Pagamento.csv</c>, que é o que o governo pagou.</para>
/// <para>Não há valor de hospedagem: no serviço público federal a diária paga hospedagem, alimentação e deslocamento urbano (Decreto 5.992/2006).</para>
/// <para>MEDIDO (2026-10-09): em 2026, até setembro, R$ 1,34 bi pagos, dos quais R$ 235 mi com o órgão publicado como <c>Sigiloso</c>. O nome do viajante e o CPF mascarado não são lidos.</para>
/// </remarks>
public class ViagensDoOrgaoModel
{
    /// <summary>O ano do arquivo do Portal: o do início da viagem.</summary>
    public short Ano { get; set; }

    /// <summary>Como o Portal publica, inclusive <c>Sigiloso</c>.</summary>
    public required string OrgaoSuperior { get; set; }

    public int Viagens { get; set; }

    public int Urgentes { get; set; }

    public int NaoRealizadas { get; set; }

    public decimal Diarias { get; set; }

    public decimal Passagens { get; set; }

    /// <summary>Pagamento de restituição ao servidor, por despesa que ele adiantou.</summary>
    public decimal Restituicao { get; set; }

    /// <summary>Serviço correlato: seguro de viagem.</summary>
    public decimal Seguro { get; set; }

    public long? CargaId { get; set; }
}

/// <summary>Para onde as viagens a serviço foram num ano: chegadas a cada cidade, pelo trecho.</summary>
/// <remarks>
/// <para>Um trecho é uma perna da viagem; uma viagem de ida e volta tem dois. Conta chegadas, não pessoas.</para>
/// <para>No exterior o Portal não publica UF, e ela fica nula.</para>
/// </remarks>
public class DestinoDeViagemModel
{
    public long Id { get; set; }

    public short Ano { get; set; }

    public required string Pais { get; set; }

    /// <summary>Por extenso, como o Portal publica: <c>Rio Grande do Sul</c>.</summary>
    public string? Uf { get; set; }

    public required string Cidade { get; set; }

    public int Chegadas { get; set; }

    /// <summary>Soma das diárias dos trechos que chegam aqui.</summary>
    public decimal NumeroDeDiarias { get; set; }

    public long? CargaId { get; set; }
}
