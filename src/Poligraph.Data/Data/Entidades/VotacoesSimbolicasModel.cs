namespace Poligraph.Data;

/// <summary>
/// Quantas votações simbólicas a casa registrou, por ano do arquivo, legislatura e órgão.
/// </summary>
/// <remarks>
/// <para>A votação simbólica não registra quem votou o quê, e por isso não entra em <c>votacoes</c> nem na comparação (achado #1). Guardar só a contagem deixa a tela dizer quanto das decisões fica fora do voto nominal (2026-10-03).</para>
/// <para>MEDIDO em 2026-10-03: no plenário da Câmara em 2025, 1.612 simbólicas e 429 nominais. É simbólica a linha do arquivo de votações sem nenhum voto contado (Sim, Não e outros iguais a zero).</para>
/// </remarks>
public class VotacoesSimbolicasModel
{
    public TipoCasa Casa { get; set; }

    /// <summary>O ano do arquivo de onde veio a contagem; recarregar o ano troca as linhas dele.</summary>
    public short Ano { get; set; }

    /// <summary>Pela data da votação: o arquivo de um ano traz janeiro, que é da legislatura anterior.</summary>
    public short Legislatura { get; set; }

    public bool Plenario { get; set; }

    public int Quantidade { get; set; }

    public long? CargaId { get; set; }
}
