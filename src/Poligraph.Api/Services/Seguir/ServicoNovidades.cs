using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Constantes;

namespace Poligraph.Api.Services;

/// <summary>
/// "O que mudou" (Pendência 63): os cinco avisos sobre quem a pessoa segue. Todo aviso é um fato
/// registrado pela casa, tirado do dado que já está na base.
/// </summary>
/// <remarks>
/// <para>RISCO: lê a tabela <c>segue</c>, que é registro de convicção política (LGPD art. 5º, II). Nada aqui vai para log com nome de seguido, e nada passa pelo <see cref="CacheDeLeitura"/>: a chave do cache seria a lista de alguém.</para>
/// <para>DECISÃO: a janela é a do dado, não a do relógio (plano/09 §4.1). A semana termina na votação mais recente da base; o mês é o último fechado que a base tem.</para>
/// </remarks>
public class ServicoNovidades(PoligraphDb db)
{
    /// <summary>A semana dos avisos de voto, contando o último dia.</summary>
    public const int DiasDaSemana = 7;

    private static readonly HashSet<string> Posicoes = ["Sim", "Não"];

    private readonly PoligraphDb _db = db;

    /// <param name="desde">Início da janela dos avisos de voto; sem ele, os 7 dias que terminam na votação mais recente.</param>
    public async Task<NovidadesDto> ObterAsync(long idUsuario, DateOnly? desde, CancellationToken ct)
    {
        var seguidos = await _db.Segue.AsNoTracking()
            .Where(s => s.UsuarioId == idUsuario)
            .Select(s => new { s.PessoaId, s.Pessoa!.NomeExibicao })
            .ToDictionaryAsync(s => s.PessoaId, s => s.NomeExibicao, ct);
        var idsPessoasSeguidas = seguidos.Keys.ToList();

        var hoje = DateTimeOffset.UtcNow;
        var ultimoDia = await _db.Votacoes.AsNoTracking().Where(v => v.Plenario).MaxAsync(v => (DateOnly?)v.Data, ct)
            ?? new DateOnly(hoje.Year, hoje.Month, hoje.Day);
        var primeiroDia = desde ?? ultimoDia.AddDays(-(DiasDaSemana - 1));
        var inicioDoMes = new DateOnly(hoje.Year, hoje.Month, 1);

        if (idsPessoasSeguidas.Count == 0)
        {
            return new NovidadesDto(new PeriodoDeDiasDto(primeiroDia, ultimoDia), await AtualizacoesAsync(ct), [], [], [], [], []);
        }

        return new NovidadesDto(
            new PeriodoDeDiasDto(primeiroDia, ultimoDia),
            await AtualizacoesAsync(ct),
            await VotosNaSemanaAsync(idsPessoasSeguidas, seguidos, primeiroDia, ultimoDia, ct),
            await ContraOPartidoAsync(idsPessoasSeguidas, seguidos, primeiroDia, ultimoDia, ct),
            await TrocasDePartidoAsync(idsPessoasSeguidas, seguidos, primeiroDia, ultimoDia, ct),
            await GastosNaCotaAsync(idsPessoasSeguidas, seguidos, inicioDoMes, ct),
            await EmendasPagasAsync(idsPessoasSeguidas, seguidos, inicioDoMes, ct));
    }

    private async Task<IReadOnlyList<AtualizacaoDaFonteDto>> AtualizacoesAsync(CancellationToken ct)
    {
        var porFonte = await _db.Cargas.AsNoTracking()
            .GroupBy(c => c.Fonte)
            .Select(g => new { Fonte = g.Key, Ultima = g.Max(c => c.BaixadoEm) })
            .ToListAsync(ct);

        return [.. porFonte
            .OrderByDescending(f => f.Ultima)
            .Select(f => new AtualizacaoDaFonteDto(f.Fonte, Poligraph.Api.Textos.TextosDaProcedencia.Orgao(f.Fonte), f.Ultima))];
    }

