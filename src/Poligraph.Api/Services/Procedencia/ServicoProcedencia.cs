using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O modo análise (Pendência 73): para um número da tela, os arquivos de onde vieram as linhas que
/// entraram nele e a regra da conta.
/// </summary>
/// <remarks>
/// <para>
/// O recorte de cada contexto é o MESMO da tela que mostra o número: votos por legislatura,
/// cota pelos anos de despesa do mandato, emendas pelo ano, campanha e patrimônio pela eleição
/// do mandato. Um recorte diferente daria arquivos que não entraram na conta.
/// </para>
/// <para>
/// A linha gravada antes da Pendência 72 não tem carga. Ela entra em <c>LinhasSemCarga</c> e a tela diz
/// quantas são: omiti-la faria parecer que todo o número tem procedência.
/// </para>
/// </remarks>
public class ServicoProcedencia(PoligraphDb db)
{
    /// <summary>Os contextos que a rota aceita, na ordem em que aparecem na ficha.</summary>
    public static readonly IReadOnlyList<string> Contextos =
        ["votos", "cota", "emendas", "campanha", "patrimonio", "painel", "pagamentos", "entidade",
         "governo-gastos", "governo-receitas", "governo-sigiloso"];

    private readonly PoligraphDb _db = db;

    /// <summary>A procedência de um número. Nulo quando o contexto não existe ou falta o parâmetro dele.</summary>
    /// <param name="pessoa">Obrigatória em todo contexto, menos <c>painel</c>.</param>
    /// <param name="legislatura">Sem ela, a corrente.</param>
    /// <param name="ano">Em <c>emendas</c> e <c>cota</c>, um ano em vez do mandato inteiro; em <c>campanha</c> e <c>patrimonio</c>, a eleição em vez da que deu o mandato.</param>
    /// <param name="casa">Só em <c>painel</c>.</param>
    /// <param name="de">Só em <c>pagamentos</c>: o primeiro ano da emenda, como no mapa.</param>
    /// <param name="ate">Só em <c>pagamentos</c>: o último ano da emenda.</param>
    /// <param name="cnpj">Só em <c>entidade</c>: a entidade que recebeu.</param>
    public async Task<ProcedenciaDto?> ObterAsync(
        string contexto, long? pessoa, short? legislatura, int? ano, TipoCasa? casa, int? de, int? ate,
        string? cnpj, CancellationToken ct)
    {
        if (!Contextos.Contains(contexto)) return null;
        if (contexto.StartsWith("governo-", StringComparison.Ordinal))
        {
            if (de is not { } inicio || ate is not { } fim) return null;
            var (regraDoGoverno, cargasDoGoverno) = DoGoverno(contexto, inicio, fim);
            return await MontarAsync(regraDoGoverno, cargasDoGoverno, ct);
        }
        if (contexto == "entidade")
            return cnpj is { Length: 14 } c && c.All(char.IsAsciiDigit) ? await MontarAsync(RegraDaEntidade, DaEntidade(c), ct) : null;
        if (contexto == "pagamentos")
            return de is { } inicio && ate is { } fim ? await MontarAsync(RegraDosPagamentos(inicio, fim), Pagamentos(inicio, fim), ct) : null;
        if (contexto != "painel" && pessoa is null) return null;
        if (contexto == "painel" && casa is null) return null;

        var l = legislatura ?? await Legislaturas.CorrenteAsync(_db, ct);
        if (l is null) return null;

        var (regra, cargas) = contexto switch
        {
            "votos" => Votos(pessoa!.Value, l.Value),
            "cota" => Cota(pessoa!.Value, l.Value, ano),
            "emendas" => Emendas(pessoa!.Value, l.Value, ano),
            "campanha" => Campanha(pessoa!.Value, l.Value, ano),
            "patrimonio" => Patrimonio(pessoa!.Value, l.Value, ano),
            _ => Painel(casa!.Value, l.Value)
        };

        return await MontarAsync(regra, cargas, ct);
    }

    /// <summary>O órgão por extenso, para o painel.</summary>
    public static string Orgao(TipoFonteDeCarga fonte) => fonte switch
    {
        TipoFonteDeCarga.CAMARA => "Câmara dos Deputados",
        TipoFonteDeCarga.SENADO => "Senado Federal",
        TipoFonteDeCarga.TSE => "Tribunal Superior Eleitoral",
        TipoFonteDeCarga.PORTAL_TRANSPARENCIA => "Controladoria-Geral da União, Portal da Transparência",
        TipoFonteDeCarga.RECEITA => "Receita Federal",
        _ => "IBGE"
    };

