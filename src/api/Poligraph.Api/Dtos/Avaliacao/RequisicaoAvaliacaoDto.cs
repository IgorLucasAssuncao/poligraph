using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record RequisicaoAvaliacaoDto(
    int PerguntasRespondidas,
    int AcordosDoPrimeiro,
    int ComparaveisDoPrimeiro,
    bool? Acertou,
    short? PosicaoAutodeclarada);