    /// <summary>A1. A ausência só existe no Senado, que lista todo senador em exercício; na Câmara o campo vem nulo.</summary>
    private async Task<IReadOnlyList<VotosNaSemanaDto>> VotosNaSemanaAsync(
        List<long> idsPessoasSeguidas, Dictionary<long, string> nomes, DateOnly primeiroDia, DateOnly ultimoDia, CancellationToken ct)
    {
        var contagens = await _db.Votos.AsNoTracking()
            .Where(v => idsPessoasSeguidas.Contains(v.PessoaId) && v.Votacao!.Plenario
                && v.Votacao.Data >= primeiroDia && v.Votacao.Data <= ultimoDia)
            .GroupBy(v => new { v.PessoaId, v.Votacao!.Casa })
            .Select(g => new
            {
                g.Key.PessoaId,
                g.Key.Casa,
                Votou = g.Count(v => v.Valor != null),
                Ausente = g.Count(v => v.Presenca == PresencaNoVoto.AUSENTE),
                Justificado = g.Count(v => v.Presenca == PresencaNoVoto.AUSENTE_JUSTIFICADO)
            })
            .ToListAsync(ct);

        return [.. contagens
            .Where(c => c.Votou + c.Ausente + c.Justificado > 0)
            .OrderBy(c => nomes[c.PessoaId], StringComparer.CurrentCulture)
            .Select(c => new VotosNaSemanaDto(
                c.PessoaId, nomes[c.PessoaId], c.Casa, c.Votou,
                c.Casa == TipoCasa.SENADO ? c.Ausente : null,
                c.Casa == TipoCasa.SENADO ? c.Justificado : null))];
    }

    /// <summary>A2. A mesma regra da disciplina: <see cref="BancadaDoPartido"/>, e só orientação Sim ou Não conta.</summary>
    private async Task<IReadOnlyList<VotoContraOPartidoDto>> ContraOPartidoAsync(
        List<long> idsPessoasSeguidas, Dictionary<long, string> nomes, DateOnly primeiroDia, DateOnly ultimoDia, CancellationToken ct)
    {
        var votos = await _db.Votos.AsNoTracking()
            .Where(v => idsPessoasSeguidas.Contains(v.PessoaId) && v.Votacao!.Casa == TipoCasa.CAMARA && v.Votacao.Plenario
                && v.Votacao.Data >= primeiroDia && v.Votacao.Data <= ultimoDia && (v.Valor == 1 || v.Valor == -1))
            .Select(v => new
            {
                v.PessoaId,
                v.VotacaoId,
                v.Valor,
                v.PartidoNoVoto,
                v.Votacao!.Data,
                v.Votacao.Descricao,
                Sigla = v.Votacao.Proposicao!.SiglaTipo,
                Numero = v.Votacao.Proposicao.Numero,
                Ano = v.Votacao.Proposicao.Ano
            })
            .ToListAsync(ct);

        var votacoes = votos.Select(v => v.VotacaoId).Distinct().ToList();
        var orientacoes = (await _db.Orientacoes.AsNoTracking()
                .Where(o => votacoes.Contains(o.VotacaoId))
                .Select(o => new { o.VotacaoId, o.Bancada, o.Orientacao })
                .ToListAsync(ct))
            .GroupBy(o => o.VotacaoId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(o => o.Bancada, o => o.Orientacao));

        var contra = new List<VotoContraOPartidoDto>();
        foreach (var voto in votos)
        {
            if (!orientacoes.TryGetValue(voto.VotacaoId, out var daVotacao))
            {
                continue;
            }

            var bancada = BancadaDoPartido.Achar(voto.PartidoNoVoto, daVotacao.Keys);
            if (bancada is null || !Posicoes.Contains(daVotacao[bancada]))
            {
                continue;
            }

            var orientacao = daVotacao[bancada];
            if ((voto.Valor == 1) == (orientacao == "Sim"))
            {
                continue;
            }

            contra.Add(new VotoContraOPartidoDto(
                voto.PessoaId, nomes[voto.PessoaId], voto.VotacaoId, voto.Data,
                voto.Sigla is null ? null : $"{voto.Sigla} {voto.Numero}/{voto.Ano}",
                voto.Descricao, voto.PartidoNoVoto, bancada, orientacao, voto.Valor == 1 ? "Sim" : "Não",
                FontesOficiais.RegistroDaVotacao(TipoCasa.CAMARA, voto.VotacaoId)));
        }

        return [.. contra.OrderByDescending(c => c.Data).ThenBy(c => c.Nome, StringComparer.CurrentCulture)];
    }

