using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Poligraph.Api.Data;

/// <summary>
/// Só existe para o `dotnet ef migrations add` funcionar.
///
/// Em runtime a connection string vem do Aspire; em tempo de design não há Aspire nenhum,
/// e o EF precisa de alguma para montar o modelo. ⚠️ Esta connection string **nunca é
/// usada de verdade** — o EF não conecta ao gerar migration, só precisa do provider.
/// </summary>
public class FabricaDesignTime : IDesignTimeDbContextFactory<PoligraphDb>
{
    public PoligraphDb CreateDbContext(string[] args)
    {
        var opcoes = new DbContextOptionsBuilder<PoligraphDb>()
            .UseNpgsql("Host=localhost;Database=poligraph_design;Username=postgres;Password=postgres")
            .UseSnakeCaseNamingConvention()   // 🔴 igual ao runtime, senão a migration diverge
            .Options;

        return new PoligraphDb(opcoes);
    }
}
