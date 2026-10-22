namespace Poligraph.Api.Dtos;

/// <summary>Presidente e vice eleitos, segundo o TSE, e os anos do mandato.</summary>
public record GestaoDto(
    int AnoDaEleicao,
    int PrimeiroAno,
    int UltimoAno,
    PessoaDaGestaoDto Presidente,
    PessoaDaGestaoDto? Vice,
    string? Coligacao);

/// <summary>Nome civil, nome de urna e partido na eleição.</summary>
public record PessoaDaGestaoDto(string Nome, string NomeDeUrna, string Partido);
