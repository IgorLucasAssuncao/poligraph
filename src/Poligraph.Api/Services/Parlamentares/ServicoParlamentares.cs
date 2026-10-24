using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Services;

/// <summary>Lista e ficha do parlamentar — quem ele é, como votou e com quem se parece.</summary>
public partial class ServicoParlamentares(PoligraphDb db, CacheDeLeitura leitura)
{
    public const int TamanhoPadrao = 30;
    public const int TamanhoMaximo = 100;

    /// <summary>Quantos votos vêm na ficha, e em cada página seguinte.</summary>
    public const int VotosPorPagina = 20;

    /// <summary>Abaixo disto a busca não filtra: uma letra casaria com quase todo voto.</summary>
    public const int TamanhoMinimoDaBusca = 2;

    private const int SimilaresNaFicha = 10;

    /// <summary>A opção do <c>regexp_like</c> que ignora a diferença entre maiúscula e minúscula.</summary>
    private const string SemDiferencaDeCaixa = "i";

    /// <summary>Tempo máximo de uma expressão regular rodada na API, em milissegundos.</summary>
    private const int TempoMaximoDaExpressao = 100;


    private static readonly CompareInfo Comparacao = CultureInfo.GetCultureInfo("pt-BR").CompareInfo;

    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <summary>RF-34 — busca por nome, partido e UF, em páginas.</summary>
    /// <remarks>
    /// <para>Pendência 35 — "parlamentar" é quem votou na legislatura CORRENTE. Sem o recorte, a chegada da 58ª faria "explorar" listar ex-deputados junto dos atuais, e `NVotacoes` somaria mandatos diferentes. `null` só acontece em base sem votação nenhuma — antes do primeiro ETL. Aí a lista sai vazia, que é a resposta honesta.</para>
    /// <para>A lista cortava em 100 por ordem alfabética, sem avisar: de 745 parlamentares da 57ª, só os 100 primeiros em ordem alfabética chegavam à tela, e "quem seguir" escolhia o mais ativo entre eles. A página devolve o total, e o corte passa a ser visível.</para>
    /// <para>A busca por nome ignora caixa e acento: "jose" encontra "José".</para>
    /// <para>Com <c>anteriores</c>, entra também quem só votou em legislaturas passadas, cada um com o último mandato. Sem ele, que é o padrão, a lista é a de quem está em exercício: o histórico ocupa milhares de nomes, e quem chega procurando "meu deputado" não deve ter de atravessá-los.</para>
    /// </remarks>
    public async Task<PaginaDeParlamentaresDto> ListarAsync(
        string? nome, string? partido, Uf? ufPedida, TipoCasa? casa, bool anteriores,
        Legislatura? legislaturaPedida, TipoOrdemDaLista ordem, int pagina, int tamanho, CancellationToken ct)
    {
        var siglaDaUf = ufPedida?.Sigla;
        var legislatura = legislaturaPedida?.Numero;
        var corrente = await Legislaturas.CorrenteAsync(_db, ct);
        var todos = (anteriores ? await ListaComAnterioresAsync(ct) : await ListaDaLegislaturaAsync(legislatura, ct))
            .Where(p => casa is null || p.Casa == casa)
            .ToList();

        pagina = Math.Max(pagina, 1);
        tamanho = Math.Clamp(tamanho, 1, TamanhoMaximo);

        var filtrados = todos.Where(p =>
            (string.IsNullOrWhiteSpace(nome) || ContemNome(p.Nome, nome))
            && (string.IsNullOrWhiteSpace(partido) || p.Partido == partido)
            && (string.IsNullOrWhiteSpace(siglaDaUf) || p.Uf == siglaDaUf));

        var ordenados = ordem == TipoOrdemDaLista.VOTACOES
            ? filtrados.OrderByDescending(p => p.NVotacoes).ThenBy(p => p.Nome, Comparacao.GetStringComparer(CompareOptions.IgnoreCase))
            : filtrados.OrderBy(p => p.Nome, Comparacao.GetStringComparer(CompareOptions.IgnoreCase));

        var lista = ordenados.ToList();
        var emExercicio = await EmExercicioNaBase.IdsAsync(_db, ct);

        return new PaginaDeParlamentaresDto(
            Itens: [.. lista.Skip((pagina - 1) * tamanho).Take(tamanho)
                .Select(p => p with { EmExercicio = emExercicio?.Contains(p.IdPessoa) ?? p.Legislatura == corrente })],
            Pagina: pagina,
            Tamanho: tamanho,
            Total: lista.Count,
            Partidos: [.. todos.Select(p => p.Partido).Where(v => v != "").Distinct().Order(StringComparer.Ordinal)],
            Ufs: [.. todos.Select(p => p.Uf).Where(v => v != "").Distinct().Order(StringComparer.Ordinal)],
            LegislaturaCorrente: corrente);
    }

