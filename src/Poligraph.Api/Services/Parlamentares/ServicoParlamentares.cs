using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>Lista e ficha do parlamentar — quem ele é, como votou e com quem se parece.</summary>
public class ServicoParlamentares(PoligraphDb db, IMemoryCache cache)
{
    public const int TamanhoPadrao = 30;
    public const int TamanhoMaximo = 100;

    /// <summary>Quantos votos vêm na ficha, e em cada página seguinte.</summary>
    public const int VotosPorPagina = 20;

    private const int SimilaresNaFicha = 10;

    /// <summary>
    /// Quanto a lista da legislatura fica em memória. Ela só muda quando o ETL roda, e
    /// montá-la custa ~260 ms: sem o cache, cada tecla da busca pagaria esse preço.
    /// </summary>
    private static readonly TimeSpan ValidadeDaLista = TimeSpan.FromMinutes(5);

    private static readonly CompareInfo Comparacao = CultureInfo.GetCultureInfo("pt-BR").CompareInfo;

    private readonly PoligraphDb _db = db;
    private readonly IMemoryCache _cache = cache;

    /// <summary>RF-34 — busca por nome, partido e UF, em páginas.</summary>
    /// <remarks>
    /// <para>PL35 — "parlamentar" é quem votou na legislatura CORRENTE. Sem o recorte, a chegada da 58ª faria "explorar" listar ex-deputados junto dos atuais, e `NVotacoes` somaria mandatos diferentes. `null` só acontece em base sem votação nenhuma — antes do primeiro ETL. Aí a lista sai vazia, que é a resposta honesta.</para>
    /// <para>A lista cortava em 100 por ordem alfabética, sem avisar: de 745 parlamentares da 57ª, só os 100 primeiros em ordem alfabética chegavam à tela, e "quem seguir" escolhia o mais ativo entre eles. A página devolve o total, e o corte passa a ser visível.</para>
    /// <para>A busca por nome ignora caixa e acento: "jose" encontra "José".</para>
    /// </remarks>
    public async Task<PaginaDeParlamentaresDto> ListarAsync(
        string? nome, string? partido, string? uf, TipoOrdemDaLista ordem,
        int pagina, int tamanho, CancellationToken ct)
    {
        var todos = await ListaDaLegislaturaAsync(ct);

        pagina = Math.Max(pagina, 1);
        tamanho = Math.Clamp(tamanho, 1, TamanhoMaximo);

        var filtrados = todos.Where(p =>
            (string.IsNullOrWhiteSpace(nome) || ContemNome(p.Nome, nome))
            && (string.IsNullOrWhiteSpace(partido) || p.Partido == partido)
            && (string.IsNullOrWhiteSpace(uf) || p.Uf == uf));

        var ordenados = ordem == TipoOrdemDaLista.VOTACOES
            ? filtrados.OrderByDescending(p => p.NVotacoes).ThenBy(p => p.Nome, Comparacao.GetStringComparer(CompareOptions.IgnoreCase))
            : filtrados.OrderBy(p => p.Nome, Comparacao.GetStringComparer(CompareOptions.IgnoreCase));

        var lista = ordenados.ToList();

        return new PaginaDeParlamentaresDto(
            Itens: [.. lista.Skip((pagina - 1) * tamanho).Take(tamanho)],
            Pagina: pagina,
            Tamanho: tamanho,
            Total: lista.Count,
            Partidos: [.. todos.Select(p => p.Partido).Where(v => v != "").Distinct().Order(StringComparer.Ordinal)],
            Ufs: [.. todos.Select(p => p.Uf).Where(v => v != "").Distinct().Order(StringComparer.Ordinal)]);
    }

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    /// <remarks>
    /// <para>PL35 — só a legislatura corrente, igual à lista. Contar todas daria um número maior na ficha do que na lista, para a mesma pessoa.</para>
    /// </remarks>
    public async Task<FichaParlamentarDto?> ObterFichaAsync(long id, CancellationToken ct)
    {
        var pessoa = await _db.Pessoas.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.NomeExibicao, p.NomeCivil, p.UrlFoto })
            .FirstOrDefaultAsync(ct);

        if (pessoa is null) return null;

        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);
        var votos = await UltimosVotosAsync(id, legislatura, 0, VotosPorPagina, ct);
        var similares = await MaisSimilaresAsync(id, ct);
        var (casa, partido, uf) = await FiliacaoAtualAsync(id, ct);

        return new FichaParlamentarDto(
            pessoa.Id, pessoa.NomeExibicao, casa, pessoa.NomeCivil,
            partido, uf, pessoa.UrlFoto,
            await _db.Votos.CountAsync(
                v => v.PessoaId == id && v.Valor != null
                     && v.Votacao!.Legislatura == legislatura, ct),
            await _db.Votos.CountAsync(
                v => v.PessoaId == id && v.Votacao!.Legislatura == legislatura, ct),
            votos, similares,
            await AlinhamentoAsync(id, casa, legislatura, partido, ct),
            await PresencaAsync(id, casa, legislatura, ct),
            await PaginaOficialAsync(id, casa, ct),
            await RedesSociaisAsync(id, ct));
    }

    /// <summary>Em quantas votações de plenário da legislatura o parlamentar estava.</summary>
    /// <remarks>
    /// <para>Só plenário: na comissão vota quem é membro, e contar as dela como falta acusaria ausência de quem nem podia votar.</para>
    /// <para>Senado: a casa registra presença e ausência de cada senador em exercício, e a conta sai das linhas. Câmara: só quem votou tem linha, e a base são as votações de plenário entre o primeiro e o último voto do deputado.</para>
    /// </remarks>
    private async Task<PresencaDto?> PresencaAsync(long id, TipoCasa? casa, short? legislatura, CancellationToken ct)
    {
        if (casa is null || legislatura is null) return null;

        var registros = _db.Votos.AsNoTracking().Where(v =>
            v.PessoaId == id && v.Votacao!.Casa == casa && v.Votacao.Legislatura == legislatura && v.Votacao.Plenario);

        var porPresenca = await registros
            .Where(v => v.Presenca != null)
            .GroupBy(v => v.Presenca)
            .Select(g => new { Presenca = g.Key, Quantos = g.Count(), Desde = g.Min(v => v.Votacao!.Data), Ate = g.Max(v => v.Votacao!.Data) })
            .ToListAsync(ct);

        if (porPresenca.Count == 0) return null;

        var desde = porPresenca.Min(p => p.Desde);
        var ate = porPresenca.Max(p => p.Ate);
        int Quantos(PresencaNoVoto presenca) => porPresenca.FirstOrDefault(p => p.Presenca == presenca)?.Quantos ?? 0;

        if (casa == TipoCasa.SENADO)
        {
            return new PresencaDto(
                Quantos(PresencaNoVoto.PRESENTE),
                porPresenca.Sum(p => p.Quantos),
                Quantos(PresencaNoVoto.AUSENTE),
                Quantos(PresencaNoVoto.AUSENTE_JUSTIFICADO),
                JustificativaPublicada: true,
                desde, ate);
        }

        var presente = Quantos(PresencaNoVoto.PRESENTE);
        var votacoes = await _db.Votacoes.AsNoTracking().CountAsync(vt =>
            vt.Casa == casa && vt.Legislatura == legislatura && vt.Plenario && vt.Data >= desde && vt.Data <= ate, ct);

        return new PresencaDto(presente, votacoes, votacoes - presente, null, JustificativaPublicada: false, desde, ate);
    }

    /// <summary>O patrimônio declarado em cada candidatura, da mais recente. Nulo para pessoa inexistente.</summary>
    public async Task<PatrimonioDoParlamentarDto?> PatrimonioAsync(long id, CancellationToken ct)
    {
        if (!await _db.Pessoas.AnyAsync(p => p.Id == id, ct)) return null;

        var linhas = await _db.Patrimonios.AsNoTracking().Where(p => p.PessoaId == id).ToListAsync(ct);

        return new PatrimonioDoParlamentarDto([.. linhas
            .GroupBy(l => l.AnoEleicao)
            .OrderByDescending(g => g.Key)
            .Select(g => new DeclaracaoDeBensDto(
                g.Key,
                g.Sum(l => l.Valor),
                g.Sum(l => l.Quantidade),
                [.. g.OrderByDescending(l => l.Valor).Select(l => new BemPorTipoDto(l.TipoBem, l.Valor, l.Quantidade))]))]);
    }

    /// <summary>As redes na ordem em que se reconhecem: as grandes primeiro, o site próprio por último.</summary>
    private async Task<IReadOnlyList<RedeSocialDto>> RedesSociaisAsync(long id, CancellationToken ct) =>
        [.. (await _db.RedesSociais.AsNoTracking().Where(r => r.PessoaId == id).ToListAsync(ct))
            .OrderBy(r => r.Rede)
            .ThenBy(r => r.Url, StringComparer.Ordinal)
            .Select(r => new RedeSocialDto(r.Rede, r.Url, r.Fonte))];

    /// <summary>Os votos do parlamentar na legislatura corrente, do mais recente, em páginas.</summary>
    /// <remarks>
    /// <para>A ficha mostrava 20 dos ~845 votos do deputado mediano, sem dizer que havia mais. A primeira página é a mesma que vem na ficha.</para>
    /// <para><c>Total</c> conta também os registros sem posição (obstrução, ausência registrada), que a lista mostra e as "votações registradas" da ficha não contam. A tela diz a diferença.</para>
    /// <para>Devolve <c>null</c> para pessoa inexistente, e o endpoint responde 404.</para>
    /// </remarks>
    public async Task<PaginaDto<VotoNaFichaDto>?> ListarVotosAsync(
        long id, int pagina, int tamanho, CancellationToken ct)
    {
        if (!await _db.Pessoas.AnyAsync(p => p.Id == id, ct)) return null;

        pagina = Math.Max(pagina, 1);
        tamanho = Math.Clamp(tamanho, 1, TamanhoMaximo);

        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);
        var total = await _db.Votos.CountAsync(
            v => v.PessoaId == id && v.Votacao!.Legislatura == legislatura, ct);

        return new PaginaDto<VotoNaFichaDto>(
            await UltimosVotosAsync(id, legislatura, (pagina - 1) * tamanho, tamanho, ct),
            pagina, tamanho, total);
    }

    /// <summary>Quem votou na legislatura corrente, com casa, partido e UF do último voto. Em cache.</summary>
    public Task<IReadOnlyList<ParlamentarNaListaDto>> ParlamentaresDaLegislaturaAsync(CancellationToken ct) =>
        ListaDaLegislaturaAsync(ct);

    /// <summary>Quem votou na legislatura corrente, com a filiação do último voto. Em cache.</summary>
    private async Task<IReadOnlyList<ParlamentarNaListaDto>> ListaDaLegislaturaAsync(CancellationToken ct)
    {
        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);
        if (legislatura is null) return [];

        return await _cache.GetOrCreateAsync(("parlamentares", legislatura.Value), entrada =>
        {
            entrada.AbsoluteExpirationRelativeToNow = ValidadeDaLista;
            return MontarListaAsync(legislatura.Value, ct);
        }) ?? [];
    }

    /// <remarks>
    /// <para>Três consultas agrupadas, e não duas subconsultas por pessoa: a versão anterior contava os votos e buscava o último voto para cada uma das 7.993 linhas do cadastro, 1,2 s por chamada. Agrupado, 260 ms.</para>
    /// <para>A filiação é a do último dia em que a pessoa votou. Havendo mais de uma votação nesse dia, qualquer uma serve: partido e UF não mudam dentro do dia.</para>
    /// </remarks>
    private async Task<IReadOnlyList<ParlamentarNaListaDto>> MontarListaAsync(
        short legislatura, CancellationToken ct)
    {
        var daLegislatura = _db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Legislatura == legislatura);

        var contagens = await daLegislatura
            .GroupBy(v => v.PessoaId)
            .Select(g => new { PessoaId = g.Key, NVotacoes = g.Count(v => v.Valor != null) })
            .Where(c => c.NVotacoes > 0)
            .ToDictionaryAsync(c => c.PessoaId, c => c.NVotacoes, ct);

        var ultimoDia = daLegislatura
            .GroupBy(v => v.PessoaId)
            .Select(g => new { PessoaId = g.Key, Data = g.Max(v => v.Votacao!.Data) });

        var filiacoes = (await (
                from v in daLegislatura
                join u in ultimoDia on new { v.PessoaId, v.Votacao!.Data } equals new { u.PessoaId, u.Data }
                select new { v.PessoaId, v.PartidoNoVoto, v.UfNoVoto, v.Votacao!.Casa })
            .ToListAsync(ct))
            .GroupBy(f => f.PessoaId)
            .ToDictionary(g => g.Key, g => g.First());

        var ids = contagens.Keys.ToList();
        var pessoas = await _db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.NomeExibicao, p.UrlFoto })
            .ToListAsync(ct);

        return [.. pessoas.Select(p =>
        {
            var filiacao = filiacoes.GetValueOrDefault(p.Id);
            return new ParlamentarNaListaDto(
                p.Id, p.NomeExibicao, filiacao?.Casa,
                filiacao?.PartidoNoVoto ?? "", filiacao?.UfNoVoto ?? "",
                contagens[p.Id], p.UrlFoto);
        })];
    }

    private static bool ContemNome(string nome, string busca) =>
        Comparacao.IndexOf(nome, busca.Trim(), CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace) >= 0;

    /// <remarks>
    /// <para>Subconsulta, não `join`: a orientação é opcional, e um `join` sem `DefaultIfEmpty` sumiria com as votações que o Governo não orientou — que são justamente as mais comuns na ficha.</para>
    /// <para>"PL 4.133/2023" — a etiqueta curta que permite conferir na fonte. Não é enfeite: sem ela, quem quiser checar a ementa não tem por onde procurar.</para>
    /// </remarks>
    private async Task<List<VotoNaFichaDto>> UltimosVotosAsync(
        long id, short? legislatura, int pular, int quantos, CancellationToken ct)
    {
        var votos = await _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id && v.Votacao!.Legislatura == legislatura)
            .OrderByDescending(v => v.Votacao!.Data)
            .ThenByDescending(v => v.VotacaoId)
            .Skip(pular)
            .Take(quantos)
            .Select(v => new
            {
                v.VotacaoId,
                v.Votacao!.Data,
                v.Votacao.Descricao,
                v.Valor,
                Orientacao = _db.Orientacoes
                    .Where(o => o.VotacaoId == v.VotacaoId && o.Bancada == "Governo")
                    .Select(o => o.Orientacao)
                    .FirstOrDefault(),
                v.Votacao.Proposicao!.Ementa,
                Materia = v.Votacao.Proposicao!.SiglaTipo + " "
                    + v.Votacao.Proposicao.Numero + "/" + v.Votacao.Proposicao.Ano,
                v.Votacao.Categoria,
                v.Votacao.Casa,
                v.Votacao.ProposicaoId
            })
            .ToListAsync(ct);

        return [.. votos.Select(v => new VotoNaFichaDto(
            v.VotacaoId, v.Data, v.Descricao, v.Valor, v.Orientacao, v.Ementa, v.Materia, v.Categoria,
            FontesOficiais.Proposicao(v.Casa, v.ProposicaoId),
            FontesOficiais.RegistroDaVotacao(v.Casa, v.VotacaoId)))];
    }

    /// <summary>
    /// Os mais parecidos, da execução mais recente.
    ///
    /// A similaridade é gravada uma vez por par, com `pessoa_a &lt; pessoa_b` (I3).
    /// Por isso a consulta precisa olhar os DOIS lados — senão metade dos vizinhos
    /// some, e some justamente para quem tem id alto.
    /// </summary>
    private async Task<List<SimilarNaFichaDto>> MaisSimilaresAsync(
        long id, CancellationToken ct)
    {
        var execucao = await _db.Execucoes.AsNoTracking()
            .Where(e => e.Status == TipoStatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        if (execucao is null) return [];

        var pares = await _db.Similaridades.AsNoTracking()
            .Where(s => s.ExecucaoId == execucao
                     && s.Metrica == TipoMetrica.CONCORDANCIA
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
        var fichas = await _db.Pessoas.AsNoTracking()
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
    /// Governismo e disciplina, com a base de cada um.
    ///
    /// <para>
    /// As proporções vêm de <c>nos_metrica</c>, calculadas pelo ETL; as BASES são
    /// contadas aqui. Guardar a base também seria duplicar dado que a consulta já sabe
    /// produzir, e ela precisa aparecer na tela junto do número.
    /// </para>
    ///
    /// <para>
    /// Devolve <c>null</c> no Senado e antes da primeira análise — nunca zero.
    /// </para>
    /// </summary>
    /// <remarks>
    /// <para>`NoMetricaModel` não tem navegação para a execução — a chave é só o id. A execução mais recente CONCLUÍDA da casa é o recorte, o mesmo que o endpoint do grafo usa.</para>
    /// <para>Diz CONTRA QUAL sigla a disciplina foi medida. Quem trocou de partido no meio do mandato tem a medida feita contra a do voto mais recente, e omitir isso deixaria o número sem referência.</para>
    /// </remarks>
    private async Task<AlinhamentoDto?> AlinhamentoAsync(
        long id, TipoCasa? casa, short? legislatura,
        string partido, CancellationToken ct)
    {
        if (casa is not TipoCasa.CAMARA || legislatura is null) return null;

        var execucaoId = await _db.Execucoes.AsNoTracking()
            .Where(e => e.Casa == TipoCasa.CAMARA
                     && e.Legislatura == legislatura
                     && e.Status == TipoStatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        if (execucaoId is null) return null;

        var metrica = await _db.NosMetrica.AsNoTracking()
            .Where(n => n.PessoaId == id && n.ExecucaoId == execucaoId)
            .Select(n => new { n.Governismo, n.Disciplina })
            .FirstOrDefaultAsync(ct);

        if (metrica is null) return null;

        var baseGoverno = await BaseComparavelAsync(id, legislatura.Value, "Governo", ct);
        var basePartido = await BaseComparavelAsync(id, legislatura.Value, partido, ct);

        return new AlinhamentoDto(
            metrica.Governismo, baseGoverno,
            metrica.Disciplina, basePartido,
            metrica.Disciplina is null ? null : partido);
    }

    /// <summary>
    /// Quantas votações têm posição dos DOIS lados — o denominador honesto.
    ///
    /// <c>Obstrução</c> e <c>Liberado</c> ficam de fora: a primeira é tática de
    /// quórum, a segunda é ausência de orientação. Nenhuma das duas é posição de mérito.
    /// </summary>
    private async Task<int> BaseComparavelAsync(
        long id, short legislatura, string bancada, CancellationToken ct) =>
        string.IsNullOrEmpty(bancada)
            ? 0
            : await _db.Votos.AsNoTracking()
                .CountAsync(v => v.PessoaId == id
                              && v.Valor != null && v.Valor != 0
                              && v.Votacao!.Legislatura == legislatura
                              && _db.Orientacoes.Any(o => o.VotacaoId == v.VotacaoId
                                                      && o.Bancada == bancada
                                                      && (o.Orientacao == "Sim"
                                                       || o.Orientacao == "Não")), ct);

    /// <summary>
    /// Casa, partido e UF do voto mais recente.
    ///
    /// <para>
    /// Vem do voto mais recente, não de uma coluna em <c>pessoa</c>.
    /// <c>partido_no_voto</c> é registro histórico — 14 deputados trocaram de legenda
    /// só em 2025, e a filiação "atual" é a do último voto conhecido.
    /// </para>
    ///
    /// <para>
    /// A casa vem daqui, e não de <c>pessoa_fonte_ids</c>: quem atuou nas duas tem
    /// duas fontes, e a pergunta que a ficha responde é "onde essa pessoa está agora".
    /// </para>
    /// </summary>
    /// <summary>A página do parlamentar na casa em que votou por último.</summary>
    private async Task<string?> PaginaOficialAsync(long id, TipoCasa? casa, CancellationToken ct)
    {
        if (casa is null) return null;

        var fonte = casa.Value.ComoFonte();
        var idNaCasa = await _db.PessoaFonteIds.AsNoTracking()
            .Where(f => f.PessoaId == id && f.Fonte == fonte)
            .Select(f => f.IdExterno)
            .FirstOrDefaultAsync(ct);

        return FontesOficiais.Parlamentar(casa, idNaCasa);
    }

    private async Task<(TipoCasa? Casa, string Partido, string Uf)> FiliacaoAtualAsync(
        long id, CancellationToken ct)
    {
        var ultimo = await _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id)
            .OrderByDescending(v => v.Votacao!.Data)
            .Select(v => new { v.Votacao!.Casa, v.PartidoNoVoto, v.UfNoVoto })
            .FirstOrDefaultAsync(ct);

        return (ultimo?.Casa, ultimo?.PartidoNoVoto ?? "", ultimo?.UfNoVoto ?? "");
    }
}
