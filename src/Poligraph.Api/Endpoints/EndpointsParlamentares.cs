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

public record EmendaPorDestino(string Localidade, decimal Empenhado, decimal Pago, int Quantidade);

public record EmendaPorFuncao(string Funcao, decimal Empenhado, decimal Pago);

/// <summary>
/// As emendas do parlamentar num ano.
///
/// 🔴 **`Empenhado` e `Pago` são coisas diferentes, e a distância entre eles é a
/// informação.** Empenhar é reservar; pagar é o dinheiro sair. Mostrar só um dos dois
/// responderia metade da pergunta — e seria a metade que favorece quem só anuncia.
/// </summary>
public record EmendasDoParlamentar(
    int Ano,
    decimal Empenhado,
    decimal Pago,
    int Quantidade,
    IReadOnlyList<EmendaPorDestino> PorDestino,
    IReadOnlyList<EmendaPorFuncao> PorFuncao);

public record ReceitaPorFonte(string Fonte, decimal Total, int Lancamentos);

public record DoadorDoParlamentar(string Nome, decimal Total, bool PessoaFisica);

/// <summary>
/// O financiamento da campanha que elegeu o parlamentar.
///
/// 🔴 **`FundoEspecial` e `FundoPartidario` ficam SEPARADOS de propósito.** O primeiro é
/// o "fundão" (FEFC, de 2017), eleitoral; o segundo é o financiamento permanente dos
/// partidos. Somá-los como *"dinheiro público de campanha"* é defensável — mas é uma
/// afirmação, e quem a fizer que a assine. A API entrega os dois.
/// </summary>
public record FinanciamentoDeCampanha(
    int AnoEleicao,
    decimal Total,
    decimal FundoEspecial,
    decimal FundoPartidario,
    IReadOnlyList<ReceitaPorFonte> PorFonte,
    IReadOnlyList<DoadorDoParlamentar> MaioresDoadores);

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
        grupo.MapGet("/{id:long}/emendas", ObterEmendasAsync);
        grupo.MapGet("/{id:long}/financiamento", ObterFinanciamentoAsync);

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
        // 🔴 PL35 — "parlamentar" é quem votou na legislatura CORRENTE.
        //
        // ⚠️ Sem o recorte, a chegada da 58ª faria "explorar" listar ex-deputados junto
        //    dos atuais, e `NVotacoes` somaria mandatos diferentes. Nada quebraria: só
        //    apareceria gente que ⛔ não está mais lá, com um número inflado.
        //
        // ⭐ `null` só acontece em base sem votação nenhuma — antes do primeiro ETL. Aí
        //    a lista sai vazia, que é a resposta honesta.
        var legislatura = await Legislaturas.CorrenteAsync(db, ct);
        if (legislatura is null) return Results.Ok(Array.Empty<ParlamentarNaLista>());

        var consulta = db.Pessoas.AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                p.UrlFoto,
                NVotacoes = p.Votos.Count(
                    v => v.Valor != null && v.Votacao!.Legislatura == legislatura),
                Ultimo = p.Votos
                    .Where(v => v.Votacao!.Legislatura == legislatura)
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

    /// <summary>Quantos destinos, funções e doadores aparecem na ficha.</summary>
    private const int ItensNaFicha = 8;

    /// <summary>
    /// As emendas do parlamentar, agregadas por ano.
    ///
    /// ⭐ **Só entra emenda já reconciliada** (`pessoa_id` preenchido). Emenda de bancada
    /// e de autor ainda não resolvido existem no banco e ⛔ não aparecem aqui — atribuí-las
    /// a alguém por semelhança de nome seria inventar autoria.
    /// </summary>
    private static async Task<IResult> ObterEmendasAsync(
        long id, PoligraphDb db, CancellationToken ct, int? ano = null)
    {
        var alvo = ano ?? await db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == id)
            .MaxAsync(e => (int?)e.Ano, ct);

        // ⭐ Sem emenda é caso NORMAL — parlamentar que não apresentou, ou autor ainda
        //    não reconciliado. A tela mostra estado vazio, ⛔ não erro.
        if (alvo is null) return Results.Ok(new EmendasDoParlamentar(0, 0, 0, 0, [], []));

        var doAno = db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == id && e.Ano == (short)alvo.Value);

        // ⚠️ Tipo ANÔNIMO, ⛔ não `record` posicional: o EF não traduz `GroupBy` com
        //    construtor posicional e falha em RUNTIME, não na compilação.
        var destinos = await doAno
            .Where(e => e.Localidade != null)
            .GroupBy(e => e.Localidade!)
            .Select(g => new
            {
                Localidade = g.Key,
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Count()
            })
            .OrderByDescending(d => d.Empenhado)
            .Take(ItensNaFicha)
            .ToListAsync(ct);

        var funcoes = await doAno
            .Where(e => e.Funcao != null)
            .GroupBy(e => e.Funcao!)
            .Select(g => new
            {
                Funcao = g.Key,
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago)
            })
            .OrderByDescending(f => f.Empenhado)
            .Take(ItensNaFicha)
            .ToListAsync(ct);

        // ⚠️ Os totais saem de uma agregação PRÓPRIA, ⛔ não da soma dos `Take(8)` acima
        //    — que mostrariam um total menor que o real sem nada indicar o corte.
        var totais = await doAno
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Count()
            })
            .FirstOrDefaultAsync(ct);

        return Results.Ok(new EmendasDoParlamentar(
            Ano: alvo.Value,
            Empenhado: totais?.Empenhado ?? 0,
            Pago: totais?.Pago ?? 0,
            Quantidade: totais?.Quantidade ?? 0,
            PorDestino: [.. destinos.Select(d =>
                new EmendaPorDestino(d.Localidade, d.Empenhado, d.Pago, d.Quantidade))],
            PorFuncao: [.. funcoes.Select(f =>
                new EmendaPorFuncao(f.Funcao, f.Empenhado, f.Pago))]));
    }

    /// <summary>
    /// O financiamento da campanha que elegeu o parlamentar.
    ///
    /// 🔴 Devolve o fundão e o fundo partidário **separados** — ver
    /// <see cref="FinanciamentoDeCampanha"/>.
    /// </summary>
    private static async Task<IResult> ObterFinanciamentoAsync(
        long id, PoligraphDb db, CancellationToken ct, int? eleicao = null)
    {
        var alvo = eleicao ?? await db.ReceitasDeCampanha.AsNoTracking()
            .Where(r => r.PessoaId == id)
            .MaxAsync(r => (int?)r.AnoEleicao, ct);

        if (alvo is null) return Results.Ok(new FinanciamentoDeCampanha(0, 0, 0, 0, [], []));

        var daEleicao = db.ReceitasDeCampanha.AsNoTracking()
            .Where(r => r.PessoaId == id && r.AnoEleicao == (short)alvo.Value);

        var fontes = await daEleicao
            .GroupBy(r => r.FonteReceita)
            .Select(g => new
            {
                Fonte = g.Key,
                Total = g.Sum(r => r.Valor),
                Lancamentos = g.Count()
            })
            .OrderByDescending(f => f.Total)
            .ToListAsync(ct);

        // ⚠️ Doador pessoa física aparece pelo NOME; o documento dele é hash e ⛔ nunca
        //    sai da API. RNF-13 — ver `Despesa.CnpjOuHash`, mesma regra.
        var doadores = await daEleicao
            .Where(r => r.Doador != null)
            .GroupBy(r => new { r.Doador, r.DoadorEhPessoaFisica })
            .Select(g => new
            {
                g.Key.Doador,
                g.Key.DoadorEhPessoaFisica,
                Total = g.Sum(r => r.Valor)
            })
            .OrderByDescending(d => d.Total)
            .Take(ItensNaFicha)
            .ToListAsync(ct);

        return Results.Ok(new FinanciamentoDeCampanha(
            AnoEleicao: alvo.Value,
            Total: fontes.Sum(f => f.Total),
            FundoEspecial: fontes
                .Where(f => f.Fonte == ReceitaDeCampanha.FonteFundoEspecial)
                .Sum(f => f.Total),
            FundoPartidario: fontes
                .Where(f => f.Fonte == ReceitaDeCampanha.FonteFundoPartidario)
                .Sum(f => f.Total),
            PorFonte: [.. fontes.Select(f =>
                new ReceitaPorFonte(f.Fonte, f.Total, f.Lancamentos))],
            MaioresDoadores: [.. doadores.Select(d =>
                new DoadorDoParlamentar(d.Doador!, d.Total, d.DoadorEhPessoaFisica))]));
    }

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    private static async Task<IResult> ObterFichaAsync(long id, PoligraphDb db, CancellationToken ct)
    {
        var pessoa = await db.Pessoas.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.NomeExibicao, p.NomeCivil, p.UrlFoto })
            .FirstOrDefaultAsync(ct);

        if (pessoa is null) return Results.NotFound();

        var legislatura = await Legislaturas.CorrenteAsync(db, ct);
        var votos = await UltimosVotosAsync(db, id, ct);
        var similares = await MaisSimilaresAsync(db, id, ct);
        var (partido, uf) = await FiliacaoAtualAsync(db, id, ct);

        return Results.Ok(new FichaParlamentar(
            pessoa.Id, pessoa.NomeExibicao, pessoa.NomeCivil,
            partido, uf, pessoa.UrlFoto,
            // 🔴 PL35 — só a legislatura corrente, igual à lista. Contar todas daria
            //    um número maior na ficha do que na lista, para a mesma pessoa.
            await db.Votos.CountAsync(
                v => v.PessoaId == id && v.Valor != null
                     && v.Votacao!.Legislatura == legislatura, ct),
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
