namespace Poligraph.Data;

/// <summary>
/// Uma emenda parlamentar — o instrumento de poder orçamentário do parlamentar.
///
/// **A chave é o CÓDIGO DO AUTOR, não o nome.** O `codigoEmenda` do Portal embute
/// um identificador estável:
///
/// <code>
/// 202541840004
/// │ │ └── numeroEmenda
/// │ └─────── 4184 código do autor
/// └─────────── ano
/// </code>
///
/// **Medido:** 173 de 173 autores com código estável dentro do ano, **zero colisões**.
/// Entre 2023 e 2025, mudou para dois — e os dois viraram **senadores**, o que
/// confirma a chave: ela identifica o **mandato**, e por isso é estável dentro dele.
///
/// **`PessoaId` é ANULÁVEL de propósito.** A emenda é ingerida mesmo sem dono
/// conhecido — senador, emenda de bancada, parlamentar de outra legislatura. Perder o
/// registro por não saber ligar seria pior: o dado deixa de existir, e a reconciliação
/// futura não tem o que reconciliar.
/// </summary>
public class EmendaModel
{
    public long Id { get; set; }

    /// <summary> `null` enquanto o autor não foi reconciliado — ver o resumo acima.</summary>
    public long? PessoaId { get; set; }

    /// <summary> A chave do Portal. Serve para Câmara **e** Senado.</summary>
    public required string CodigoAutor { get; set; }

    /// <summary> Guardado para a reconciliação e para auditoria — não é chave.</summary>
    public required string NomeAutor { get; set; }

    /// <summary>Código completo do Portal — torna a linha rastreável na fonte.</summary>
    public required string CodigoEmenda { get; set; }

    public short Ano { get; set; }

    /// <summary>"EmendaModel Individual — Transferências com Finalidade Definida" etc.</summary>
    public string? Tipo { get; set; }

    /// <summary> Para ONDE o dinheiro foi — município ou "Nacional".</summary>
    public string? Localidade { get; set; }

    public string? Funcao { get; set; }
    public string? Subfuncao { get; set; }

    /// <summary>Código IBGE do município. Nulo quando o destino é UF, "Nacional" ou "MÚLTIPLO".</summary>
    public string? CodigoMunicipioIbge { get; set; }

    /// <summary>
    /// A ação orçamentária. Com o plano orçamentário e a localidade, distingue as linhas de
    /// uma mesma emenda: 55 emendas de 2023 a 2026 se repartem em mais de uma.
    /// </summary>
    public string? CodigoAcao { get; set; }

    public string? CodigoPlanoOrcamentario { get; set; }

    /// <summary> Pode ser NEGATIVO — é cancelamento de empenho.</summary>
    public decimal ValorEmpenhado { get; set; }

    public decimal ValorLiquidado { get; set; }

    /// <summary> A distância entre empenhado e pago é o que a análise procura.</summary>
    public decimal ValorPago { get; set; }

    /// <summary>
    /// Resto a pagar de exercícios ANTERIORES — pode ser muito maior que o pago do
    /// ano. Somar como se fosse do ano corrente inflaria o número na ficha.
    /// </summary>
    public decimal ValorRestoPago { get; set; }

    public PessoaModel? Pessoa { get; set; }
}
