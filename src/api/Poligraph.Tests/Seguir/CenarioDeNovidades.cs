using Microsoft.EntityFrameworkCore;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// O cenário do "O que mudou" (Pendência 63), usado também pelos avisos no navegador (Pendência 89).
/// As votações ficam em 2030 para a semana ser só delas; o mês fechado é o anterior ao de hoje.
/// </summary>
public static class CenarioDeNovidades
{
    /// <summary>O mês fechado que o "O que mudou" usa: o anterior ao de hoje.</summary>
    public static DateOnly MesFechado
    {
        get
        {
            var hoje = DateTimeOffset.UtcNow;
            return new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(-1);
        }
    }

    public static DateOnly MesAberto => MesFechado.AddMonths(1);

    /// <summary>Um deputado da legislatura corrente com os cinco avisos: votou contra o partido em 2030, trocou de partido, gastou na cota e teve emenda paga no mês fechado.</summary>
    public static async Task<(long PessoaId, string PartidoAntes)> SemearAsync(PoligraphDb db)
    {
        await DadosDeTeste.SemearAsync(db);
        var corrente = await db.Votacoes.MaxAsync(v => v.Legislatura);
        var idPessoa = await db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Legislatura == corrente && v.Votacao.Casa == TipoCasa.CAMARA)
            .OrderBy(v => v.PessoaId).Select(v => v.PessoaId).FirstAsync();
        var partidoAntes = await db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == idPessoa).OrderByDescending(v => v.Votacao!.Data)
            .Select(v => v.PartidoNoVoto).FirstAsync();

        db.Votacoes.AddRange(
            Votacao("novidade-1", new DateOnly(2030, 1, 10), corrente),
            Votacao("novidade-2", new DateOnly(2030, 1, 9), corrente));
        await db.SaveChangesAsync();

        db.Votos.AddRange(
            new VotoModel { VotacaoId = "novidade-1", PessoaId = idPessoa, Valor = 1, PartidoNoVoto = "PT", UfNoVoto = "SP" },
            new VotoModel { VotacaoId = "novidade-2", PessoaId = idPessoa, Valor = -1, PartidoNoVoto = "PT", UfNoVoto = "SP" });
        db.Orientacoes.AddRange(
            new OrientacaoModel { VotacaoId = "novidade-1", Bancada = "Fdr PT-PCdoB-PV", Orientacao = "Não" },
            new OrientacaoModel { VotacaoId = "novidade-1", Bancada = "Governo", Orientacao = "Sim" },
            new OrientacaoModel { VotacaoId = "novidade-2", Bancada = "Fdr PT-PCdoB-PV", Orientacao = "Não" });

        db.Despesas.AddRange(
            Despesa(idPessoa, MesFechado, "DIVULGAÇÃO", 100m),
            Despesa(idPessoa, MesFechado, "COMBUSTÍVEL", 50m),
            Despesa(idPessoa, MesAberto, "DIVULGAÇÃO", 999m));

        const string codigo = "202512340001";
        db.Emendas.AddRange(
            Emenda(idPessoa, codigo, "LINDOESTE - PR"),
            Emenda(idPessoa, codigo, "CASCAVEL - PR"));
        db.EmendasFavorecidos.AddRange(
            Favorecido(codigo, MesFechado, "BANCO DO BRASIL SA", 500m, intermediario: true),
            Favorecido(codigo, MesFechado, "CONSTRUTORA EXEMPLO LTDA", 300m, intermediario: false),
            Favorecido(codigo, MesAberto, "CONSTRUTORA EXEMPLO LTDA", 999m, intermediario: false));
        await db.SaveChangesAsync();

        return (idPessoa, partidoAntes);
    }

    private static VotacaoModel Votacao(string id, DateOnly data, short legislatura) => new()
    {
        Id = id, Casa = TipoCasa.CAMARA, Legislatura = legislatura, Data = data, Descricao = "Aprovado o Projeto",
        Categoria = TipoCategoriaDeVotacao.SUBSTANTIVA, Plenario = true
    };

    private static DespesaModel Despesa(long idPessoa, DateOnly mes, string categoria, decimal valor) => new()
    {
        PessoaId = idPessoa, Ano = (short)mes.Year, Mes = (short)mes.Month, Categoria = categoria, ValorLiquido = valor
    };

    private static EmendaModel Emenda(long idPessoa, string codigo, string localidade) => new()
    {
        PessoaId = idPessoa, CodigoAutor = "1234", NomeAutor = "FULANO", CodigoEmenda = codigo, Ano = 2025,
        Localidade = localidade, CodigoAcao = "20XV", CodigoPlanoOrcamentario = "0000",
        ValorEmpenhado = 1000m, ValorPago = 500m
    };

    private static EmendaFavorecidoModel Favorecido(string codigo, DateOnly mes, string nome, decimal valor, bool intermediario) => new()
    {
        CodigoEmenda = codigo, Competencia = mes, Tipo = TipoFavorecido.PESSOA_JURIDICA,
        Documento = intermediario ? "00000000000191" : "12345678000190", Nome = nome,
        Uf = "PR", Municipio = "LINDOESTE", Valor = valor, Intermediario = intermediario
    };

    public static CargaModel Carga() => new()
    {
        Fonte = TipoFonteDeCarga.CAMARA, Url = "https://exemplo/votacoes-2030.csv",
        Sha256 = new string('c', 64), Bytes = 1, Comando = "teste"
    };
}
