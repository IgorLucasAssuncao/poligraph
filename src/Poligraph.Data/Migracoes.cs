namespace Poligraph.Data;

/// <summary>
/// Um lugar só para o nome do assembly das migrations.
///
/// <para>
/// O contexto (<c>PoligraphDb</c>) mora em <c>Poligraph.Api</c>, e o EF procura migration
/// no assembly DO CONTEXTO por padrão. Sem declarar este nome ele não acharia nenhuma —
/// e <c>MigrateAsync</c> não daria erro: criaria um banco vazio.
/// </para>
/// </summary>
public static class Migracoes
{
    public const string Assembly = "Poligraph.Data";
}