    /// <summary>A norma que obriga o órgão a publicar o dado.</summary>
    /// <remarks>
    /// <para>ATENÇÃO: a citação é por órgão, não por arquivo. Uma norma mais específica por conjunto de dados (a resolução do TSE de cada eleição, por exemplo) fica para quando o autor conferir as citações.</para>
    /// </remarks>
    public static string BaseLegal(TipoFonteDeCarga fonte) => fonte switch
    {
        TipoFonteDeCarga.CAMARA or TipoFonteDeCarga.SENADO =>
            "Lei 12.527/2011 (Lei de Acesso à Informação), art. 8º",
        TipoFonteDeCarga.TSE => "Lei 9.504/1997 (Lei das Eleições) e Lei 12.527/2011",
        TipoFonteDeCarga.PORTAL_TRANSPARENCIA => "Lei Complementar 131/2009 (Lei da Transparência)",
        _ => "Decreto 8.777/2016 (Política de Dados Abertos do Executivo federal)"
    };

    private (string, IQueryable<long?>) Votos(long pessoa, short legislatura) =>
        ($"Os votos com posição (Sim ou Não; abstenção não conta) desta pessoa nas votações da {legislatura}ª legislatura, "
            + "em plenário e comissões, uma linha por votação. É a mesma conta do número da ficha.",
         _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == pessoa && (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Legislatura == legislatura)
            .Select(v => v.CargaId));

    private (string, IQueryable<long?>) Cota(long pessoa, short legislatura, int? ano)
    {
        var (de, ate) = ano is { } a ? (a, a) : Legislaturas.AnosDeDespesa(legislatura);
        var periodo = de == ate ? $"{de}" : $"{de} a {ate}";
        return ($"Os lançamentos da cota parlamentar desta pessoa em {periodo}, pelo valor líquido. "
                + "Estorno entra negativo.",
            _db.Despesas.AsNoTracking()
                .Where(d => d.PessoaId == pessoa && d.Ano >= de && d.Ano <= ate)
                .Select(d => d.CargaId));
    }

    private (string, IQueryable<long?>) Emendas(long pessoa, short legislatura, int? ano)
    {
        var (de, ate) = ano is { } a ? (a, a) : Legislaturas.AnosDeEmenda(legislatura);
        var periodo = de == ate ? $"de {de}" : $"de {de} a {ate}";
        return ($"As emendas {periodo} atribuídas a esta pessoa pelo código de autor, uma linha por "
                + "emenda e localidade. Só entra emenda com autor reconciliado.",
            _db.Emendas.AsNoTracking()
                .Where(e => e.PessoaId == pessoa && e.Ano >= de && e.Ano <= ate)
                .Select(e => e.CargaId));
    }

    private (string, IQueryable<long?>) Campanha(long pessoa, short legislatura, int? ano)
    {
        var eleicao = (short)(ano ?? Legislaturas.EleicaoDoMandato(legislatura));
        return ($"As receitas da campanha de {eleicao} desta pessoa, ao cargo da casa em que ela votou. "
                + "Doador pessoa física aparece só como hash.",
            _db.ReceitasDeCampanha.AsNoTracking()
                .Where(r => r.PessoaId == pessoa && r.AnoEleicao == eleicao)
                .Select(r => r.CargaId));
    }

    private (string, IQueryable<long?>) Patrimonio(long pessoa, short legislatura, int? ano)
    {
        var eleicao = (short)(ano ?? Legislaturas.EleicaoDoMandato(legislatura));
        return ($"Os bens declarados ao TSE na candidatura de {eleicao}, somados por tipo. "
                + "É autodeclaração: o TSE publica o que o candidato informou.",
            _db.Patrimonios.AsNoTracking()
                .Where(p => p.PessoaId == pessoa && p.AnoEleicao == eleicao)
                .Select(p => p.CargaId));
    }

    private static string RegraDosPagamentos(int de, int ate) =>
        $"Os pagamentos das emendas {(de == ate ? $"de {de}" : $"de {de} a {ate}")}, do Portal da Transparência, "
        + "uma linha por emenda, mês e favorecido. O ano é o da emenda, e o pagamento pode ser de anos depois.";

