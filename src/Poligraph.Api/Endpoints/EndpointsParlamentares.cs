using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Api.Endpoints;

public record ParlamentarNaLista(
    long Id, string Nome, string Partido, string Uf, int NVotacoes, string? UrlFoto);

public record VotoNaFicha(string VotacaoId, DateOnly Data, string? Descricao, short? Valor);

public record SimilarNaFicha(long PessoaId, string Nome, string Partido, float Valor, int Comuns);

public record FichaParlamentar(
    long Id,
    string Nome,
    string NomeCivil,
    string Partido,
    string Uf,
    /// <summary>🔴 URL na Câmara — ⛔ a imagem NÃO é rehospedada.</summary>
    string? UrlFoto,
    int NVotacoes,
    IReadOnlyList<VotoNaFicha> VotosRecentes,
    IReadOnlyList<SimilarNaFicha> MaisSimilares);

/// <summary>
/// ⚠️ Agregado, ⛔ não a lista de 200 mil linhas. A ficha responde "quanto e em quê",
/// e o documento fiscal fica a um clique na Câmara.
/// </summary>
public record GastoPorCategoria(string Categoria, decimal Total, int Lancamentos);

public record FornecedorDoParlamentar(
    string Nome, decimal Total, int Lancamentos, bool PessoaFisica);

public record GastoDeCota(
    int Ano,
    decimal Total,
    int Lancamentos,
    IReadOnlyList<GastoPorCategoria> PorCategoria,
    IReadOnlyList<FornecedorDoParlamentar> MaioresFornecedores);

public static class EndpointsParlamentares
{
    private const int LimiteLista = 100;
    private const int VotosNaFicha = 20;
    private const int SimilaresNaFicha = 10;

    public static IEndpointRouteBuilder MapearParlamentares(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/parlamentares").WithTags("Parlamentares");

        grupo.MapGet("/", ListarAsync);
        grupo.MapGet("/{id:long}", ObterFichaAsync);
        grupo.MapGet("/{id:long}/gastos", ObterGastosAsync);

        return app;
    }

    // ═══════════════════════════════════════════════════════════════
    // PÚBLICOS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>RF-34 — busca por nome, partido e UF.</summary>
    private static async Task<IResult> ListarAsync(
        PoligraphDb db,
        CancellationToken ct,
        string? nome = null,
        string? partido = null,
        string? uf = null)
    {
        var consulta = db.Pessoas.AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                p.UrlFoto,
                NVotacoes = p.Votos.Count(v => v.Valor != null),
                Ultimo = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .Where(p => p.NVotacoes > 0);

        if (!string.IsNullOrWhiteSpace(nome))
            consulta = consulta.Where(p => EF.Functions.ILike(p.NomeExibicao, $"%{nome}%"));

        if (!string.IsNullOrWhiteSpace(partido))
            consulta = consulta.Where(p => p.Ultimo!.PartidoNoVoto == partido);

        if (!string.IsNullOrWhiteSpace(uf))
            consulta = consulta.Where(p => p.Ultimo!.UfNoVoto == uf);

        var lista = await consulta
            .OrderBy(p => p.NomeExibicao)
            .Take(LimiteLista)
            .ToListAsync(ct);

        return Results.Ok(lista.Select(p => new ParlamentarNaLista(
            p.Id, p.NomeExibicao,
            p.Ultimo?.PartidoNoVoto ?? "", p.Ultimo?.UfNoVoto ?? "",
            p.NVotacoes, p.UrlFoto)));
    }

    /// <summary>Quantos fornecedores aparecem na ficha.</summary>
    private const int FornecedoresExibidos = 8;

    /// <summary>
    /// A cota parlamentar do deputado, agregada por ano.
    ///
    /// ⚠️ **Agregação no banco, ⛔ não em memória.** São 209 mil linhas por ano no total;
    /// trazer as de um deputado e somar em C# seria desperdício, e a consulta abaixo usa
    /// o índice `ix_despesa_pessoa_ano`.
    ///
    /// ⭐ O ano é opcional: sem ele, devolve o mais recente que existir para a pessoa —
    /// que é o que a ficha quer mostrar por padrão.
    /// </summary>
    private static async Task<IResult> ObterGastosAsync(
        long id, PoligraphDb db, CancellationToken ct, int? ano = null)
    {
        var alvo = ano ?? await db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == id)
            .MaxAsync(d => (int?)d.Ano, ct);

        // ⭐ Sem despesa é caso NORMAL — deputado que não usou cota, ou ano ainda não
        //    ingerido. A tela mostra estado vazio, ⛔ não erro.
        if (alvo is null) return Results.Ok(new GastoDeCota(0, 0, 0, [], []));

        var doAno = db.Despesas.AsNoTracking().Where(d => d.PessoaId == id && d.Ano == alvo);

        // ⚠️ Projeta em tipo ANÔNIMO, não direto no `record`: o EF não traduz `GroupBy`
        //    com construtor posicional — devolve `could not be translated` em runtime,
        //    ⛔ não em compilação. O `record` é montado depois, em memória.
        var categorias = await doAno
            .GroupBy(d => d.Categoria)
            .Select(g => new
            {
                Categoria = g.Key,
                Total = g.Sum(d => d.ValorLiquido),
                Lancamentos = g.Count()
            })
            .OrderByDescending(c => c.Total)
            .ToListAsync(ct);

