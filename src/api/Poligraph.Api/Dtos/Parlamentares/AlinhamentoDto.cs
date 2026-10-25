using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// Com que frequência o parlamentar votou como pediram a ele.
///
/// <para>
/// Carrega a BASE junto de cada proporção. <c>80%</c> sobre 15 votações e <c>80%</c>
/// sobre 900 são afirmações de força muito diferente, e a tela nunca mostra uma sem
/// a outra — é a mesma regra da aresta do grafo.
/// </para>
///
/// <para>
/// Nulo para o Senado inteiro: lá não existe orientação de bancada publicada.
/// Zero afirmaria "nunca seguiu o governo", e o que houve foi não haver o que comparar.
/// </para>
///
/// <para>
/// As medianas são da casa inteira, no mesmo grafo (2026-10-03): "539 de 658 com o Governo" não
/// diz se é muito; a mediana ao lado dá a escala, sem juízo.
/// </para>
/// </summary>
public record AlinhamentoDto(
    double? Governismo, int BaseGovernismo,
    double? Disciplina, int BaseDisciplina,
    string? PartidoMedido,
    double? MedianaGovernismo = null,
    double? MedianaDisciplina = null);
