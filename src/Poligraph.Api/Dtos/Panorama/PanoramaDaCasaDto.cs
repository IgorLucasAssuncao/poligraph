using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>O tamanho da base de uma casa — o que a página inicial afirma.</summary>
public record PanoramaDaCasaDto(
    TipoCasa Casa,
    int Parlamentares,
    int Votacoes,
    int VotacoesSecretas,
    /// <summary>
    /// 🔴 Votos <b>Sim</b> ou <b>Não</b> — ⛔ nunca abstenção.
    ///
    /// <para>
    /// ⚠️ Contava <c>Valor != null</c>, que inclui a abstenção, e por isso afirmava
    /// <b>463.994</b> na Câmara quando a posição de verdade eram <b>462.867</b>. As
    /// 1.127 de diferença são exatamente as abstenções (33 no Senado).
    /// </para>
    ///
    /// <para>
    /// ⛔ Abstenção ⛔ NÃO é posição: a RN-03 a transforma em nulo, e
    /// <c>CalculadoraAfinidade.EComparavel</c> a exclui da conta. Exibir um número que o
    /// cálculo ⛔ não usa é o defeito que este projeto persegue — plausível e errado.
    /// </para>
    /// </summary>
    int VotosComPosicao,
    int Comunidades,
    int Ligacoes);