    /// <summary>RF-31 — ficha com dados, histórico de votos e mais similares.</summary>
    /// <remarks>
    /// <para>Pendência 35 — só a legislatura corrente, igual à lista. Contar todas daria um número maior na ficha do que na lista, para a mesma pessoa.</para>
    /// </remarks>
    /// <remarks>
    /// <para>A legislatura é a da PESSOA, não a corrente do site: um ex-deputado que só votou na 56ª abriria a ficha com zero votos. Pedida uma legislatura em que ela não votou, vale a última em que votou.</para>
    /// </remarks>
    public Task<FichaParlamentarDto?> ObterFichaAsync(IdPessoa idPessoa, Legislatura? legislatura, CancellationToken ct) =>
        _leitura.ObterAsync(("ficha", idPessoa.Valor, legislatura?.Numero), () => CalcularFichaAsync(idPessoa.Valor, legislatura?.Numero, ct));

    /// <summary>As legislaturas em que a pessoa votou, da mais recente, com a filiação do último voto de cada uma.</summary>
    /// <remarks>
    /// <para>Uma consulta por mandato para a filiação: são poucos por pessoa, e o último voto de cada grupo não se traduz numa consulta só.</para>
    /// <para>A casa entra no agrupamento: a casa é do mandato, não da pessoa.</para>
    /// <para>RISCO: `Min` e `Max` sobre a navegação (`v.Votacao.Data`) dentro de um `GroupBy` viram, no EF, uma subconsulta por grupo, juntando `votacoes` duas vezes. A junção explícita deixa a data como coluna da consulta, e o EF agrega no próprio `GROUP BY`. MEDIDO em 2026-10-18, Câmara, 57ª, banco local: a mediana de presença foi de 6,9 s para 0,22 s, com o mesmo resultado para os 643 deputados.</para>
    /// </remarks>
    private async Task<List<MandatoDto>> MandatosAsync(long idPessoa, CancellationToken ct)
    {
        var grupos = await (
                from v in _db.Votos.AsNoTracking()
                join vt in _db.Votacoes.AsNoTracking() on v.VotacaoId equals vt.Id
                where v.PessoaId == idPessoa
                group vt.Data by new { vt.Legislatura, vt.Casa } into g
                select new
                {
                    g.Key.Legislatura,
                    g.Key.Casa,
                    Quantos = g.Count(),
                    Primeiro = g.Min(),
                    Ultimo = g.Max(),
                })
            .OrderByDescending(g => g.Legislatura)
            .ToListAsync(ct);

        var mandatos = new List<MandatoDto>(grupos.Count);
        foreach (var grupo in grupos)
        {
            var ultimo = await _db.Votos.AsNoTracking()
                .Where(v => v.PessoaId == idPessoa
                         && v.Votacao!.Legislatura == grupo.Legislatura
                         && v.Votacao.Casa == grupo.Casa)
                .OrderByDescending(v => v.Votacao!.Data)
                .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                .FirstAsync(ct);

            mandatos.Add(new MandatoDto(
                grupo.Legislatura, grupo.Casa, Legislaturas.AnoInicial(grupo.Legislatura),
                ultimo.PartidoNoVoto ?? "", ultimo.UfNoVoto ?? "", grupo.Quantos, grupo.Primeiro, grupo.Ultimo));
        }

        return mandatos;
    }

