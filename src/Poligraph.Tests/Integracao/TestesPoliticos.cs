using System.Net.Http.Json;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests.Integracao;

/// <summary>
/// A lista de políticos do TSE (Pendência 90, fase 2): o filtro por nível, cargo, UF e município, e o grupo novo da busca do cabeçalho.
/// </summary>
public class TestesPoliticos(FixturePostgres postgres) : BaseIntegracao(postgres)
{
    private const string SaoPaulo = "3550308";

    /// <summary>Quem foi prefeito e depois governador aparece pelo mandato que responde ao filtro, e a lista vai do mandato mais recente ao mais antigo.</summary>
    [SkippableFact]
    public async Task Filtro_MostraOMandatoQueResponde_DoMaisRecente()
    {
        ExigeDocker();
        var (prefeitoEGovernador, prefeita) = await SemearAsync();

        var municipais = await LerAsync<PaginaLida>($"/api/politicos?nivel=MUNICIPAL&municipio={SaoPaulo}");
        var estaduais = await LerAsync<PaginaLida>("/api/politicos?cargo=GOVERNADOR&uf=SP");

        Assert.Equal([prefeita, prefeitoEGovernador], municipais.Itens.Select(p => p.IdPessoa));
        Assert.Equal((2016, "São Paulo"), (municipais.Itens[1].Mandato.AnoEleicao, municipais.Itens[1].Mandato.Municipio!.Nome));
        Assert.Equal([prefeitoEGovernador], estaduais.Itens.Select(p => p.IdPessoa));
        Assert.Equal(("GOVERNADOR", 2), (estaduais.Itens[0].Mandato.Cargo, estaduais.Itens[0].Mandatos));
    }

    [SkippableFact]
    public async Task Filtro_SemNinguem_ListaVazia()
    {
        ExigeDocker();
        await SemearAsync();

        var lista = await LerAsync<PaginaLida>("/api/politicos?cargo=DEPUTADO_DISTRITAL");

        Assert.Equal(0, lista.Total);
    }

    [SkippableFact]
    public async Task Busca_DoCabecalho_TrazOsPoliticosNoGrupoProprio()
    {
        ExigeDocker();
        var (prefeitoEGovernador, _) = await SemearAsync();

        var busca = await LerAsync<BuscaLida>("/api/busca?q=joao");

        Assert.Equal([prefeitoEGovernador], busca.Politicos.Select(p => p.IdPessoa));
    }

    [SkippableFact]
    public async Task Ficha_TrazOsMandatosDoMaisRecente()
    {
        ExigeDocker();
        var (prefeitoEGovernador, _) = await SemearAsync();

        var ficha = await LerAsync<FichaLida>($"/api/politicos/{prefeitoEGovernador}");

        Assert.Equal(["GOVERNADOR", "PREFEITO"], ficha.Mandatos.Select(m => m.Cargo));
        Assert.False(ficha.Parlamentar);
    }

    [SkippableFact]
    public async Task Ficha_DeQuemNaoTemMandato_Responde404()
    {
        ExigeDocker();
        await SemearAsync();
        var semMandato = new PessoaModel { NomeCivil = "Sem Mandato", NomeExibicao = "Sem Mandato" };
        Db.Pessoas.Add(semMandato);
        await Db.SaveChangesAsync();

        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        var resposta = await cliente.GetAsync($"/api/politicos/{semMandato.Id}");

        Assert.Equal(System.Net.HttpStatusCode.NotFound, resposta.StatusCode);
    }

    /// <summary>RISCO: o banco recusa prefeito sem município; a lista o mostraria sem saber de onde.</summary>
    [SkippableFact]
    public async Task Prefeito_SemMunicipio_ERejeitadoPeloBanco()
    {
        ExigeDocker();
        var (pessoa, _) = await SemearAsync();
        Db.Mandatos.Add(Mandato(pessoa, TipoCargo.PREFEITO, 2020, "SP", municipioTse: null, ibge: null, sq: "9"));

        var erro = await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());

        Assert.Equal("ck_mandato_ente", ((PostgresException)erro.InnerException!).ConstraintName);
    }

    private async Task<(long PrefeitoEGovernador, long Prefeita)> SemearAsync()
    {
        Db.Municipios.Add(new MunicipioModel { CodigoIbge = SaoPaulo, CodigoTom = "7107", Nome = "São Paulo", Uf = "SP" });
        var joao = new PessoaModel { NomeCivil = "João Exemplo", NomeExibicao = "João Exemplo" };
        var maria = new PessoaModel { NomeCivil = "Maria Exemplo", NomeExibicao = "Maria Exemplo" };
        Db.Pessoas.AddRange(joao, maria);
        await Db.SaveChangesAsync();

        Db.Mandatos.AddRange(
            Mandato(joao.Id, TipoCargo.PREFEITO, 2016, "SP", "71072", SaoPaulo, "1"),
            Mandato(joao.Id, TipoCargo.GOVERNADOR, 2018, "SP", null, null, "2"),
            Mandato(maria.Id, TipoCargo.PREFEITO, 2024, "SP", "71072", SaoPaulo, "3"));
        await Db.SaveChangesAsync();
        return (joao.Id, maria.Id);
    }

    private static MandatoModel Mandato(
        long pessoa, TipoCargo cargo, short eleicao, string uf, string? municipioTse, string? ibge, string sq) => new()
        {
            PessoaId = pessoa,
            Cargo = cargo,
            AnoEleicao = eleicao,
            SqCandidato = sq,
            PrimeiroAno = (short)(eleicao + 1),
            UltimoAno = (short)(eleicao + 4),
            Uf = uf,
            CodigoMunicipioTse = municipioTse,
            CodigoMunicipioIbge = ibge,
            Partido = "XYZ",
            NomeDeUrna = "EXEMPLO",
        };

    private async Task<T> LerAsync<T>(string url)
    {
        using var cliente = new FabricaApi(ConnectionString).CreateClient();
        return (await cliente.GetFromJsonAsync<T>(url))!;
    }

    private sealed record MandatoLido(string Cargo, short AnoEleicao, MunicipioLido? Municipio);

    private sealed record MunicipioLido(string Nome);

    private sealed record PoliticoLido(long IdPessoa, MandatoLido Mandato, int Mandatos);

    private sealed record PaginaLida(List<PoliticoLido> Itens, int Total);

    private sealed record BuscaLida(List<PoliticoLido> Politicos);

    private sealed record FichaLida(List<MandatoLido> Mandatos, bool Parlamentar);
}
