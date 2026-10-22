using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>Um mandato do TSE: o cargo, o ente e os anos (Pendência 90).</summary>
/// <param name="Municipio">Só nos cargos municipais, e nulo quando o município do TSE não casou com o IBGE.</param>
public record MandatoNoTseDto(
    TipoCargo Cargo, TipoNivel Nivel, short AnoEleicao, short PrimeiroAno, short UltimoAno,
    string? Uf, MunicipioDto? Municipio, string Partido);

/// <summary>Um político na lista e na busca, com o mandato que responde ao filtro.</summary>
/// <param name="Mandato">O mais recente entre os que passam no filtro.</param>
/// <param name="Mandatos">Quantos mandatos a pessoa tem na base, em qualquer cargo.</param>
/// <param name="Parlamentar">Votou na Câmara ou no Senado: a página dele tem votos e afinidade.</param>
public record PoliticoNaListaDto(
    long IdPessoa, string Nome, string? UrlFoto, MandatoNoTseDto Mandato, int Mandatos, bool Parlamentar);

/// <summary>A ficha de um político pelos mandatos do TSE (Pendência 90, fase 3).</summary>
/// <param name="Mandatos">Do mais recente ao mais antigo.</param>
/// <param name="Parlamentar">Votou no Congresso: a ficha completa, com votos e afinidade, é a do parlamentar.</param>
public record FichaDoPoliticoDto(
    long IdPessoa, string Nome, string? NomeCivil, string? UrlFoto, bool Parlamentar,
    IReadOnlyList<MandatoNoTseDto> Mandatos, IReadOnlyList<RedeSocialDto> RedesSociais);
