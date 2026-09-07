using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record RequisicaoAfinidadeDto(IReadOnlyList<RespostaCidadao> Respostas);