    /// <summary>A3. O primeiro voto pela sigla nova, depois do último pela anterior, tem de cair na janela.</summary>
    /// <remarks>
    /// <para>Sigla vazia e "Sem registro" ficam de fora: era assim que os votos de 1998 sem partido apareciam, e contariam como troca.</para>
    /// </remarks>
    private async Task<IReadOnlyList<TrocaDePartidoDto>> TrocasDePartidoAsync(
        List<long> idsPessoasSeguidas, Dictionary<long, string> nomes, DateOnly primeiroDia, DateOnly ultimoDia, CancellationToken ct)
    {
        var votos = await _db.Votos.AsNoTracking()
            .Where(v => idsPessoasSeguidas.Contains(v.PessoaId) && v.Votacao!.Data <= ultimoDia
                && v.PartidoNoVoto != "" && v.PartidoNoVoto != VocabularioDasFontes.PartidoSemRegistro)
            .Select(v => new { v.PessoaId, v.PartidoNoVoto, v.Votacao!.Data, v.Votacao.Casa })
            .ToListAsync(ct);

        var trocas = new List<TrocaDePartidoDto>();
        foreach (var daPessoa in votos.GroupBy(v => v.PessoaId))
        {
            var ordenados = daPessoa.OrderByDescending(v => v.Data).ToList();
            var atual = ordenados[0];
            var anterior = ordenados.FirstOrDefault(v => v.PartidoNoVoto != atual.PartidoNoVoto);
            if (anterior is null)
            {
                continue;
            }

            var primeiro = ordenados
                .Where(v => v.PartidoNoVoto == atual.PartidoNoVoto && v.Data > anterior.Data)
                .Min(v => v.Data);
            if (primeiro < primeiroDia || primeiro > ultimoDia)
            {
                continue;
            }

            trocas.Add(new TrocaDePartidoDto(
                daPessoa.Key, nomes[daPessoa.Key], atual.Casa, anterior.PartidoNoVoto, atual.PartidoNoVoto, primeiro));
        }

        return [.. trocas.OrderByDescending(t => t.PrimeiroVoto)];
    }

    /// <summary>A4. O mês é o último fechado entre os gastos de quem a pessoa segue: a cota chega com semanas de atraso.</summary>
    /// <remarks>
    /// <para>RISCO: ano e mês comparados em separado. <c>ano * 100 + mes</c> contra um parâmetro faz o EF tipá-lo como <c>smallint</c>, e 202610 estoura antes de chegar ao banco.</para>
    /// </remarks>
    private async Task<IReadOnlyList<GastoNaCotaDto>> GastosNaCotaAsync(
        List<long> idsPessoasSeguidas, Dictionary<long, string> nomes, DateOnly inicioDoMes, CancellationToken ct)
    {
        var anoAberto = (short)inicioDoMes.Year;
        var mesAberto = (short)inicioDoMes.Month;
        var anoMinimo = (short)(inicioDoMes.Year - 1);

        var doPeriodo = _db.Despesas.AsNoTracking()
            .Where(d => idsPessoasSeguidas.Contains(d.PessoaId) && d.Ano >= anoMinimo
                && (d.Ano < anoAberto || (d.Ano == anoAberto && d.Mes < mesAberto)));

        var ultimo = await doPeriodo
            .OrderByDescending(d => d.Ano).ThenByDescending(d => d.Mes)
            .Select(d => new { d.Ano, d.Mes })
            .FirstOrDefaultAsync(ct);
        if (ultimo is null)
        {
            return [];
        }

        var (ano, mes) = (ultimo.Ano, ultimo.Mes);
        var casas = await CasaDoVotoMaisRecenteAsync(idsPessoasSeguidas, ct);
        var porCategoria = await doPeriodo
            .Where(d => d.Ano == ano && d.Mes == mes)
            .GroupBy(d => new { d.PessoaId, d.Categoria })
            .Select(g => new { g.Key.PessoaId, g.Key.Categoria, Total = g.Sum(d => d.ValorLiquido) })
            .ToListAsync(ct);

        return [.. porCategoria
            .GroupBy(c => c.PessoaId)
            .Select(g =>
            {
                var maior = g.MaxBy(c => c.Total)!;
                return new GastoNaCotaDto(
                    g.Key, nomes[g.Key], casas.GetValueOrDefault(g.Key), ano, mes, g.Sum(c => c.Total), maior.Categoria, maior.Total);
            })
            .Where(g => g.Total != 0)
            .OrderByDescending(g => g.Total)];
    }