        var porCategoria = categorias
            .Select(c => new GastoPorCategoria(c.Categoria, c.Total, c.Lancamentos))
            .ToList();

        var brutos = await doAno
            .Where(d => d.Fornecedor != null)
            .GroupBy(d => new { d.Fornecedor, d.FornecedorEhPessoaFisica })
            .Select(g => new
            {
                g.Key.Fornecedor,
                g.Key.FornecedorEhPessoaFisica,
                Total = g.Sum(d => d.ValorLiquido),
                Lancamentos = g.Count()
            })
            .OrderByDescending(f => f.Total)
            .Take(FornecedoresExibidos)
            .ToListAsync(ct);

        var fornecedores = brutos
            .Select(f => new FornecedorDoParlamentar(
                f.Fornecedor!, f.Total, f.Lancamentos, f.FornecedorEhPessoaFisica))
            .ToList();

        return Results.Ok(new GastoDeCota(
            Ano: alvo.Value,
            Total: porCategoria.Sum(c => c.Total),
            Lancamentos: porCategoria.Sum(c => c.Lancamentos),
            PorCategoria: porCategoria,
            MaioresFornecedores: fornecedores));
    }

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    private static async Task<IResult> ObterFichaAsync(long id, PoligraphDb db, CancellationToken ct)
    {
        var pessoa = await db.Pessoas.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.NomeExibicao, p.NomeCivil, p.UrlFoto })
            .FirstOrDefaultAsync(ct);

        if (pessoa is null) return Results.NotFound();

        var votos = await UltimosVotosAsync(db, id, ct);
        var similares = await MaisSimilaresAsync(db, id, ct);
        var (partido, uf) = await FiliacaoAtualAsync(db, id, ct);

        return Results.Ok(new FichaParlamentar(
            pessoa.Id, pessoa.NomeExibicao, pessoa.NomeCivil,
            partido, uf, pessoa.UrlFoto,
            await db.Votos.CountAsync(v => v.PessoaId == id && v.Valor != null, ct),
            votos, similares));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private static async Task<List<VotoNaFicha>> UltimosVotosAsync(
        PoligraphDb db, long id, CancellationToken ct) =>
        await db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id)
            .OrderByDescending(v => v.Votacao!.Data)
            .Take(VotosNaFicha)
            .Select(v => new VotoNaFicha(
                v.VotacaoId, v.Votacao!.Data, v.Votacao.Descricao, v.Valor))
            .ToListAsync(ct);

    /// <summary>
    /// Os mais parecidos, da execução mais recente.
    ///
    /// ⚠️ A similaridade é gravada uma vez por par, com `pessoa_a &lt; pessoa_b` (I3).
    /// Por isso a consulta precisa olhar os DOIS lados — senão metade dos vizinhos
    /// some, e some justamente para quem tem id alto.
    /// </summary>
    private static async Task<List<SimilarNaFicha>> MaisSimilaresAsync(
        PoligraphDb db, long id, CancellationToken ct)
    {
        var execucao = await db.Execucoes.AsNoTracking()
            .Where(e => e.Status == "CONCLUIDA")
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        if (execucao is null) return [];

        var pares = await db.Similaridades.AsNoTracking()
            .Where(s => s.ExecucaoId == execucao
                     && s.Metrica == "CONCORDANCIA"
                     && (s.PessoaA == id || s.PessoaB == id))
            .OrderByDescending(s => s.Valor)
            .Take(SimilaresNaFicha)
            .Select(s => new
            {
                Outro = s.PessoaA == id ? s.PessoaB : s.PessoaA,
                s.Valor,
                s.NVotacoesComuns
            })
            .ToListAsync(ct);

        var ids = pares.Select(p => p.Outro).ToList();
        var fichas = await db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                Partido = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => v.PartidoNoVoto)
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(p => p.Id, ct);

        return [.. pares.Select(p => new SimilarNaFicha(
            p.Outro,
            fichas.GetValueOrDefault(p.Outro)?.NomeExibicao ?? "",
            fichas.GetValueOrDefault(p.Outro)?.Partido ?? "",
            p.Valor,
            p.NVotacoesComuns))];
    }

    /// <summary>
    /// ⚠️ Vem do voto mais recente, não de uma coluna em `pessoa`.
    /// `partido_no_voto` é registro histórico — 14 deputados trocaram de legenda só
    /// em 2025, e a filiação "atual" é a do último voto conhecido.
    /// </summary>
    private static async Task<(string Partido, string Uf)> FiliacaoAtualAsync(
        PoligraphDb db, long id, CancellationToken ct)
    {
        var ultimo = await db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id)
            .OrderByDescending(v => v.Votacao!.Data)
            .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
            .FirstOrDefaultAsync(ct);

        return (ultimo?.PartidoNoVoto ?? "", ultimo?.UfNoVoto ?? "");
    }
}
