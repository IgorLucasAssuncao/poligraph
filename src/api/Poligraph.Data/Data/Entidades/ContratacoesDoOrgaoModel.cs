namespace Poligraph.Data;

/// <summary>
/// Os contratos que um órgão superior do Executivo federal publicou num mês, por modalidade de compra.
/// </summary>
/// <remarks>
/// <para>Fonte: <c>download-de-dados/compras/AAAAMM</c>, membro <c>Compras.csv</c>: os contratos publicados no Diário Oficial no mês.</para>
/// <para>MEDIDO (2026-10-09): os dois valores da fonte trazem erro de digitação. Jan/2025: valor inicial de R$ 1,96 tri num contrato de valor final R$ 1,4 mi. 2022: valor final de R$ 55,84 bi num contrato de valor inicial R$ 1 mi. Quando os dois diferem mais de 100 vezes, o contrato entra com o menor, e a diferença fica em <see cref="ValorDescartado"/>. 82% das linhas vêm com modalidade <c>Sem Informação</c>, que entra como está. Republicação entra de novo: 17 de 3.710 contratos de fev/2025 já estavam em jan.</para>
/// </remarks>
public class ContratacoesDoOrgaoModel
{
    public long Id { get; set; }

    /// <summary>Ano da publicação no Diário Oficial.</summary>
    public short Ano { get; set; }

    /// <summary>Mês da publicação no Diário Oficial.</summary>
    public short Mes { get; set; }

    public required string OrgaoSuperior { get; set; }

    /// <summary>Como o Portal publica: <c>Pregão</c>, <c>Dispensa de Licitação</c>, <c>Sem Informação</c>...</summary>
    public required string Modalidade { get; set; }

    public int Contratos { get; set; }

    /// <summary>Dos contratos, quantos têm contratado e objeto protegidos por sigilo.</summary>
    public int Sigilosos { get; set; }

    /// <summary>Soma do valor de cada contrato: o final, ou o menor dos dois quando divergem mais de 100 vezes. Pode ser negativa: a fonte publica valor final negativo (ago/2019, Ministério da Integração, R$ -2.133,26), e ele entra como está para a soma fechar com o arquivo.</summary>
    public decimal Valor { get; set; }

    /// <summary>Quantos contratos tinham valor inicial e final divergindo mais de 100 vezes.</summary>
    public int Divergentes { get; set; }

    /// <summary>O que o valor maior desses contratos somaria a mais: fica fora de <see cref="Valor"/> e à vista na tela.</summary>
    public decimal ValorDescartado { get; set; }

    public long? CargaId { get; set; }
}

/// <summary>Uma empresa contratada pelo Executivo federal num ano: quantos contratos e quanto, pela mesma regra de valor de <see cref="ContratacoesDoOrgaoModel"/>.</summary>
/// <remarks>
/// <para>Só CNPJ. Contratado sigiloso (<c>-11</c>) fica em <see cref="ContratacoesDoOrgaoModel.Sigilosos"/>, sem linha aqui.</para>
/// </remarks>
public class ContratadoDoGovernoModel
{
    public short Ano { get; set; }

    public required string Cnpj { get; set; }

    public required string Nome { get; set; }

    public int Contratos { get; set; }

    public decimal Valor { get; set; }

    public long? CargaId { get; set; }
}
