using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>⛔ Não devolve e-mail: o front não precisa, e o que não trafega não vaza.</summary>
public record UsuarioLogadoDto(string? Nome, string? FotoUrl);
