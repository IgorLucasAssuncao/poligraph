using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>Os endpoints de parlamentar, ponta a ponta, contra Postgres real.</summary>
public class TestesEndpointParlamentares : BaseIntegracao
{
    private const string Rota = "/api/parlamentares";

    [SkippableFact]
    public async Task Lista_TrazParlamentaresComVoto()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var lista = await cliente.GetFromJsonAsync<List<ParlamentarJson>>(Rota);

        Assert.NotNull(lista);
        Assert.Equal(12, lista!.Count);
        Assert.All(lista, p => Assert.True(p.NVotacoes > 0));
    }

    [SkippableFact]
    public async Task Lista_FiltraPorPartido()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var lista = await cliente.GetFromJsonAsync<List<ParlamentarJson>>(
            $"{Rota}?partido=PARTIDO-B");

        Assert.NotNull(lista);
        Assert.NotEmpty(lista!);
        Assert.All(lista, p => Assert.Equal("PARTIDO-B", p.Partido));
    }

    [SkippableFact]
    public async Task Lista_BuscaPorNomeIgnoraCaixa()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var lista = await cliente.GetFromJsonAsync<List<ParlamentarJson>>($"{Rota}?nome=ana");

        Assert.NotNull(lista);
        Assert.Contains(lista!, p => p.Nome.Contains("Ana"));
    }

    [SkippableFact]
    public async Task Ficha_InexistenteRetorna404()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync($"{Rota}/999999");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [SkippableFact]
    public async Task Ficha_TrazVotosRecentesEFiliacao()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        Assert.NotNull(ficha);
        Assert.NotEmpty(ficha!.Nome);
        Assert.NotEmpty(ficha.VotosRecentes);
        Assert.NotEmpty(ficha.Partido);
    }

    /// <summary>
    /// 🔴 A armadilha da invariante I3.
    ///
    /// A similaridade é gravada uma vez por par, sempre com `pessoa_a &lt; pessoa_b`.
    /// Uma consulta que olhasse só `pessoa_a = id` funcionaria para quem tem id baixo
    /// e devolveria lista VAZIA para quem tem id alto — um bug que passa despercebido
    /// porque "funciona" nos primeiros que você testar.
    /// </summary>
    [SkippableFact]
    public async Task Ficha_TrazSimilares_MesmoParaQuemTemIdAlto()
    {
        ExigeDocker();
        await SemearAsync();
        await GravarSimilaridadesAsync();
        using var cliente = CriarCliente();

        var ids = await db_TodosOsIdsAsync();
        var menor = ids.First();
        var maior = ids.Last();

        var fichaMenor = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{menor}");
        var fichaMaior = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{maior}");

        Assert.NotEmpty(fichaMenor!.MaisSimilares);
        Assert.NotEmpty(fichaMaior!.MaisSimilares);   // ⭐ o que quebraria com meio join
    }

    [SkippableFact]
    public async Task Ficha_SemExecucaoConcluida_NaoQuebra()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();
        var id = await PrimeiroParlamentarAsync();

        var ficha = await cliente.GetFromJsonAsync<FichaJson>($"{Rota}/{id}");

        Assert.NotNull(ficha);
        Assert.Empty(ficha!.MaisSimilares);   // lista vazia, não erro
    }

    /// <summary>
    /// 🔴 O `GroupBy` da cota precisa ser TRADUZÍVEL pelo EF.
    ///
    /// ⚠️ Projetar direto num `record` posicional compila sem reclamar e estoura em
    /// RUNTIME com `could not be translated` — aconteceu. Só um teste que executa a
    /// consulta contra Postgres de verdade pega isso.
    /// </summary>
    [SkippableFact]
    public async Task Gastos_AgregaPorCategoriaEFornecedor()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearDespesasAsync();
        using var cliente = CriarCliente();

        var resposta = await cliente.GetAsync($"{Rota}/{pessoaId}/gastos");
        resposta.EnsureSuccessStatusCode();

        var gastos = await resposta.Content.ReadFromJsonAsync<GastoLido>();

        Assert.NotNull(gastos);
        Assert.Equal(2025, gastos.Ano);
        Assert.Equal(3, gastos.Lancamentos);
        Assert.Equal(450m, gastos.Total);

        // ⭐ Duas categorias, e a maior vem primeiro
        Assert.Equal(2, gastos.PorCategoria.Count);
        Assert.Equal("PASSAGEM AÉREA", gastos.PorCategoria[0].Categoria);
        Assert.Equal(300m, gastos.PorCategoria[0].Total);
    }

    /// <summary>⭐ Sem despesa é caso normal — a tela mostra vazio, ⛔ não erro.</summary>
    [SkippableFact]
    public async Task Gastos_SemDespesa_DevolveVazioNaoErro()
    {
        ExigeDocker();
        await SemearAsync();
        using var cliente = CriarCliente();

        var id = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();
        var resposta = await cliente.GetAsync($"{Rota}/{id}/gastos");

        resposta.EnsureSuccessStatusCode();
        var gastos = await resposta.Content.ReadFromJsonAsync<GastoLido>();

        Assert.Equal(0, gastos!.Lancamentos);
        Assert.Empty(gastos.PorCategoria);
    }

    /// <summary>
    /// 🔴 RNF-13 — o documento de fornecedor pessoa física ⛔ NUNCA sai em claro.
    /// </summary>
    [SkippableFact]
    public async Task Gastos_NaoVazamCpfDeFornecedor()
    {
        ExigeDocker();
        await SemearAsync();
        var pessoaId = await SemearDespesasAsync();
        using var cliente = CriarCliente();

        var json = await cliente.GetStringAsync($"{Rota}/{pessoaId}/gastos");

        // ⚠️ O endpoint não devolve o campo de documento de jeito nenhum — nem hash.
        //    A ficha precisa do NOME do fornecedor, não do CNPJ dele.
        Assert.DoesNotContain("cnpj", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("12345678909", json);
    }

    private record CategoriaLida(string Categoria, decimal Total, int Lancamentos);

    private record GastoLido(
        int Ano, decimal Total, int Lancamentos,
        IReadOnlyList<CategoriaLida> PorCategoria);

    private async Task<long> SemearDespesasAsync()
    {
        var pessoaId = await Db.Pessoas.AsNoTracking().Select(p => p.Id).FirstAsync();

        Db.Despesas.AddRange(
            new Despesa
            {
                PessoaId = pessoaId, Ano = 2025, Mes = 3,
                Categoria = "PASSAGEM AÉREA", Fornecedor = "CIA AEREA",
                CnpjOuHash = "12345678000199", ValorLiquido = 200m
            },
            new Despesa
            {
                PessoaId = pessoaId, Ano = 2025, Mes = 4,
                Categoria = "PASSAGEM AÉREA", Fornecedor = "CIA AEREA",
                CnpjOuHash = "12345678000199", ValorLiquido = 100m
            },
            new Despesa
            {
                PessoaId = pessoaId, Ano = 2025, Mes = 5,
                Categoria = "COMBUSTÍVEIS", Fornecedor = "POSTO",
                // ⚠️ hash de CPF, como o ETL grava — nunca o número
                CnpjOuHash = new string('a', 64), FornecedorEhPessoaFisica = true,
                ValorLiquido = 150m
            });

        await Db.SaveChangesAsync();

        return pessoaId;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task SemearAsync() =>
        await Poligraph.Tests.Fixtures.DadosDeTeste.SemearAsync(Db);

    private HttpClient CriarCliente() => new FabricaApi(ConnectionString).CreateClient();

    private async Task<long> PrimeiroParlamentarAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).FirstAsync();

    private async Task<List<long>> db_TodosOsIdsAsync() =>
        await Db.Pessoas.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Id).ToListAsync();

    private async Task GravarSimilaridadesAsync()
    {
        var ids = await db_TodosOsIdsAsync();

        var execucao = new Execucao
        {
            Casa = "CAMARA", Legislatura = 57, K = 10,
            VersaoCarga = "teste", Status = "CONCLUIDA"
        };
        Db.Execucoes.Add(execucao);
        await Db.SaveChangesAsync();

        for (var i = 0; i < ids.Count; i++)
        {
            for (var j = i + 1; j < ids.Count; j++)
            {
                Db.Similaridades.Add(new Similaridade
                {
                    ExecucaoId = execucao.Id,
                    PessoaA = ids[i],          // I3: menor primeiro
                    PessoaB = ids[j],
                    Metrica = "CONCORDANCIA",
                    Valor = 0.5f + (i + j) / 100f,
                    NVotacoesComuns = 25
                });
            }
        }

        await Db.SaveChangesAsync();
    }

    private record ParlamentarJson(long Id, string Nome, string Partido, string Uf, int NVotacoes);
    private record SimilarJson(long PessoaId, string Nome, string Partido, float Valor, int Comuns);
    private record FichaJson(
        long Id, string Nome, string NomeCivil, string Partido, string Uf, int NVotacoes,
        List<VotoJson> VotosRecentes, List<SimilarJson> MaisSimilares);
    private record VotoJson(string VotacaoId, DateOnly Data, string? Descricao, short? Valor);
}
