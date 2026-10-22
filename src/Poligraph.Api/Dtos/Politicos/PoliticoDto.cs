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
