using System.Net.Http.Json;
using Npgsql;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// Pendência 81: o total de emendas fecha com o Portal, e o que não fecha vem com o motivo.
/// </summary>
public class TestesReconciliacao(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    [SkippableFact]
    public async Task Lista_OAnoPedido_ComOsMotivosDoMaiorParaOMenor()
    {
        ExigeDocker();
        Db.Reconciliacoes.AddRange(
            Reconciliacao(2016, 25_920m, 10_820m, 3_600m,
                ("RELATOR_SEM_AUTOR", 13_750m), ("COMISSAO_SEM_AUTOR", 1_310m), ("BANCADA_SEM_AUTOR_E_SEM_UF", 40m)),
            Reconciliacao(2021, 33_400m, 33_400m, 0m));
        await Db.SaveChangesAsync();
        using var cliente = new FabricaApi(ConnectionString).CreateClient();

        var lidas = (await cliente.GetFromJsonAsync<List<ReconciliacaoLida>>("/api/emendas/reconciliacao?de=2016&ate=2016"))!;

        var ano = Assert.Single(lidas);
        Assert.Equal((2016, 25_920m, 10_820m, 3_600m), (ano.AnoDaFonte, ano.TotalNaFonte, ano.TotalNaBase, ano.TotalInferido));
        Assert.Equal(["RELATOR_SEM_AUTOR", "COMISSAO_SEM_AUTOR", "BANCADA_SEM_AUTOR_E_SEM_UF"], ano.Motivos.Select(m => m.Motivo));
        Assert.Equal(ano.TotalNaFonte, ano.TotalNaBase + ano.Motivos.Sum(m => m.Valor));
    }

    /// <summary>O motivo é um domínio fechado: escrito diferente, nenhuma tela saberia lê-lo.</summary>
    [SkippableFact]
    public async Task MotivoForaDoDominio_ERejeitadoPeloBanco()
    {
        ExigeDocker();
        Db.Reconciliacoes.Add(Reconciliacao(2016, 10m, 5m, 0m, ("SEM_AUTOR", 5m)));

        var erro = await Assert.ThrowsAsync<Microsoft.EntityFrameworkCore.DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_reconciliacao_motivo", ((PostgresException)erro.InnerException!).ConstraintName);
    }

    private static ReconciliacaoModel Reconciliacao(
        short ano, decimal fonte, decimal baseDaConta, decimal inferido, params (string Motivo, decimal Valor)[] motivos) => new()
    {
        Conjunto = "EMENDAS", Medida = "EMPENHADO", Ano = ano,
        TotalNaFonte = fonte, TotalNaBase = baseDaConta, TotalInferido = inferido,
        Motivos = [.. motivos.Select(m => new ReconciliacaoMotivoModel { Motivo = m.Motivo, Valor = m.Valor })],
    };

    private record MotivoLido(string Motivo, decimal Valor);

    private record ReconciliacaoLida(string Conjunto, string Medida, int AnoDaFonte, decimal TotalNaFonte, decimal TotalNaBase,
        decimal TotalInferido, List<MotivoLido> Motivos);
}
