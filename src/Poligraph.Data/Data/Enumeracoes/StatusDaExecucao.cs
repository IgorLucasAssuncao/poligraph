namespace Poligraph.Data;

/// <summary>O ciclo de vida de uma execução do ETL analítico.</summary>
public enum StatusDaExecucao
{
    EM_ANDAMENTO,
    CONCLUIDA,
    FALHOU,
}
