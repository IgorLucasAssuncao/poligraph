namespace Poligraph.Api.Dtos;

/// <summary>Como a lista de parlamentares é ordenada.</summary>
public enum TipoOrdemDaLista
{
    NOME,

    /// <summary>Mais votações registradas primeiro: quem tem mais dado para comparar.</summary>
    VOTACOES,
}
