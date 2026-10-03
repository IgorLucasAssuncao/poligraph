using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>O tamanho da base de uma casa — o que a página inicial afirma.</summary>
/// <param name="Votacoes">
/// Só as votações com voto nominal registrado: são as que o cálculo usa. Contava todas, e
/// a 51ª da Câmara afirmava 1.548 votações com 7 de voto nominal (Pendência 68).
/// </param>
/// <param name="VotacoesSemVotoNominal">
/// As que ficaram de fora de <c>Votacoes</c>: registradas pela casa sem a lista de quem
/// votou como. A tela diz quantas são, em vez de somá-las caladas.
/// </param>
public record PanoramaDaCasaDto(
    TipoCasa Casa,
    int Parlamentares,
    int Votacoes,
    int VotacoesSecretas,
    /// <summary>
    /// Votos <b>Sim</b> ou <b>Não</b> — nunca abstenção.
    ///
    /// <para>
    /// Contava <c>Valor != null</c>, que inclui a abstenção, e por isso afirmava
    /// <b>463.994</b> na Câmara quando a posição de verdade eram <b>462.867</b>. As
    /// 1.127 de diferença são exatamente as abstenções (33 no Senado).
    /// </para>
    ///
    /// <para>
    /// Abstenção NÃO é posição: a RN-03 a transforma em nulo, e
    /// <c>CalculadoraAfinidade.EComparavel</c> a exclui da conta. Exibir um número que o
    /// cálculo não usa é o defeito que este projeto persegue — plausível e errado.
    /// </para>
    /// </summary>
    int VotosComPosicao,
    int Comunidades,
    int Ligacoes,
    int VotacoesSemVotoNominal = 0,
    UltimaVotacaoDto? Ultima = null);

/// <summary>
/// A votação aberta de plenário mais recente da casa, para o painel do Início: quantos se
/// posicionaram (Sim ou Não, pelo placar da casa) e quantas cadeiras há. Sem direção, como no
/// questionário.
/// </summary>
public record UltimaVotacaoDto(DateOnly Data, string? Materia, string? Ementa, int Posicionados, int Cadeiras);
