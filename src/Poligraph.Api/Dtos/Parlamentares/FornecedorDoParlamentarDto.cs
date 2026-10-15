using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record FornecedorDoParlamentarDto(
    string Nome, decimal Total, int Lancamentos, bool PessoaFisica);
