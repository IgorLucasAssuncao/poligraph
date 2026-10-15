using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <param name="Uf">U15: só os parlamentares deste estado nas listas e na régua. A posição no grafo continua a da casa inteira.</param>
public record RequisicaoAfinidadeDto(IReadOnlyList<RespostaCidadao> Respostas, string? Uf = null);
