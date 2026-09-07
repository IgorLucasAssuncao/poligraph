namespace Poligraph.Data;

/// <summary>Métricas do nó, por execução.</summary>
/// <summary>
/// Como uma bancada orientou o voto numa votação.
///
/// <para>
/// 🔴 <b>É o que permite medir governismo e disciplina.</b> Sem ela, saber que um
/// deputado votou "Sim" ⛔ não diz nada sobre alinhamento: só comparando com o que a
/// liderança dele — e a do Governo — pediu é que "Sim" vira posição.
/// </para>
///
/// <para>
/// ⚠️ <c>Bancada</c> mistura três naturezas no mesmo campo, porque a fonte mistura:
/// partido (<c>PT</c>), bloco (<c>Bl AvanSolidPrd</c>) e posição na Casa
/// (<c>Governo</c>, <c>Oposição</c>, <c>Minoria</c>, <c>Maioria</c>). Separar aqui
/// exigiria uma taxonomia nossa sobre dado da Câmara — a distinção é feita na leitura.
/// </para>
///
/// <para>
/// ⚠️ ⛔ Só existe para a CÂMARA. O Senado ⛔ não publica orientação de bancada.
/// </para>
/// </summary>
public class OrientacaoModel
{
    public required string VotacaoId { get; set; }
    public VotacaoModel? Votacao { get; set; }

    /// <summary>Partido, bloco ou posição na Casa — ver a nota da classe.</summary>
    public required string Bancada { get; set; }

    /// <summary>
    /// Sim | Não | Obstrução | Liberado | Abstenção.
    ///
    /// ⚠️ ⛔ NÃO é enum: a Câmara publica string vazia em 24% das linhas e o conjunto
    /// ⛔ não é fechado por contrato nenhum. Fechá-lo num tipo faria a ingestão inteira
    /// estourar no dia em que aparecer um valor novo — e o dado é ANUAL, então isso
    /// seria descoberto meses depois.
    /// </summary>
    public required string Orientacao { get; set; }
}
