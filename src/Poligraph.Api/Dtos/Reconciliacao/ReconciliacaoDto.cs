namespace Poligraph.Api.Dtos;

/// <summary>
/// Um total de dinheiro num ano, comparado com o mesmo total na fonte: quanto a fonte publica,
/// quanto está na base, e o que ficou fora, por motivo (Pendência 81).
/// </summary>
/// <param name="Conjunto"><c>EMENDAS</c>, por ano da emenda, ou <c>PAGAMENTOS</c>, por ano do pagamento.</param>
/// <param name="TotalInferido">A parte da base com autoria inferida (bancada pela UF). Já está em <c>TotalNaBase</c>.</param>
public record ReconciliacaoDto(
    string Conjunto,
    string Medida,
    int Ano,
    decimal TotalNaFonte,
    decimal TotalNaBase,
    decimal TotalInferido,
    IReadOnlyList<MotivoDeForaDto> Motivos);

public record MotivoDeForaDto(string Motivo, decimal Valor);
