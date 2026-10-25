namespace Poligraph.Data;

/// <summary>
/// Uma receita de campanha eleitoral — inclui o **fundo eleitoral**.
///
/// Liga a `pessoas` por **hash de CPF**, que é chave forte: o teste contra o Amapá
/// casou **15 de 15**, contra 14 de 15 do nome civil.
///
/// Fonte: `prestacao_de_contas_eleitorais_candidatos_{ano}.zip` do TSE — 377 MB,
/// Latin-1, um CSV por UF. Ver <see href="../../docs/14-fontes-de-gasto.md"/>.
/// </summary>
public class ReceitaDeCampanhaModel
{
    public long Id { get; set; }
    public long PessoaId { get; set; }

    /// <summary>Ano da ELEIÇÃO, não do exercício. 2022 elegeu a legislatura 57.</summary>
    public short AnoEleicao { get; set; }

    /// <summary>
    /// O "fundão" — FEFC, criado em 2017.
    ///
    /// **O valor tem de ser idêntico ao de `receitas.FUNDO_ESPECIAL` no ETL Python**,
    /// que é quem grava a coluna. Divergir de uma letra faria o total do fundão sair
    /// **zero** na ficha, sem erro nenhum. `test_contrato_schema.py` compara os dois.
    /// </summary>
    public const string FonteFundoEspecial = "FUNDO ESPECIAL";

    /// <summary> Fundo **Partidário** — permanente, NÃO é o fundão.</summary>
    public const string FonteFundoPartidario = "FUNDO PARTIDARIO";

    /// <summary>
    /// <see cref="FonteFundoEspecial"/> é o "fundão"; <see cref="FonteFundoPartidario"/>
    /// é outro fundo.
    ///
    /// O CSV os separa, e somá-los como "dinheiro público de campanha" é defensável
    /// mas precisa ser dito — não são a mesma coisa.
    /// </summary>
    public required string FonteReceita { get; set; }

    /// <summary>"Recursos de partido político", "Recursos de pessoas físicas"…</summary>
    public string? OrigemReceita { get; set; }

    public string? Doador { get; set; }

    /// <summary> CNPJ do doador **ou hash**, quando pessoa física — como em `DespesaModel`.</summary>
    public string? DoadorCnpjOuHash { get; set; }

    public bool DoadorEhPessoaFisica { get; set; }

    public decimal Valor { get; set; }

    public PessoaModel? Pessoa { get; set; }

    /// <summary>A carga de onde a linha saiu (Pendência 72). Nula nas linhas gravadas antes dela.</summary>
    public long? CargaId { get; set; }
}
