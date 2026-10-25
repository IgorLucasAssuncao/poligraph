namespace Poligraph.Data;

/// <summary>Os cargos eletivos que a base guarda, um por <c>CD_CARGO</c> do TSE.</summary>
/// <remarks>
/// <para>Vereador fica fora (Pendência 90): são 58 mil eleitos por eleição, sem voto publicado.</para>
/// <para>O Python tem o mesmo enum em <c>poligraph_etl/nucleo/tipos.py</c>, com os mesmos tokens, e é lá que o código do TSE é traduzido.</para>
/// </remarks>
public enum TipoCargo
{
    PRESIDENTE,
    VICE_PRESIDENTE,
    SENADOR,
    DEPUTADO_FEDERAL,
    GOVERNADOR,
    VICE_GOVERNADOR,
    DEPUTADO_ESTADUAL,
    DEPUTADO_DISTRITAL,
    PREFEITO,
    VICE_PREFEITO,
}
