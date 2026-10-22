namespace Poligraph.Data;

/// <summary>
/// Um mandato eletivo: quem foi eleito, para qual cargo, onde e em qual eleição (Pendência 90).
/// </summary>
/// <remarks>
/// <para>Vem do cadastro de candidatos do TSE, só com os eleitos. É o que dá página a quem não está no Congresso: deputado estadual e distrital, governador, prefeito e os vices.</para>
/// <para>O mandato é contado em anos, como em <see cref="GestaoModel"/>: a posse do executivo mudou de data, e um dia gravado arriscaria uma data errada. É o previsto pelo calendário; cassação e renúncia não estão aqui.</para>
/// <para>O ente depende do nível: o municipal tem município, o estadual só a UF, e presidente e vice não têm nenhum dos dois. Os <c>CHECK</c> garantem a combinação.</para>
/// </remarks>
public class MandatoModel
{
    public long Id { get; set; }

    public long PessoaId { get; set; }

    public TipoCargo Cargo { get; set; }

    public short AnoEleicao { get; set; }

    /// <summary>O identificador da candidatura no TSE. Até 2008 é único só dentro da UF e do município: a chave junta ano, UF, município, cargo e este número.</summary>
    public required string SqCandidato { get; set; }

    public short PrimeiroAno { get; set; }

    public short UltimoAno { get; set; }

    /// <summary>A UF do mandato; nula para presidente e vice.</summary>
    public string? Uf { get; set; }

    /// <summary>O código do município no TSE (<c>SG_UE</c>), como a fonte publica; só nos cargos municipais.</summary>
    public string? CodigoMunicipioTse { get; set; }

    /// <summary>O município no IBGE, casado pelo nome e pela UF. Nulo quando o nome do TSE não casou com nenhum município da Receita, e o comando avisa quais.</summary>
    public string? CodigoMunicipioIbge { get; set; }

    public required string Partido { get; set; }

    public required string NomeDeUrna { get; set; }

    /// <summary>O arquivo de candidatos do TSE que gravou a linha.</summary>
    public long? CargaId { get; set; }
}