    /// <summary>Em quantas votações de plenário da legislatura o parlamentar estava.</summary>
    /// <remarks>
    /// <para>Só plenário: na comissão vota quem é membro, e contar as dela como falta acusaria ausência de quem nem podia votar.</para>
    /// <para>Senado: a casa registra presença e ausência de cada senador em exercício, e a conta sai das linhas. Câmara: só quem votou tem linha, e a base são as votações de plenário entre o primeiro e o último voto do deputado.</para>
    /// </remarks>
    private async Task<PresencaDto?> PresencaAsync(long idPessoa, TipoCasa? casa, short? legislatura, CancellationToken ct)
    {
        if (casa is null || legislatura is null)
        {
            return null;
        }

        var porPresenca = await (
                from v in _db.Votos.AsNoTracking()
                join vt in _db.Votacoes.AsNoTracking() on v.VotacaoId equals vt.Id
                where v.PessoaId == idPessoa && vt.Casa == casa && vt.Legislatura == legislatura && vt.Plenario
                      && v.Presenca != null
                group vt.Data by v.Presenca into g
                select new { Presenca = g.Key, Quantos = g.Count(), Desde = g.Min(), Ate = g.Max() })
            .ToListAsync(ct);

        if (porPresenca.Count == 0)
        {
            return null;
        }

        var primeiraVotacao = porPresenca.Min(p => p.Desde);
        var ultimaVotacao = porPresenca.Max(p => p.Ate);
        int Quantos(PresencaNoVoto presenca) => porPresenca.FirstOrDefault(p => p.Presenca == presenca)?.Quantos ?? 0;

        var mediana = await MedianaDePresencaAsync(casa.Value, legislatura.Value, ct);

        if (casa == TipoCasa.SENADO)
        {
            return new PresencaDto(
                Quantos(PresencaNoVoto.PRESENTE),
                porPresenca.Sum(p => p.Quantos),
                Quantos(PresencaNoVoto.AUSENTE),
                Quantos(PresencaNoVoto.AUSENTE_JUSTIFICADO),
                JustificativaPublicada: true,
                primeiraVotacao, ultimaVotacao, mediana);
        }

        var presente = Quantos(PresencaNoVoto.PRESENTE);
        var votacoes = await _db.Votacoes.AsNoTracking().CountAsync(vt =>
            vt.Casa == casa && vt.Legislatura == legislatura && vt.Plenario && vt.Data >= primeiraVotacao && vt.Data <= ultimaVotacao, ct);

        return new PresencaDto(presente, votacoes, votacoes - presente, null, JustificativaPublicada: false, primeiraVotacao, ultimaVotacao, mediana);
    }

    /// <summary>
    /// A mediana da presença na casa e na legislatura, com a mesma conta da ficha de cada um. Em cache.
    /// </summary>
    /// <remarks>
    /// <para>Senado: presentes sobre os registros de cada senador. Câmara: presentes sobre as votações de plenário entre o primeiro e o último voto de cada deputado, que é como a ficha conta.</para>
    /// <para>RISCO: `Min` e `Max` sobre a navegação (`v.Votacao.Data`) dentro de um `GroupBy` viram, no EF, uma subconsulta por grupo, juntando `votacoes` duas vezes. A junção explícita deixa a data como coluna da consulta, e o EF agrega no próprio `GROUP BY`. MEDIDO em 2026-10-18, Câmara, 57ª, banco local: a mediana de presença foi de 6,9 s para 0,22 s, com o mesmo resultado para os 643 deputados.</para>
    /// </remarks>
    private async Task<double?> MedianaDePresencaAsync(TipoCasa casa, short legislatura, CancellationToken ct) =>
        await _leitura.ObterAsync(("mediana-presenca", casa, legislatura), async () =>
        {
            var porPessoa = await (
                    from v in _db.Votos.AsNoTracking()
                    join vt in _db.Votacoes.AsNoTracking() on v.VotacaoId equals vt.Id
                    where vt.Casa == casa && vt.Legislatura == legislatura && vt.Plenario && v.Presenca != null
                    group new { v.Presenca, vt.Data } by v.PessoaId into g
                    select new
                    {
                        Presentes = g.Count(x => x.Presenca == PresencaNoVoto.PRESENTE),
                        Registros = g.Count(),
                        Desde = g.Min(x => x.Data),
                        Ate = g.Max(x => x.Data),
                    })
                .ToListAsync(ct);
            if (porPessoa.Count == 0)
            {
                return (double?)null;
            }

            if (casa == TipoCasa.SENADO)
            {
                return Mediana([.. porPessoa.Where(p => p.Registros > 0).Select(p => (double)p.Presentes / p.Registros)]);
            }

            var datas = (await _db.Votacoes.AsNoTracking()
                    .Where(vt => vt.Casa == casa && vt.Legislatura == legislatura && vt.Plenario)
                    .Select(vt => vt.Data)
                    .ToListAsync(ct))
                .Order()
                .ToList();
            int NoIntervalo(DateOnly primeiroDia, DateOnly ultimoDia) =>
                Indice(datas, ultimoDia, depois: true) - Indice(datas, primeiroDia, depois: false);

            return Mediana([.. porPessoa
                .Select(p => (p.Presentes, Votacoes: NoIntervalo(p.Desde, p.Ate)))
                .Where(p => p.Votacoes > 0)
                .Select(p => (double)p.Presentes / p.Votacoes)]);
        });

