using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>Lista e ficha do parlamentar — quem ele é, como votou e com quem se parece.</summary>
public class ServicoParlamentares(PoligraphDb db)
{
    private const int LimiteLista = 100;
    private const int VotosNaFicha = 20;
    private const int SimilaresNaFicha = 10;

    private readonly PoligraphDb _db = db;

    // ═══════════════════════════════════════════════════════════════
    // PÚBLICOS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>RF-34 — busca por nome, partido e UF.</summary>
    public async Task<IReadOnlyList<ParlamentarNaListaDto>> ListarAsync(
        string? nome, string? partido, string? uf, CancellationToken ct)
    {
        // 🔴 PL35 — "parlamentar" é quem votou na legislatura CORRENTE.
        //
        // ⚠️ Sem o recorte, a chegada da 58ª faria "explorar" listar ex-deputados junto
        //    dos atuais, e `NVotacoes` somaria mandatos diferentes. Nada quebraria: só
        //    apareceria gente que ⛔ não está mais lá, com um número inflado.
        //
        // ⭐ `null` só acontece em base sem votação nenhuma — antes do primeiro ETL. Aí
        //    a lista sai vazia, que é a resposta honesta.
        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);
        if (legislatura is null) return [];

        var consulta = _db.Pessoas.AsNoTracking()
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

        return [.. lista.Select(p => new ParlamentarNaListaDto(
            p.Id, p.NomeExibicao, p.Ultimo?.Casa,
            p.Ultimo?.PartidoNoVoto ?? "", p.Ultimo?.UfNoVoto ?? "",
            p.NVotacoes, p.UrlFoto))];
    }

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    public async Task<FichaParlamentarDto?> ObterFichaAsync(long id, CancellationToken ct)
    {
        var pessoa = await _db.Pessoas.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.NomeExibicao, p.NomeCivil, p.UrlFoto })
            .FirstOrDefaultAsync(ct);

        if (pessoa is null) return null;

        var legislatura = await Legislaturas.CorrenteAsync(_db, ct);
        var votos = await UltimosVotosAsync(id, ct);
        var similares = await MaisSimilaresAsync(id, ct);
        var (casa, partido, uf) = await FiliacaoAtualAsync(id, ct);

        return new FichaParlamentarDto(
            pessoa.Id, pessoa.NomeExibicao, casa, pessoa.NomeCivil,
            partido, uf, pessoa.UrlFoto,
            // 🔴 PL35 — só a legislatura corrente, igual à lista. Contar todas daria
            //    um número maior na ficha do que na lista, para a mesma pessoa.
            await _db.Votos.CountAsync(
                v => v.PessoaId == id && v.Valor != null
                     && v.Votacao!.Legislatura == legislatura, ct),
            votos, similares,
            await AlinhamentoAsync(id, casa, legislatura, partido, ct));
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVADOS — na ordem de uso
    // ═══════════════════════════════════════════════════════════════

    private async Task<List<VotoNaFichaDto>> UltimosVotosAsync(
        long id, CancellationToken ct) =>
        await _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == id)
            .OrderByDescending(v => v.Votacao!.Data)
            .Take(VotosNaFicha)
            // ⚠️ Subconsulta, ⛔ não `join`: a orientação é opcional, e um `join` sem
            //    `DefaultIfEmpty` sumiria com as votações que o Governo não orientou —
            //    que são justamente as mais comuns na ficha.
            .Select(v => new VotoNaFichaDto(
                v.VotacaoId, v.Votacao!.Data, v.Votacao.Descricao, v.Valor,
                _db.Orientacoes
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
    /// ⚠️ As proporções vêm de <c>nos_metrica</c>, calculadas pelo ETL; as BASES são
    /// contadas aqui. Guardar a base também seria duplicar dado que a consulta já sabe
    /// produzir, e ela precisa aparecer na tela junto do número.
    /// </para>
    ///
    /// <para>
    /// ⛔ Devolve <c>null</c> no Senado e antes da primeira análise — ⛔ nunca zero.
    /// </para>
    /// </summary>
    private async Task<AlinhamentoDto?> AlinhamentoAsync(
        long id, TipoCasa? casa, short? legislatura,
        string partido, CancellationToken ct)
    {
        if (casa is not TipoCasa.CAMARA || legislatura is null) return null;

        // ⚠️ `NoMetricaModel` ⛔ não tem navegação para a execução — a chave é só o id.
        //    A execução mais recente CONCLUÍDA da casa é o recorte, o mesmo que o
        //    endpoint do grafo usa.
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
    /// ⚠️ Vem do voto mais recente, ⛔ não de uma coluna em <c>pessoa</c>.
    /// <c>partido_no_voto</c> é registro histórico — 14 deputados trocaram de legenda
    /// só em 2025, e a filiação "atual" é a do último voto conhecido.
    /// </para>
    ///
    /// <para>
    /// A casa vem daqui, e ⛔ não de <c>pessoa_fonte_ids</c>: quem atuou nas duas tem
    /// duas fontes, e a pergunta que a ficha responde é "onde essa pessoa está agora".
    /// </para>
    /// </summary>
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
