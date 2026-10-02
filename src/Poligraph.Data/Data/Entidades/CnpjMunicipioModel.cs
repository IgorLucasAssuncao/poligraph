namespace Poligraph.Data;

/// <summary>
/// O município da sede de um CNPJ que recebeu dinheiro de emenda, segundo o cadastro da Receita.
/// </summary>
/// <remarks>
/// <para>
/// A cadeia é toda por chave forte: CNPJ → código TOM no cadastro de estabelecimentos →
/// código IBGE na tabela da Receita. Medido em 2026-09-25: 31.576 de 31.576 CNPJs
/// encontrados, e 31.574 com código IBGE — 100,00% do valor.
/// </para>
/// <para>
/// É a sede, e não necessariamente onde o dinheiro foi aplicado. Para 74,9% do valor o
/// favorecido é a prefeitura ou um fundo municipal, e a sede é a cidade; para o resto,
/// a tela diz que é a sede.
/// </para>
/// </remarks>
public class CnpjMunicipioModel
{
    public required string Cnpj { get; set; }

    public required string CodigoIbge { get; set; }

    /// <summary>O mês do cadastro da Receita de onde a sede foi lida, no primeiro dia.</summary>
    public DateOnly CadastroDe { get; set; }

    public MunicipioModel? Municipio { get; set; }

    /// <summary>A carga de onde a linha saiu (PL72). Nula nas linhas gravadas antes dela.</summary>
    public long? CargaId { get; set; }
}