    /// <summary>Quantas datas da lista ordenada são menores que <paramref name="data"/> (ou menores ou iguais, com <paramref name="depois"/>).</summary>
    private static int Indice(List<DateOnly> datas, DateOnly data, bool depois)
    {
        int baixo = 0, alto = datas.Count;
        while (baixo < alto)
        {
            var meio = (baixo + alto) / 2;
            if (datas[meio] < data || (depois && datas[meio] == data))
            {
                baixo = meio + 1;
            }
            else
            {
                alto = meio;
            }
        }
        return baixo;
    }

    /// <summary>O patrimônio declarado em cada candidatura, da mais recente. Nulo para pessoa inexistente.</summary>
    public async Task<PatrimonioDoParlamentarDto?> PatrimonioAsync(IdPessoa idPessoa, CancellationToken ct)
    {
        if (!await _db.Pessoas.AnyAsync(p => p.Id == idPessoa.Valor, ct))
        {
            return null;
        }

        var linhas = await _db.Patrimonios.AsNoTracking().Where(p => p.PessoaId == idPessoa.Valor).ToListAsync(ct);
        var porAno = linhas.GroupBy(l => (int)l.AnoEleicao).ToList();
        var foraDoPadrao = BensForaDoPadrao.CalcularAnos(porAno.Select(g => (g.Key, g.Sum(l => l.Valor))));

        return new PatrimonioDoParlamentarDto([.. porAno
            .OrderByDescending(g => g.Key)
            .Select(g => new DeclaracaoDeBensDto(
                g.Key,
                g.Sum(l => l.Valor),
                g.Sum(l => l.Quantidade),
                [.. g.OrderByDescending(l => l.Valor).Select(l => new BemPorTipoDto(l.TipoBem, l.Valor, l.Quantidade))],
                foraDoPadrao.Contains(g.Key)))]);
    }

    /// <summary>As redes na ordem em que se reconhecem: as grandes primeiro, o site próprio por último. Também a ficha do político (Pendência 90).</summary>
    public async Task<IReadOnlyList<RedeSocialDto>> RedesSociaisAsync(long idPessoa, CancellationToken ct) =>
        [.. (await _db.RedesSociais.AsNoTracking().Where(r => r.PessoaId == idPessoa).ToListAsync(ct))
            .OrderBy(r => r.Rede)
            .ThenBy(r => r.Url, StringComparer.Ordinal)
            .Select(r => new RedeSocialDto(r.Rede, r.Url, r.Fonte))];

    /// <summary>Os votos do parlamentar na legislatura corrente, do mais recente, em páginas.</summary>
    /// <remarks>
    /// <para>A ficha mostrava 20 dos ~845 votos do deputado mediano, sem dizer que havia mais. A primeira página é a mesma que vem na ficha.</para>
    /// <para><c>Total</c> conta também os registros sem posição (obstrução, ausência registrada), que a lista mostra e as "votações registradas" da ficha não contam. A tela diz a diferença.</para>
    /// <para>Devolve <c>null</c> para pessoa inexistente, e o endpoint responde 404.</para>
    /// <para><c>busca</c> procura na descrição da votação, na ementa e na matéria ("PEC 45/2019"), sem diferença de caixa nem de acento. Com ela, <c>Total</c> é o dos encontrados.</para>
    /// <para><c>semRito</c> tira as votações de rito (requerimento, urgência, adiamento), que são perto de um terço da lista e não entram na afinidade.</para>
    /// </remarks>
    public async Task<PaginaDto<VotoNaFichaDto>?> ListarVotosAsync(
        IdPessoa idPessoa, int pagina, int tamanho, Legislatura? legislaturaPedida, string? busca, bool semRito, CancellationToken ct)
    {
        var legislatura = legislaturaPedida?.Numero;
        if (!await _db.Pessoas.AnyAsync(p => p.Id == idPessoa.Valor, ct))
        {
            return null;
        }

        pagina = Math.Max(pagina, 1);
        tamanho = Math.Clamp(tamanho, 1, TamanhoMaximo);

        var legislaturaMostrada = await LegislaturaDaPessoaAsync(idPessoa.Valor, legislatura, ct);
        var votos = VotosDaPessoa(idPessoa.Valor, legislaturaMostrada, busca);
        if (semRito)
        {
            votos = votos.Where(v => v.Votacao!.Categoria != TipoCategoriaDeVotacao.PROCEDIMENTAL);
        }

        return new PaginaDto<VotoNaFichaDto>(
            await PaginaDeVotosAsync(votos, (pagina - 1) * tamanho, tamanho, ct),
            pagina, tamanho, await votos.CountAsync(ct));
    }

