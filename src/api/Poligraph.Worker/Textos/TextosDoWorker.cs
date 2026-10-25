using Aspire.Npgsql.EntityFrameworkCore.PostgreSQL;

namespace Poligraph.Worker;

/// <summary>
/// As mensagens do worker de avisos (Pendência 89) e o nome do esquema do Hangfire.
/// </summary>
/// <remarks>
/// <para>DECISÃO (2026-10-18): o Hangfire cria e mantém as próprias tabelas, no esquema <c>hangfire</c>, fora do EF. É a exceção à regra "o EF é dono do schema", aceita na escolha do Hangfire: as tabelas são da fila, a ETL não as lê, e o <c>schema_do_ef.sql</c> dos testes continua só com as do EF.</para>
/// </remarks>
public static class TextosDoWorker
{
    public const string EsquemaDoHangfire = "hangfire";

    public const string FaltaChave =
        "Avisos:ChavePublica e Avisos:ChavePrivada são obrigatórias: sem o par VAPID, o fabricante do navegador recusa todo aviso. "
        + "No dev, os parâmetros avisos-chave-publica e avisos-chave-privada do AppHost; em produção, Avisos__ChavePublica e Avisos__ChavePrivada no Coolify.";

    public const string FaltaBanco = "ConnectionStrings:poligraph é obrigatória: o Hangfire guarda a fila no mesmo Postgres.";

    /// <summary>
    /// Desliga a repetição automática que o Aspire põe no EF.
    /// </summary>
    /// <remarks>
    /// <para>MEDIDO no primeiro teste local, 2026-10-18: com a repetição ligada, todo job que abre transação falhava com "the configured execution strategy 'NpgsqlRetryingExecutionStrategy' does not support user-initiated transactions". Os testes de integração não pegaram porque montam o contexto sem ela.</para>
    /// <para>DECISÃO: quem repete é o Hangfire, o job inteiro, com a transação desfeita. Repetir dentro do job mandaria o aviso de novo a cada tentativa do banco.</para>
    /// </remarks>
    public static void SemRepeticaoDoEf(NpgsqlEntityFrameworkCorePostgreSQLSettings configuracao) => configuracao.DisableRetry = true;
}