    /// <summary>A casa do voto mais recente de cada pessoa seguida.</summary>
    /// <remarks>
    /// <para>Junção explícita com <c>votacoes</c>: o <c>Max</c> sobre a navegação viraria uma subconsulta por grupo (ver <c>ServicoParlamentares.MedianaDePresencaAsync</c>).</para>
    /// </remarks>
    private async Task<Dictionary<long, TipoCasa?>> CasaDoVotoMaisRecenteAsync(List<long> idsPessoasSeguidas, CancellationToken ct)
    {
        var porCasa = await (
                from v in _db.Votos.AsNoTracking()
                join vt in _db.Votacoes.AsNoTracking() on v.VotacaoId equals vt.Id
                where idsPessoasSeguidas.Contains(v.PessoaId)
                group vt.Data by new { v.PessoaId, vt.Casa } into g
                select new { g.Key.PessoaId, g.Key.Casa, Ultimo = g.Max() })
            .ToListAsync(ct);

        return porCasa
            .GroupBy(c => c.PessoaId)
            .ToDictionary(g => g.Key, g => (TipoCasa?)g.MaxBy(c => c.Ultimo)!.Casa);
    }

    /// <summary>A5. A competência é a última fechada entre os pagamentos das emendas de quem a pessoa segue.</summary>
    /// <remarks>
    /// <para>As emendas entram pelo código, distinto: a mesma emenda tem uma linha por localidade, e juntar pela tabela de emendas contaria o pagamento uma vez por localidade.</para>
    /// </remarks>
    private async Task<IReadOnlyList<EmendaPagaDto>> EmendasPagasAsync(
        List<long> idsPessoasSeguidas, Dictionary<long, string> nomes, DateOnly inicioDoMes, CancellationToken ct)
    {
        var autorDoCodigo = await _db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId != null && idsPessoasSeguidas.Contains(e.PessoaId.Value))
            .Select(e => new { e.CodigoEmenda, PessoaId = e.PessoaId!.Value })
            .Distinct()
            .ToDictionaryAsync(e => e.CodigoEmenda, e => e.PessoaId, ct);
        if (autorDoCodigo.Count == 0)
        {
            return [];
        }

        var codigos = autorDoCodigo.Keys.ToList();
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => codigos.Contains(f.CodigoEmenda) && f.Competencia < inicioDoMes);

        var mes = await pagamentos.MaxAsync(f => (DateOnly?)f.Competencia, ct);
        if (mes is null)
        {
            return [];
        }

        var doMes = await pagamentos
            .Where(f => f.Competencia == mes)
            .Select(f => new { f.CodigoEmenda, f.Valor, f.Nome, f.Municipio, f.Uf, f.Intermediario })
            .ToListAsync(ct);

        return [.. doMes
            .GroupBy(f => autorDoCodigo[f.CodigoEmenda])
            .Select(g =>
            {
                var destino = g.Where(f => !f.Intermediario && f.Nome != null)
                    .GroupBy(f => new { f.Nome, f.Municipio, f.Uf })
                    .Select(d => new { d.Key, Valor = d.Sum(f => f.Valor) })
                    .MaxBy(d => d.Valor);
                var lugar = destino?.Key.Municipio is { } m && destino.Key.Uf is { } uf ? $"{m} ({uf})" : destino?.Key.Uf;
                return new EmendaPagaDto(
                    g.Key, nomes[g.Key], mes.Value, g.Sum(f => f.Valor),
                    destino is null ? null : TextoSemCpf.Limpar(destino.Key.Nome!), lugar);
            })
            .Where(e => e.Pago != 0)
            .OrderByDescending(e => e.Pago)];
    }
}
