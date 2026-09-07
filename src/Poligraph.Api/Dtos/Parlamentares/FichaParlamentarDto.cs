using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record FichaParlamentarDto(
    long Id,
    string Nome,
    /// <summary>
    /// CAMARA ou SENADO, derivado do voto mais recente — como partido e UF.
    ///
    /// <para>
    /// Não vem de uma coluna em <c>pessoas</c>: a casa é do mandato, não da pessoa. 43
    /// nomes aparecem nas duas casas, e o deputado que virou senador deve poder ser uma
    /// pessoa só quando a ponte do achado #18 existir.
    /// </para>
    ///
    /// <para>
    /// ⭐ Nula quando a pessoa ainda não tem voto. Antes disto era string vazia, que era
    /// um terceiro valor da casa que o tipo agora ⛔ não admite.
    /// </para>
    /// </summary>
    TipoCasa? Casa,
    string NomeCivil,
    string Partido,
    string Uf,
    /// <summary>🔴 URL na Câmara — ⛔ a imagem NÃO é rehospedada.</summary>
    string? UrlFoto,
    int NVotacoes,
    IReadOnlyList<VotoNaFichaDto> VotosRecentes,
    IReadOnlyList<SimilarNaFichaDto> MaisSimilares,
    AlinhamentoDto? Alinhamento);