    /// <remarks>
    /// <para>O mesmo filtro do mapa (<c>ServicoMapaDeEmendas.DoPeriodo</c>): o ano da emenda são os quatro primeiros dígitos do código.</para>
    /// </remarks>
    private IQueryable<long?> Pagamentos(int de, int ate)
    {
        var prefixos = Enumerable.Range(de, ate - de + 1).Select(a => a.ToString(System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        return _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => prefixos.Contains(f.CodigoEmenda.Substring(0, 4)))
            .Select(f => f.CargaId);
    }

    /// <summary>Os números da página do Governo (Pendência 84), no mesmo período da página.</summary>
    /// <remarks>
    /// <para>O gasto soma a execução por função e os Encargos especiais do arquivo anual do orçamento. Os restos a pagar pagos vêm dos arquivos mensais de execução, que não entram como carga das linhas: a regra diz isso.</para>
    /// <para>O gasto sigiloso combina arquivos mensais do cartão e da execução, e suas linhas ficam sem carga; o painel diz quantas.</para>
    /// </remarks>
    private (string, IQueryable<long?>) DoGoverno(string contexto, int de, int ate)
    {
        var periodo = de == ate ? $"de {de}" : $"de {de} a {ate}";
        return contexto switch
        {
            "governo-receitas" => (
                $"A receita realizada do Poder Executivo federal {periodo}, por origem, do arquivo de receitas do Portal da Transparência, uma linha por ano, categoria e origem. "
                + "O que foi pego emprestado é a origem \"operações de crédito\" desse mesmo arquivo.",
                _db.ReceitasPorOrigem.AsNoTracking().Where(r => r.Ano >= de && r.Ano <= ate).Select(r => r.CargaId)),
            "governo-sigiloso" => (
                $"O gasto sigiloso {periodo}: cartão corporativo e ações marcadas como sigilosas, por órgão, dos arquivos mensais do Portal.",
                _db.GastosSigilosos.AsNoTracking().Where(g => g.Ano >= de && g.Ano <= ate).Select(g => g.CargaId)),
            _ => (
                $"O gasto pago do Poder Executivo federal {periodo}, do arquivo anual do orçamento do Portal da Transparência, uma linha por ano e função, mais os Encargos especiais por subfunção. "
                + "Os restos a pagar pagos somados vêm dos arquivos mensais de execução.",
                _db.OrcamentoPorFuncao.AsNoTracking().Where(o => o.Ano >= de && o.Ano <= ate).Select(o => o.CargaId)
                    .Concat(_db.EncargosEspeciais.AsNoTracking().Where(e => e.Ano >= de && e.Ano <= ate).Select(e => e.CargaId))),
        };
    }

    private const string RegraDaEntidade =
        "Os pagamentos de emenda a este CNPJ, de todos os anos carregados, do Portal da Transparência, "
        + "uma linha por emenda, mês e favorecido. Repasse feito por intermediário (como o Banco do Brasil) fica de fora.";

    /// <remarks>
    /// <para>O mesmo filtro do índice de entidades (<c>ServicoEntidades.IndiceAsync</c>): pessoa jurídica que recebeu direto.</para>
    /// </remarks>
    private IQueryable<long?> DaEntidade(string cnpj) =>
        _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => f.Documento == cnpj && f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario)
            .Select(f => f.CargaId);

    private (string, IQueryable<long?>) Painel(TipoCasa casa, short legislatura) =>
        ($"As votações de plenário da {legislatura}ª legislatura {(casa == TipoCasa.CAMARA ? "na Câmara" : "no Senado")} com voto nominal "
            + "registrado, uma linha por votação. É a mesma conta do painel: votação de comissão e votação sem voto nominal ficam de fora.",
         _db.Votacoes.AsNoTracking()
            .Where(t => t.Casa == casa && t.Legislatura == legislatura && t.Plenario && _db.Votos.Any(v => v.VotacaoId == t.Id))
            .Select(t => t.CargaId));

    private async Task<ProcedenciaDto> MontarAsync(string regra, IQueryable<long?> cargas, CancellationToken ct)
    {
        var porCarga = await cargas
            .GroupBy(id => id)
            .Select(g => new { Id = g.Key, Linhas = g.Count() })
            .ToListAsync(ct);

        var ids = porCarga.Where(c => c.Id is not null).Select(c => c.Id!.Value).ToList();
        var linhas = porCarga.Where(c => c.Id is not null).ToDictionary(c => c.Id!.Value, c => c.Linhas);

        var detalhes = await _db.Cargas.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .ToListAsync(ct);

        return new ProcedenciaDto(
            regra,
            porCarga.Sum(c => c.Linhas),
            porCarga.Where(c => c.Id is null).Sum(c => c.Linhas),
            [.. detalhes
                .Select(c => new CargaDto(
                    c.Id, c.Fonte, Orgao(c.Fonte), BaseLegal(c.Fonte), c.Url, c.BaixadoEm, c.Sha256, c.Bytes,
                    c.EtagDaFonte, c.ModificadoNaFonte, c.Comando, c.Versao, linhas[c.Id]))
                .OrderByDescending(c => c.Linhas)
                .ThenByDescending(c => c.BaixadoEm)]);
    }
}
