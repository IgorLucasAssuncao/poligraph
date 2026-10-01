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
    /// Nula quando a pessoa ainda não tem voto. Antes disto era string vazia, que era
    /// um terceiro valor da casa que o tipo agora não admite.
    /// </para>
    /// </summary>
    TipoCasa? Casa,
    string NomeCivil,
    string Partido,
    string Uf,
    /// <summary> URL na Câmara — a imagem NÃO é rehospedada.</summary>
    string? UrlFoto,
    int NVotacoes,
    /// <summary>
    /// Todos os registros de voto da legislatura, inclusive os sem posição (obstrução,
    /// ausência registrada). É o total da lista de votos, que os mostra; <c>NVotacoes</c>
    /// não os conta.
    /// </summary>
    int NRegistrosDeVoto,
    IReadOnlyList<VotoNaFichaDto> VotosRecentes,
    IReadOnlyList<SimilarNaFichaDto> MaisSimilares,
    AlinhamentoDto? Alinhamento,
    /// <summary>Em quantas votações de plenário estava. Nulo sem voto registrado na legislatura.</summary>
    PresencaDto? Presenca,
    /// <summary>A página do parlamentar na própria casa — onde tudo o que a ficha mostra pode ser conferido.</summary>
    string? UrlFonte,
    /// <summary>PP4 — as redes que o parlamentar publicou; vazia quando ⛔ publicou nenhuma.</summary>
    IReadOnlyList<RedeSocialDto> RedesSociais);
