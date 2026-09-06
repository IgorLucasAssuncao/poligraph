using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Poligraph.Api.Data;

namespace Poligraph.Migrations;

/// <summary>
/// Só existe para o <c>dotnet ef migrations add</c> funcionar.
///
/// <para>
/// Em runtime a connection string vem do Aspire; em tempo de design ⛔ não há Aspire
/// nenhum, e o EF precisa de alguma para montar o modelo. ⚠️ Esta connection string ⛔
/// **nunca é usada de verdade** — o EF ⛔ não conecta ao gerar migration, só precisa do
/// provider.
/// </para>
///
/// <para>
/// 🔴 <b>Mora AQUI, ⛔ não em <c>Poligraph.Api</c></b> (PL49). O <c>dotnet ef</c> toma
/// como projeto-alvo aquele que contém a fábrica, e o artefato tem de sair no projeto
/// que o aplica. ⛔ A API ⛔ nunca migra — a regra está no CLAUDE.md, e antes disto o
/// comando pedia <c>-p src/Poligraph.Api</c>, o que a contradizia.
/// </para>
/// </summary>
public class FabricaDesignTime : IDesignTimeDbContextFactory<PoligraphDb>
{
    public PoligraphDb CreateDbContext(string[] args)
    {
        var opcoes = new DbContextOptionsBuilder<PoligraphDb>()
            .UseNpgsql(
                "Host=localhost;Database=poligraph_design;Username=postgres;Password=postgres",
                // 🔴 Sem isto o scaffold procura migration no assembly do CONTEXTO
                //    (Poligraph.Api) e ⛔ não acha nenhuma — geraria uma "Inicial" nova
                //    por cima do schema que já existe.
                npgsql => npgsql.MigrationsAssembly(Assembly))
            .UseSnakeCaseNamingConvention()   // 🔴 igual ao runtime, senão a migration diverge
            .Options;

        return new PoligraphDb(opcoes);
    }

    /// <summary>⭐ Um lugar só para o nome — quem migra e quem gera usam o mesmo.</summary>
    public const string Assembly = "Poligraph.Migrations";
}
