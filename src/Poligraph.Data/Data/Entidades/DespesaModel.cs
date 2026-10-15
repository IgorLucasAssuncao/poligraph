namespace Poligraph.Data;

/// <summary>Uma rodada do ETL analítico. Dá reprodutibilidade às figuras do TCC.</summary>
/// <summary>
/// Uma despesa da cota parlamentar (CEAP).
///
/// Vem do arquivo em bloco `www.camara.leg.br/cotas/Ano-{ano}.csv.zip`, NÃO da
/// API — `/deputados/{id}/despesas` responde 200 e devolve lista vazia para todo
/// deputado e todo ano testado. Ver <see href="../../docs/14-fontes-de-gasto.md"/>.
///
/// Liga a `pessoas` por `ideCadastro`, que é o MESMO id da Câmara que o projeto já
/// usa em `pessoa_fonte_ids` — a ligação sai de graça.
/// </summary>
public class DespesaModel
{
    public long Id { get; set; }
    public long PessoaId { get; set; }

    public short Ano { get; set; }
    public short Mes { get; set; }

    /// <summary>A subcota — "PASSAGEM AÉREA", "COMBUSTÍVEIS", "DIVULGAÇÃO…"</summary>
    public required string Categoria { get; set; }

    public string? Fornecedor { get; set; }

    /// <summary>
    /// CNPJ do fornecedor **ou hash**, quando é pessoa física.
    ///
    /// O campo `txtCNPJCPF` do CSV mistura os dois: fornecedor pessoa jurídica traz
    /// CNPJ, fornecedor pessoa física traz **CPF em claro**. A RNF-13 proíbe guardar CPF
    /// assim, então o ETL aplica o mesmo hash de `PessoaModel.CpfHash` quando detecta 11
    /// dígitos. CNPJ (14 dígitos) é dado público de empresa e fica em claro.
    /// </summary>
    public string? CnpjOuHash { get; set; }

    /// <summary> `true` quando `CnpjOuHash` é hash de CPF — sem isto ninguém sabe.</summary>
    public bool FornecedorEhPessoaFisica { get; set; }

    /// <summary>Já descontada a glosa — é o que o erário efetivamente pagou.</summary>
    public decimal ValorLiquido { get; set; }

    public DateOnly? DataEmissao { get; set; }

    /// <summary>Link para o documento fiscal na Câmara. É o que torna auditável.</summary>
    public string? UrlDocumento { get; set; }

    public PessoaModel? Pessoa { get; set; }

    /// <summary>A carga de onde a linha saiu (Pendência 72). Nula nas linhas gravadas antes dela.</summary>
    public long? CargaId { get; set; }
}