    /// <summary>A pedida, se a pessoa votou nela; senão a última em que votou. Nula sem voto.</summary>
    private async Task<short?> LegislaturaDaPessoaAsync(long idPessoa, short? pedida, CancellationToken ct)
    {
        var daPessoa = _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == idPessoa)
            .Select(v => v.Votacao!.Legislatura);

        if (pedida is not null && await daPessoa.AnyAsync(l => l == pedida, ct))
        {
            return pedida;
        }

        return await daPessoa.MaxAsync(l => (short?)l, ct);
    }

    /// <summary>Quem votou na legislatura corrente, com casa, partido e UF do último voto. Em cache.</summary>
    public Task<IReadOnlyList<ParlamentarNaListaDto>> ParlamentaresDaLegislaturaAsync(CancellationToken ct) =>
        ListaDaLegislaturaAsync(null, ct);

    /// <summary>
    /// Todo mundo que votou em alguma legislatura da base, cada um com o último mandato.
    /// Os em exercício primeiro. Em cache, por legislatura.
    /// </summary>
    public Task<IReadOnlyList<ParlamentarNaListaDto>> ParlamentaresDeTodasAsync(CancellationToken ct) =>
        ListaComAnterioresAsync(ct);

    /// <remarks>
    /// <para>Pendência 80 (2026-10-03): "votos com posição" é Sim ou Não, como no painel e na afinidade. A ficha contava a abstenção junto, e a lista também.</para>
    /// </remarks>
    private async Task<FichaParlamentarDto?> CalcularFichaAsync(long idPessoa, short? legislatura, CancellationToken ct)
    {
        var pessoa = await _db.Pessoas.AsNoTracking()
            .Where(p => p.Id == idPessoa)
            .Select(p => new { p.Id, p.NomeExibicao, p.NomeCivil, p.UrlFoto })
            .FirstOrDefaultAsync(ct);

        if (pessoa is null)
        {
            return null;
        }

        var mandatos = await MandatosAsync(idPessoa, ct);
        var mandato = mandatos.FirstOrDefault(m => m.Legislatura == legislatura) ?? mandatos.FirstOrDefault();
        var legislaturaMostrada = mandato?.Legislatura;
        var casa = mandato?.Casa;
        var partido = mandato?.Partido ?? "";

        return new FichaParlamentarDto(
            pessoa.Id, pessoa.NomeExibicao, casa, pessoa.NomeCivil,
            partido, mandato?.Uf ?? "", pessoa.UrlFoto,
            await _db.Votos.CountAsync(
                v => v.PessoaId == idPessoa && (v.Valor == 1 || v.Valor == -1)
                     && v.Votacao!.Legislatura == legislaturaMostrada, ct),
            mandato?.NRegistrosDeVoto ?? 0,
            await PaginaDeVotosAsync(VotosDaPessoa(idPessoa, legislaturaMostrada, null), 0, VotosPorPagina, ct),
            await MaisSimilaresAsync(idPessoa, casa, legislaturaMostrada, ct),
            await AlinhamentoAsync(idPessoa, casa, legislaturaMostrada, partido, ct),
            await PresencaAsync(idPessoa, casa, legislaturaMostrada, ct),
            await PaginaOficialAsync(idPessoa, casa, ct),
            await RedesSociaisAsync(idPessoa, ct),
            legislaturaMostrada,
            mandatos,
            await EmExercicioAsync(idPessoa, mandatos, ct));
    }

    /// <summary>Pela lista oficial; sem ela carregada, a regra antiga: votou na legislatura corrente.</summary>
    private async Task<bool> EmExercicioAsync(long idPessoa, IReadOnlyList<MandatoDto> mandatos, CancellationToken ct)
    {
        if (await EmExercicioNaBase.IdsAsync(_db, ct) is { } ids)
        {
            return ids.Contains(idPessoa);
        }

        var corrente = await Legislaturas.CorrenteAsync(_db, ct);
        return mandatos.Any(m => m.Legislatura == corrente);
    }

    /// <summary>Quem votou numa legislatura — sem ela, a corrente —, com a filiação do último voto. Em cache.</summary>
    private async Task<IReadOnlyList<ParlamentarNaListaDto>> ListaDaLegislaturaAsync(short? pedida, CancellationToken ct)
    {
        var legislatura = pedida ?? await Legislaturas.CorrenteAsync(_db, ct);
        if (legislatura is null)
        {
            return [];
        }

        return await _leitura.ObterAsync(("parlamentares", legislatura.Value), () =>
        {
            return MontarListaAsync(legislatura.Value, ct);
        }) ?? [];
    }

    /// <remarks>
    /// <para>Monta a partir da lista de cada legislatura, da mais recente para a mais antiga: a primeira em que a pessoa aparece é o último mandato dela. Reaproveita o cache de cada uma.</para>
    /// </remarks>
    private async Task<IReadOnlyList<ParlamentarNaListaDto>> ListaComAnterioresAsync(CancellationToken ct)
    {
        var legislaturas = await _db.Votacoes.AsNoTracking()
            .Select(v => v.Legislatura)
            .Distinct()
            .OrderByDescending(l => l)
            .ToListAsync(ct);

        var vistos = new HashSet<long>();
        var lista = new List<ParlamentarNaListaDto>();

        foreach (var legislatura in legislaturas)
        {
            var daLegislatura = await _leitura.ObterAsync(("parlamentares", legislatura), () =>
            {
                return MontarListaAsync(legislatura, ct);
            }) ?? [];

            lista.AddRange(daLegislatura.Where(p => vistos.Add(p.IdPessoa)));
        }

        return lista;
    }

    /// <remarks>
    /// <para>Três consultas agrupadas, e não duas subconsultas por pessoa: a versão anterior contava os votos e buscava o último voto para cada uma das 7.993 linhas do cadastro, 1,2 s por chamada. Agrupado, 260 ms.</para>
    /// <para>A filiação é a do último voto da pessoa na legislatura, numa passada só (`ROW_NUMBER` por pessoa, em ordem de data). Havendo mais de uma votação no último dia, qualquer uma serve: partido e UF não mudam dentro do dia.</para>
    /// <para>MEDIDO em 2026-10-18, 57ª, banco local: a versão anterior buscava o último dia de cada pessoa numa subconsulta e voltava todos os votos desse dia (1.361 linhas para 747 pessoas), em 6,5 s; esta devolve uma linha por pessoa, em 0,5 s, com a mesma filiação para todas.</para>
    /// </remarks>
    private async Task<IReadOnlyList<ParlamentarNaListaDto>> MontarListaAsync(
        short legislatura, CancellationToken ct)
    {
        var daLegislatura = _db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Legislatura == legislatura);

        var contagens = await daLegislatura
            .GroupBy(v => v.PessoaId)
            .Select(g => new { PessoaId = g.Key, NVotacoes = g.Count(v => v.Valor == 1 || v.Valor == -1) })
            .Where(c => c.NVotacoes > 0)
            .ToDictionaryAsync(c => c.PessoaId, c => c.NVotacoes, ct);

        var filiacoes = await daLegislatura
            .GroupBy(v => v.PessoaId)
            .Select(g => g
                .OrderByDescending(v => v.Votacao!.Data)
                .Select(v => new { v.PessoaId, v.PartidoNoVoto, v.UfNoVoto, v.Votacao!.Casa })
                .First())
            .ToDictionaryAsync(f => f.PessoaId, ct);

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
                contagens[p.Id], p.UrlFoto, legislatura);
        })];
    }

    private static bool ContemNome(string nome, string busca) =>
        Comparacao.IndexOf(nome, busca.Trim(), CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace) >= 0;

    /// <remarks>
    /// <para>Subconsulta, não `join`: a orientação é opcional, e um `join` sem `DefaultIfEmpty` sumiria com as votações que o Governo não orientou — que são justamente as mais comuns na ficha.</para>
    /// <para>"PL 4.133/2023" — a etiqueta curta que permite conferir na fonte. Não é enfeite: sem ela, quem quiser checar a ementa não tem por onde procurar.</para>
    /// </remarks>
    /// <summary>Os votos da pessoa na legislatura, filtrados pela busca quando houver.</summary>
    /// <remarks>
    /// <para>Procura na descrição, na ementa, nas palavras-chave da casa e na sigla com número. As palavras-chave (Pendência 70) são onde está o nome popular: "reforma tributária" não aparece na ementa da PEC 45/2019.</para>
    /// <para>Expressão regular, e não <c>unaccent</c>: a extensão não está no banco, e instalá-la seria migration para uma busca. A expressão troca cada vogal e o "c" pela classe com as variantes acentuadas — "tributaria" acha "tributária".</para>
    /// </remarks>
    private IQueryable<VotoModel> VotosDaPessoa(long idPessoa, short? legislatura, string? busca)
    {
        var votos = _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == idPessoa && v.Votacao!.Legislatura == legislatura);

        if (string.IsNullOrWhiteSpace(busca) || busca.Trim().Length < TamanhoMinimoDaBusca)
        {
            return votos;
        }

        foreach (var palavra in PalavrasDaBusca(busca))
        {
            var padrao = PadraoSemAcento(palavra);
            votos = votos.Where(v =>
                FuncoesDoBanco.CasaComPadrao(v.Votacao!.Descricao ?? "", padrao, SemDiferencaDeCaixa)
                || FuncoesDoBanco.CasaComPadrao(v.Votacao.Proposicao!.Ementa ?? "", padrao, SemDiferencaDeCaixa)
                || FuncoesDoBanco.CasaComPadrao(v.Votacao.Proposicao!.PalavrasChave ?? "", padrao, SemDiferencaDeCaixa)
                || FuncoesDoBanco.CasaComPadrao(
                    (v.Votacao.Proposicao!.SiglaTipo ?? "") + " " + v.Votacao.Proposicao.Numero + "/" + v.Votacao.Proposicao.Ano,
                    padrao, SemDiferencaDeCaixa));
        }

        return votos;
    }

    /// <summary>
    /// Cada palavra precisa aparecer, em qualquer ordem e em qualquer dos três campos:
    /// "sistema tributario" acha "Altera o Sistema Tributário Nacional". A matéria fica
    /// inteira — "PEC 45/2019" — porque separada viraria "PEC" em qualquer emenda.
    /// </summary>
    /// <remarks>
    /// <para>O nome popular ("reforma tributária", "arcabouço") ainda não acha: a ementa oficial não o usa, e as palavras-chave da Câmara não são ingeridas (Pendência 70).</para>
    /// </remarks>
    private static IEnumerable<string> PalavrasDaBusca(string busca)
    {
        var termo = busca.Trim();
        if (PadraoDeMateria().IsMatch(termo))
        {
            return [termo];
        }

        return termo.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(p => p.Length >= TamanhoMinimoDaBusca);
    }

    /// <summary>Sigla com número, com ou sem ano: "PEC 45/2019", "PL 2253". Procurada inteira, sem separar as palavras.</summary>
    [GeneratedRegex(@"^[A-Za-z]{2,5}\s*\d+(/\d{2,4})?$", RegexOptions.None, TempoMaximoDaExpressao)]
    private static partial Regex PadraoDeMateria();

    /// <summary>
    /// O termo como expressão regular que casa com ou sem acento. Os metacaracteres são
    /// escapados antes: "PEC 45/2019" e "art. 5" são procurados ao pé da letra.
    /// </summary>
    private static string PadraoSemAcento(string termo)
    {
        var padrao = new StringBuilder();
        foreach (var letra in Regex.Escape(SemAcento(termo).ToLowerInvariant()))
        {
            padrao.Append(letra switch
            {
                'a' => "[aáàâã]",
                'e' => "[eéê]",
                'i' => "[ií]",
                'o' => "[oóôõ]",
                'u' => "[uúü]",
                'c' => "[cç]",
                _ => letra.ToString(),
            });
        }

        return padrao.ToString();
    }

    private static string SemAcento(string texto) =>
        new([.. texto.Normalize(NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                        != System.Globalization.UnicodeCategory.NonSpacingMark)]);

    private async Task<List<VotoNaFichaDto>> PaginaDeVotosAsync(
        IQueryable<VotoModel> doFiltro, int pular, int quantos, CancellationToken ct)
    {
        var votos = await doFiltro
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
    /// Os mais parecidos, do grafo da casa e da legislatura que a ficha mostra.
    ///
    /// A similaridade é gravada uma vez por par, com `pessoa_a &lt; pessoa_b` (I3).
    /// Por isso a consulta precisa olhar os DOIS lados — senão metade dos vizinhos
    /// some, e some justamente para quem tem id alto.
    /// </summary>
    /// <remarks>
    /// <para>A ordem é a de <see cref="OrdemDeConcordancia"/>: lê todos os pares da pessoa (no máximo um por parlamentar da casa) e ordena em memória.</para>
    /// </remarks>
    private async Task<List<SimilarNaFichaDto>> MaisSimilaresAsync(
        long idPessoa, TipoCasa? casa, short? legislatura, CancellationToken ct)
    {
        if (casa is null || legislatura is null)
        {
            return [];
        }

        var execucao = await ExecucaoVigente.IdAsync(_db, casa.Value, legislatura.Value, ct);

        if (execucao is null)
        {
            return [];
        }

        var pares = await _db.Similaridades.AsNoTracking()
            .Where(s => s.ExecucaoId == execucao
                     && s.Metrica == TipoMetrica.CONCORDANCIA
                     && (s.PessoaA == idPessoa || s.PessoaB == idPessoa))
            .Select(s => new
            {
                Outro = s.PessoaA == idPessoa ? s.PessoaB : s.PessoaA,
                s.Valor,
                s.NVotacoesComuns
            })
            .ToListAsync(ct);
        pares = [.. pares
            .OrderByDescending(p => OrdemDeConcordancia.LimiteInferior(
                (int)Math.Round(p.Valor * p.NVotacoesComuns), p.NVotacoesComuns))
            .Take(SimilaresNaFicha)];

        var ids = pares.Select(p => p.Outro).ToList();
        var fichas = await _db.Pessoas.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.NomeExibicao,
                p.UrlFoto,
                Ultimo = p.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(p => p.Id, ct);

        return [.. pares.Select(p => new SimilarNaFichaDto(
            p.Outro,
            fichas.GetValueOrDefault(p.Outro)?.NomeExibicao ?? "",
            fichas.GetValueOrDefault(p.Outro)?.Ultimo?.PartidoNoVoto ?? "",
            p.Valor,
            p.NVotacoesComuns,
            fichas.GetValueOrDefault(p.Outro)?.UrlFoto,
            fichas.GetValueOrDefault(p.Outro)?.Ultimo?.UfNoVoto ?? ""))];
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
        long idPessoa, TipoCasa? casa, short? legislatura,
        string partido, CancellationToken ct)
    {
        if (casa is not TipoCasa.CAMARA || legislatura is null)
        {
            return null;
        }

        var execucaoId = await ExecucaoVigente.IdAsync(_db, TipoCasa.CAMARA, legislatura.Value, ct);

        if (execucaoId is null)
        {
            return null;
        }

        var metrica = await _db.NosMetrica.AsNoTracking()
            .Where(n => n.PessoaId == idPessoa && n.ExecucaoId == execucaoId)
            .Select(n => new { n.Governismo, n.Disciplina, n.BaseDisciplina })
            .FirstOrDefaultAsync(ct);

        if (metrica is null)
        {
            return null;
        }

        var baseGoverno = await BaseComparavelAsync(idPessoa, legislatura.Value, "Governo", ct);
        var (medianaGovernismo, medianaDisciplina) = await MedianasDaCasaAsync(execucaoId.Value, ct);

        return new AlinhamentoDto(
            metrica.Governismo, baseGoverno,
            metrica.Disciplina, metrica.BaseDisciplina ?? 0,
            metrica.Disciplina is null ? null : partido,
            medianaGovernismo, medianaDisciplina);
    }

    /// <summary>A mediana de governismo e de disciplina de quem está no grafo. Em cache, por execução.</summary>
    private async Task<(double?, double?)> MedianasDaCasaAsync(long execucaoId, CancellationToken ct) =>
        await _leitura.ObterAsync(("medianas", execucaoId), async () =>
        {
            var nos = await _db.NosMetrica.AsNoTracking()
                .Where(n => n.ExecucaoId == execucaoId)
                .Select(n => new { n.Governismo, n.Disciplina })
                .ToListAsync(ct);
            return (Mediana([.. nos.Where(n => n.Governismo != null).Select(n => n.Governismo!.Value)]),
                    Mediana([.. nos.Where(n => n.Disciplina != null).Select(n => n.Disciplina!.Value)]));
        });

    private static double? Mediana(List<double> valores)
    {
        if (valores.Count == 0)
        {
            return null;
        }

        valores.Sort();
        var meio = valores.Count / 2;
        return valores.Count % 2 == 1 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2;
    }

    /// <summary>
    /// Quantas votações têm posição dos DOIS lados — o denominador honesto.
    ///
    /// <c>Obstrução</c> e <c>Liberado</c> ficam de fora: a primeira é tática de
    /// quórum, a segunda é ausência de orientação. Nenhuma das duas é posição de mérito.
    /// </summary>
    private async Task<int> BaseComparavelAsync(
        long idPessoa, short legislatura, string bancada, CancellationToken ct) =>
        string.IsNullOrEmpty(bancada)
            ? 0
            : await _db.Votos.AsNoTracking()
                .CountAsync(v => v.PessoaId == idPessoa
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
    private async Task<string?> PaginaOficialAsync(long idPessoa, TipoCasa? casa, CancellationToken ct)
    {
        if (casa is null)
        {
            return null;
        }

        var fonte = casa.Value.ComoFonte();
        var idPessoaNaCasa = await _db.PessoaFonteIds.AsNoTracking()
            .Where(f => f.PessoaId == idPessoa && f.Fonte == fonte)
            .Select(f => f.IdExterno)
            .FirstOrDefaultAsync(ct);

        return FontesOficiais.Parlamentar(casa, idPessoaNaCasa);
    }

}
