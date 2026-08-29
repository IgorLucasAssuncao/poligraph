using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Api.Endpoints;

public record ParlamentarNaListaDto(
    long Id, string Nome, Casa? Casa, string Partido, string Uf, int NVotacoes, string? UrlFoto);

/// <summary>
/// Um voto da ficha, com o que a bancada do Governo pediu naquela votação.
///
/// <para>
/// ⭐ <c>OrientacaoDoGoverno</c> é o que transforma o voto em informação. "Votou Sim"
/// sozinho ⛔ não diz nada; "votou Sim quando o Governo pediu Não" diz.
/// </para>
///
/// <para>
/// ⚠️ Nula com frequência, e por três motivos diferentes que a tela ⛔ não deve
/// confundir: o Governo ⛔ não orientou aquela votação, orientou <c>Obstrução</c> ou
/// <c>Liberado</c> — que ⛔ não são posição de mérito —, ou a casa é o Senado, que ⛔ não
/// publica orientação.
/// </para>
/// </summary>
/// <summary>
/// Um voto na ficha do parlamentar.
///
/// <para>
/// 🔴 <c>Descricao</c> sozinha ⛔ NÃO diz sobre o que era a votação. Ela é o registro
/// processual — <i>"Aprovado o Substitutivo ao Projeto de Lei nº 4.133, de 2023,
/// adotado pelo relator da Comissão de Ciência, Tecnologia e Inovação"</i> — e informa o
/// NÚMERO do projeto, ⛔ não o assunto.
/// </para>
///
/// <para>
/// ⭐ <c>Ementa</c> é o que o projeto propõe, e é o que torna o voto legível para quem
/// ⛔ não acompanha o Congresso. Veio com a PL40; a ficha era o lugar que ainda ⛔ não a
/// usava.
/// </para>
///
/// <para>
/// ⚠️ Nula em <b>todo o Senado</b> e em parte da Câmara — a ingestão de proposições é só
/// da Câmara, e lá cobre 263 das 266 substantivas. A tela mostra a descrição quando
/// falta, ⛔ nunca um espaço em branco.
/// </para>
///
/// <para>
/// 🔴 <b><c>Categoria</c> ⛔ não é enfeite — sem ela a ementa MENTE.</b> 📐 Medido em
/// 2026-08-29: <b>43,2%</b> das linhas desta lista são <c>PROCEDIMENTAL</c>. Nelas a
/// ementa é do projeto em pauta, mas o voto foi num <i>requerimento</i> — e a linha
/// <i>"Institui o Imposto sobre Bens e Serviços"</i> ao lado de um "Sim" faria o leitor
/// concluir que a pessoa votou a favor da reforma tributária, quando ela votou sobre
/// rito. ⭐ É o modo de falha que este projeto persegue: plausível e errado.
/// </para>
/// </summary>
public record VotoNaFichaDto(
    string VotacaoId,
    DateOnly Data,
    string? Descricao,
    short? Valor,
    string? OrientacaoDoGoverno,
    string? Ementa,
    string? Materia,
    CategoriaDeVotacao Categoria);

public record SimilarNaFichaDto(long PessoaId, string Nome, string Partido, float Valor, int Comuns);

public record FichaParlamentarDto(
    long Id,
    string Nome,
    /// <summary>
    /// CAMARA ou SENADO, derivado do voto mais recente — como partido e UF.
    ///
    /// <para>
    /// Não vem de uma coluna em <c>pessoas</c>: a casa é do mandato, não da pessoa. 43
    /// nomes aparecem nas duas casas, e o deputado que virou senador deve poder ser uma
    /// pessoa só quando a ponte do achado #18 existir.
    /// </para>
    ///
    /// <para>
    /// ⭐ Nula quando a pessoa ainda não tem voto. Antes disto era string vazia, que era
    /// um terceiro valor da casa que o tipo agora ⛔ não admite.
    /// </para>
    /// </summary>
    Casa? Casa,
    string NomeCivil,
    string Partido,
    string Uf,
    /// <summary>🔴 URL na Câmara — ⛔ a imagem NÃO é rehospedada.</summary>
    string? UrlFoto,
    int NVotacoes,
    IReadOnlyList<VotoNaFichaDto> VotosRecentes,
    IReadOnlyList<SimilarNaFichaDto> MaisSimilares,
    AlinhamentoDto? Alinhamento);

