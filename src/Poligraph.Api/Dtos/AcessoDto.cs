namespace Poligraph.Api.Dtos;

/// <summary>Se o site pode ser lido sem login — desligado durante o período eleitoral (RNF-17).</summary>
public record AcessoDto(bool LeituraPublica);
