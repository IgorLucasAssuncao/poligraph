namespace Poligraph.Data;

/// <summary>O que aconteceu, na tabela <c>eventos</c> (Pendência 89). A ETL grava; o worker consome.</summary>
public enum TipoDeEvento
{
    /// <summary>A rotina semanal passou por todas as etapas, inclusive o <c>conferir</c>.</summary>
    ROTINA_SEMANAL,

    /// <summary>A rotina mensal passou por todas as etapas, inclusive o <c>conferir</c>.</summary>
    ROTINA_MENSAL,
}