/// <summary>
/// Com que frequência o parlamentar votou como pediram a ele.
///
/// <para>
/// ⭐ Carrega a BASE junto de cada proporção. <c>80%</c> sobre 15 votações e <c>80%</c>
/// sobre 900 são afirmações de força muito diferente, e a tela ⛔ nunca mostra uma sem
/// a outra — é a mesma regra da aresta do grafo.
/// </para>
///
/// <para>
/// ⚠️ Nulo para o Senado inteiro: lá ⛔ não existe orientação de bancada publicada.
/// Zero afirmaria "nunca seguiu o governo", e o que houve foi não haver o que comparar.
/// </para>
/// </summary>
public record AlinhamentoDto(
    double? Governismo, int BaseGovernismo,
    double? Disciplina, int BaseDisciplina,
    string? PartidoMedido);

/// <summary>
/// ⚠️ Agregado, ⛔ não a lista de 200 mil linhas. A ficha responde "quanto e em quê",
/// e o documento fiscal fica a um clique na Câmara.
/// </summary>
public record GastoPorCategoriaDto(string Categoria, decimal Total, int Lancamentos);

public record FornecedorDoParlamentarDto(
    string Nome, decimal Total, int Lancamentos, bool PessoaFisica);

public record GastoDeCotaDto(
    int Ano,
    decimal Total,
    int Lancamentos,
    IReadOnlyList<GastoPorCategoriaDto> PorCategoria,
    IReadOnlyList<FornecedorDoParlamentarDto> MaioresFornecedores);

public record EmendaPorDestinoDto(string Localidade, decimal Empenhado, decimal Pago, int Quantidade);

public record EmendaPorFuncaoDto(string Funcao, decimal Empenhado, decimal Pago);

/// <summary>
/// As emendas do parlamentar num ano.
///
/// <para>
/// 🔴 <b>Empenhado ⛔ ≠ pago, e a distância entre os dois é a informação.</b> Empenhar é
/// reservar; pagar é o dinheiro sair. Mostrar só um responderia metade da pergunta — e
/// seria a metade que favorece quem só anuncia.
/// </para>
/// </summary>
public record EmendasDoParlamentarDto(
    int Ano,
    decimal Empenhado,
    decimal Pago,
    int Quantidade,
    IReadOnlyList<EmendaPorDestinoDto> PorDestino,
    IReadOnlyList<EmendaPorFuncaoDto> PorFuncao);

public record ReceitaPorFonteDto(string Fonte, decimal Total, int Lancamentos);

public record DoadorDoParlamentarDto(string Nome, decimal Total, bool PessoaFisica);

/// <summary>
/// O financiamento da campanha que elegeu o parlamentar.
///
/// <para>
/// 🔴 <b>Fundo Especial e Fundo Partidário ficam SEPARADOS.</b> O primeiro é o "fundão"
/// (FEFC, 2017), eleitoral; o segundo custeia o partido o ano inteiro. Somá-los é
/// defensável, mas é uma afirmação — e quem a fizer que a assine.
/// </para>
/// </summary>
public record FinanciamentoDeCampanhaDto(
    int AnoEleicao,
    decimal Total,
    decimal FundoEspecial,
    decimal FundoPartidario,
    IReadOnlyList<ReceitaPorFonteDto> PorFonte,
    IReadOnlyList<DoadorDoParlamentarDto> MaioresDoadores);

public static class EndpointsParlamentares
{
    private const int LimiteLista = 100;
    private const int VotosNaFicha = 20;
    private const int SimilaresNaFicha = 10;

    /// <summary>Quantos fornecedores da cota aparecem na ficha.</summary>
    private const int FornecedoresExibidos = 8;

