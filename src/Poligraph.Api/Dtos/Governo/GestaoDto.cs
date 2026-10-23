namespace Poligraph.Api.Dtos;

/// <summary>Presidente e vice eleitos, segundo o TSE, e os anos do mandato.</summary>
/// <remarks>
/// <para><see cref="Desde"/> e <see cref="Ate"/> só vêm quando a gestão começa ou termina no meio do ano, por uma troca de
/// presidente (<see cref="Sucessao"/>). Nas outras, a gestão é o mandato inteiro, contado em anos.</para>
/// </remarks>
public record GestaoDto(
    int AnoDaEleicao,
    int PrimeiroAno,
    int UltimoAno,
    PessoaDaGestaoDto Presidente,
    PessoaDaGestaoDto? Vice,
    string? Coligacao,
    DateOnly? Desde = null,
    DateOnly? Ate = null,
    SucessaoDto? Sucessao = null);

/// <summary>Nome civil, nome de urna e partido na eleição.</summary>
public record PessoaDaGestaoDto(string Nome, string NomeDeUrna, string Partido);

/// <summary>A troca de presidente no mandato: o motivo, o afastamento do titular, a posse definitiva do vice e a fonte oficial.</summary>
public record SucessaoDto(Services.TipoDeSucessao Motivo, DateOnly Afastamento, DateOnly Posse, string UrlDaFonte);