    /// <summary>Quantos destinos, funções e doadores aparecem na ficha.</summary>
    private const int ItensNaFicha = 8;

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
        if (legislatura is null) return Results.Ok(Array.Empty<ParlamentarNaListaDto>());

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
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto, v.Votacao!.Casa })
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

        return Results.Ok(lista.Select(p => new ParlamentarNaListaDto(
            p.Id, p.NomeExibicao, p.Ultimo?.Casa,
            p.Ultimo?.PartidoNoVoto ?? "", p.Ultimo?.UfNoVoto ?? "",
            p.NVotacoes, p.UrlFoto)));
    }

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
        if (alvo is null) return Results.Ok(new GastoDeCotaDto(0, 0, 0, [], []));

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
            .Select(c => new GastoPorCategoriaDto(c.Categoria, c.Total, c.Lancamentos))
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
            .Select(f => new FornecedorDoParlamentarDto(
                f.Fornecedor!, f.Total, f.Lancamentos, f.FornecedorEhPessoaFisica))
            .ToList();

        return Results.Ok(new GastoDeCotaDto(
            Ano: alvo.Value,
            Total: porCategoria.Sum(c => c.Total),
            Lancamentos: porCategoria.Sum(c => c.Lancamentos),
            PorCategoria: porCategoria,
            MaioresFornecedores: fornecedores));
    }

    /// <summary>
    /// As emendas do parlamentar, agregadas por ano.
    ///
    /// <para>
    /// ⭐ Só entra emenda <b>já reconciliada</b>. EmendaModel de comissão, de bancada e de
    /// autor não resolvido existe no banco e ⛔ não aparece aqui: atribuí-la por
    /// semelhança de nome seria inventar autoria.
    /// </para>
    /// </summary>
    private static async Task<IResult> ObterEmendasAsync(
        long id, PoligraphDb db, CancellationToken ct, int? ano = null)
    {
        var alvo = ano ?? await db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == id)
            .MaxAsync(e => (int?)e.Ano, ct);

        // Sem emenda é caso normal: a tela mostra estado vazio, ⛔ não erro.
        if (alvo is null) return Results.Ok(new EmendasDoParlamentarDto(0, 0, 0, 0, [], []));

        var doAno = db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == id && e.Ano == (short)alvo.Value);

        // ⚠️ Tipo ANÔNIMO, ⛔ não `record` posicional: o EF não traduz `GroupBy` com
        // construtor posicional e falha em RUNTIME, não na compilação.
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

        // 🔴 Agregação PRÓPRIA, ⛔ não a soma dos `Take(8)` acima: eles mostrariam um
        // total menor que o real, sem nada na tela indicando o corte.
        var totais = await doAno
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Empenhado = g.Sum(e => e.ValorEmpenhado),
                Pago = g.Sum(e => e.ValorPago),
                Quantidade = g.Count()
            })
            .FirstOrDefaultAsync(ct);

        return Results.Ok(new EmendasDoParlamentarDto(
            Ano: alvo.Value,
            Empenhado: totais?.Empenhado ?? 0,
            Pago: totais?.Pago ?? 0,
            Quantidade: totais?.Quantidade ?? 0,
            PorDestino: [.. destinos.Select(d =>
                new EmendaPorDestinoDto(d.Localidade, d.Empenhado, d.Pago, d.Quantidade))],
            PorFuncao: [.. funcoes.Select(f =>
                new EmendaPorFuncaoDto(f.Funcao, f.Empenhado, f.Pago))]));
    }

    /// <summary>
    /// O financiamento da campanha, com os dois fundos separados —
    /// ver <see cref="FinanciamentoDeCampanhaDto"/>.
    /// </summary>
    private static async Task<IResult> ObterFinanciamentoAsync(
        long id, PoligraphDb db, CancellationToken ct, int? eleicao = null)
    {
        var alvo = eleicao ?? await db.ReceitasDeCampanha.AsNoTracking()
            .Where(r => r.PessoaId == id)
            .MaxAsync(r => (int?)r.AnoEleicao, ct);

        if (alvo is null) return Results.Ok(new FinanciamentoDeCampanhaDto(0, 0, 0, 0, [], []));

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

        // 🔴 RNF-13: doador pessoa física aparece pelo NOME; o documento é hash e ⛔
        // nunca sai da API. Mesma regra de `DespesaModel.CnpjOuHash`.
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

        return Results.Ok(new FinanciamentoDeCampanhaDto(
            AnoEleicao: alvo.Value,
            Total: fontes.Sum(f => f.Total),
            FundoEspecial: fontes
                .Where(f => f.Fonte == ReceitaDeCampanhaModel.FonteFundoEspecial)
                .Sum(f => f.Total),
            FundoPartidario: fontes
                .Where(f => f.Fonte == ReceitaDeCampanhaModel.FonteFundoPartidario)
                .Sum(f => f.Total),
            PorFonte: [.. fontes.Select(f =>
                new ReceitaPorFonteDto(f.Fonte, f.Total, f.Lancamentos))],
            MaioresDoadores: [.. doadores.Select(d =>
                new DoadorDoParlamentarDto(d.Doador!, d.Total, d.DoadorEhPessoaFisica))]));
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
        var (casa, partido, uf) = await FiliacaoAtualAsync(db, id, ct);

        return Results.Ok(new FichaParlamentarDto(
            pessoa.Id, pessoa.NomeExibicao, casa, pessoa.NomeCivil,
            partido, uf, pessoa.UrlFoto,
            // 🔴 PL35 — só a legislatura corrente, igual à lista. Contar todas daria
            //    um número maior na ficha do que na lista, para a mesma pessoa.
            await db.Votos.CountAsync(
                v => v.PessoaId == id && v.Valor != null
                     && v.Votacao!.Legislatura == legislatura, ct),
            votos, similares,
            await AlinhamentoAsync(db, id, casa, legislatura, partido, ct)));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private static async Task<List<VotoNaFichaDto>> UltimosVotosAsync(
        PoligraphDb db, long id, CancellationToken ct) =>
        await db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id)
            .OrderByDescending(v => v.Votacao!.Data)
            .Take(VotosNaFicha)
            // ⚠️ Subconsulta, ⛔ não `join`: a orientação é opcional, e um `join` sem
            //    `DefaultIfEmpty` sumiria com as votações que o Governo não orientou —
            //    que são justamente as mais comuns na ficha.
            .Select(v => new VotoNaFichaDto(
                v.VotacaoId, v.Votacao!.Data, v.Votacao.Descricao, v.Valor,
                db.Orientacoes
                    .Where(o => o.VotacaoId == v.VotacaoId && o.Bancada == "Governo")
                    .Select(o => o.Orientacao)
                    .FirstOrDefault(),
                v.Votacao.Proposicao!.Ementa,
                // ⭐ "PL 4.133/2023" — a etiqueta curta que permite conferir na fonte.
                //    ⛔ Não é enfeite: sem ela, quem quiser checar a ementa ⛔ não tem
                //    por onde procurar.
                v.Votacao.Proposicao!.SiglaTipo + " "
                    + v.Votacao.Proposicao.Numero + "/" + v.Votacao.Proposicao.Ano,
                v.Votacao.Categoria))
            .ToListAsync(ct);

    /// <summary>
    /// Os mais parecidos, da execução mais recente.
    ///
    /// ⚠️ A similaridade é gravada uma vez por par, com `pessoa_a &lt; pessoa_b` (I3).
    /// Por isso a consulta precisa olhar os DOIS lados — senão metade dos vizinhos
    /// some, e some justamente para quem tem id alto.
    /// </summary>
    private static async Task<List<SimilarNaFichaDto>> MaisSimilaresAsync(
        PoligraphDb db, long id, CancellationToken ct)
    {
        var execucao = await db.Execucoes.AsNoTracking()
            .Where(e => e.Status == StatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        if (execucao is null) return [];

        var pares = await db.Similaridades.AsNoTracking()
            .Where(s => s.ExecucaoId == execucao
                     && s.Metrica == Metrica.CONCORDANCIA
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

        return [.. pares.Select(p => new SimilarNaFichaDto(
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
    /// <summary>
    /// Casa, partido e UF do voto mais recente.
    ///
    /// <para>
    /// A casa vem daqui, e não de <c>pessoa_fonte_ids</c>: quem atuou nas duas tem duas
    /// fontes, e a pergunta que a ficha responde é "onde essa pessoa está agora".
    /// </para>
    /// </summary>
    /// <summary>
    /// Governismo e disciplina, com a base de cada um.
    ///
    /// <para>
    /// ⚠️ As proporções vêm de <c>nos_metrica</c>, calculadas pelo ETL; as BASES são
    /// contadas aqui. Guardar a base também seria duplicar dado que a consulta já sabe
    /// produzir, e ela precisa aparecer na tela junto do número.
    /// </para>
    ///
    /// <para>
    /// ⛔ Devolve <c>null</c> no Senado e antes da primeira análise — ⛔ nunca zero.
    /// </para>
    /// </summary>
    private static async Task<AlinhamentoDto?> AlinhamentoAsync(
        PoligraphDb db, long id, Casa? casa, short? legislatura,
        string partido, CancellationToken ct)
    {
        if (casa is not Casa.CAMARA || legislatura is null) return null;

        // ⚠️ `NoMetricaModel` ⛔ não tem navegação para a execução — a chave é só o id.
        //    A execução mais recente CONCLUÍDA da casa é o recorte, o mesmo que o
        //    endpoint do grafo usa.
        var execucaoId = await db.Execucoes.AsNoTracking()
            .Where(e => e.Casa == Casa.CAMARA
                     && e.Legislatura == legislatura
                     && e.Status == StatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        if (execucaoId is null) return null;

        var metrica = await db.NosMetrica.AsNoTracking()
            .Where(n => n.PessoaId == id && n.ExecucaoId == execucaoId)
            .Select(n => new { n.Governismo, n.Disciplina })
            .FirstOrDefaultAsync(ct);

        if (metrica is null) return null;

        var baseGoverno = await BaseComparavelAsync(db, id, legislatura.Value, "Governo", ct);
        var basePartido = await BaseComparavelAsync(db, id, legislatura.Value, partido, ct);

        return new AlinhamentoDto(
            metrica.Governismo, baseGoverno,
            metrica.Disciplina, basePartido,
            // ⚠️ Diz CONTRA QUAL sigla a disciplina foi medida. Quem trocou de partido
            //    no meio do mandato tem a medida feita contra a do voto mais recente,
            //    e omitir isso deixaria o número sem referência.
            metrica.Disciplina is null ? null : partido);
    }

    /// <summary>
    /// Quantas votações têm posição dos DOIS lados — o denominador honesto.
    ///
    /// ⚠️ <c>Obstrução</c> e <c>Liberado</c> ficam de fora: a primeira é tática de
    /// quórum, a segunda é ausência de orientação. Nenhuma das duas é posição de mérito.
    /// </summary>
    private static async Task<int> BaseComparavelAsync(
        PoligraphDb db, long id, short legislatura, string bancada, CancellationToken ct) =>
        string.IsNullOrEmpty(bancada)
            ? 0
            : await db.Votos.AsNoTracking()
                .CountAsync(v => v.PessoaId == id
                              && v.Valor != null && v.Valor != 0
                              && v.Votacao!.Legislatura == legislatura
                              && db.Orientacoes.Any(o => o.VotacaoId == v.VotacaoId
                                                      && o.Bancada == bancada
                                                      && (o.Orientacao == "Sim"
                                                       || o.Orientacao == "Não")), ct);

    private static async Task<(Casa? Casa, string Partido, string Uf)> FiliacaoAtualAsync(
        PoligraphDb db, long id, CancellationToken ct)
    {
        var ultimo = await db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id)
            .OrderByDescending(v => v.Votacao!.Data)
            .Select(v => new { v.Votacao!.Casa, v.PartidoNoVoto, v.UfNoVoto })
            .FirstOrDefaultAsync(ct);

        return (ultimo?.Casa, ultimo?.PartidoNoVoto ?? "", ultimo?.UfNoVoto ?? "");
    }
}
