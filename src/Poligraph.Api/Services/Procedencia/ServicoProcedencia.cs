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
/// <para>
/// Número pequeno vem com as linhas (plano/10 §3): até <see cref="LimiteDaLista"/>, a lista de cada uma;
/// acima, só a contagem e os arquivos.
/// </para>
/// </remarks>
public class ServicoProcedencia(PoligraphDb db)
{
    /// <summary>Os contextos que a rota aceita, na ordem em que aparecem na ficha.</summary>
    public static readonly IReadOnlyList<string> Contextos =
        ["votos", "cota", "emendas", "campanha", "patrimonio", "painel", "pagamentos", "entidade",
         "governo-gastos", "governo-receitas", "governo-sigiloso"];

    /// <summary>Até quantas linhas o painel lista uma a uma.</summary>
    public const int LimiteDaLista = 50;

    private readonly PoligraphDb _db = db;

    /// <summary>A procedência de um número. Nulo quando o contexto não existe ou falta o parâmetro dele.</summary>
    /// <param name="pessoa">Obrigatória em todo contexto, menos <c>painel</c>.</param>
    /// <param name="legislatura">Sem ela, a corrente.</param>
    /// <param name="ano">Em <c>emendas</c> e <c>cota</c>, um ano em vez do mandato inteiro; em <c>campanha</c> e <c>patrimonio</c>, a eleição em vez da que deu o mandato.</param>
    /// <param name="casa">Só em <c>painel</c>.</param>
    /// <param name="de">Só em <c>pagamentos</c>: o primeiro ano da emenda, como no mapa.</param>
    /// <param name="ate">Só em <c>pagamentos</c>: o último ano da emenda.</param>
    /// <param name="cnpj">Só em <c>entidade</c>: a entidade que recebeu.</param>
    /// <param name="categoria">Só em <c>cota</c>: uma categoria de despesa, como a linha de "Em quê".</param>
    /// <param name="uf">Só em <c>pagamentos</c>: o que chegou a quem tem sede no estado, como a tabela do mapa.</param>
    /// <param name="municipio">Só em <c>pagamentos</c>: o que chegou a quem tem sede na cidade (código IBGE).</param>
    public async Task<ProcedenciaDto?> ObterAsync(
        string contexto, long? pessoa, short? legislatura, int? ano, TipoCasa? casa, int? de, int? ate,
        string? cnpj, string? categoria, string? uf, string? municipio, CancellationToken ct)
    {
        if (!Contextos.Contains(contexto)) return null;
        if (contexto.StartsWith("governo-", StringComparison.Ordinal))
            return de.HasValue && ate.HasValue ? await MontarAsync(DoGoverno(contexto, de.Value, ate.Value), ct) : null;
        if (contexto == "entidade")
            return cnpj?.Length == 14 && cnpj.All(char.IsAsciiDigit) ? await MontarAsync(DaEntidade(cnpj), ct) : null;
        if (contexto == "pagamentos")
        {
            if (!de.HasValue || !ate.HasValue) return null;
            if (uf is not null && (uf.Length != 2 || !uf.All(char.IsAsciiLetterUpper))) return null;
            if (municipio is not null && (municipio.Length != 7 || !municipio.All(char.IsAsciiDigit))) return null;
            return await MontarAsync(Pagamentos(de.Value, ate.Value, uf, municipio), ct);
        }
        if (contexto != "painel" && pessoa is null) return null;
        if (contexto == "painel" && casa is null) return null;

        var l = legislatura ?? await Legislaturas.CorrenteAsync(_db, ct);
        if (l is null) return null;

        var recorte = contexto switch
        {
            "votos" => Votos(pessoa!.Value, l.Value),
            "cota" => Cota(pessoa!.Value, l.Value, ano, categoria),
            "emendas" => Emendas(pessoa!.Value, l.Value, ano),
            "campanha" => Campanha(pessoa!.Value, l.Value, ano),
            "patrimonio" => Patrimonio(pessoa!.Value, l.Value, ano),
            _ => Painel(casa!.Value, l.Value)
        };

        return await MontarAsync(recorte, ct);
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

    /// <summary>A norma que obriga o órgão a publicar o dado, pelo conjunto de dados quando há norma própria.</summary>
    /// <remarks>
    /// <para>O conjunto sai da URL do arquivo: a cota da Câmara, a declaração de bens e a prestação de contas do TSE têm norma específica; o resto fica na norma do órgão.</para>
    /// <para>ATENÇÃO: as citações por artigo pedem conferência do autor antes de irem ao texto do TCC (Pendência 73).</para>
    /// </remarks>
    public static string BaseLegal(TipoFonteDeCarga fonte, string url) => fonte switch
    {
        TipoFonteDeCarga.CAMARA when url.Contains("/cotas/", StringComparison.Ordinal) =>
            "Ato da Mesa 43/2009 da Câmara (cota para o exercício da atividade parlamentar) e Lei 12.527/2011, art. 8º",
        TipoFonteDeCarga.CAMARA or TipoFonteDeCarga.SENADO =>
            "Lei 12.527/2011 (Lei de Acesso à Informação), art. 8º",
        TipoFonteDeCarga.TSE when url.Contains("bem_candidato", StringComparison.Ordinal) =>
            "Lei 9.504/1997 (Lei das Eleições), art. 11, § 1º, IV: a declaração de bens do candidato",
        TipoFonteDeCarga.TSE =>
            "Lei 9.504/1997 (Lei das Eleições), art. 28, § 4º: a divulgação das contas de campanha",
        TipoFonteDeCarga.PORTAL_TRANSPARENCIA =>
            "Lei Complementar 101/2000, art. 48-A, incluído pela Lei Complementar 131/2009 (Lei da Transparência)",
        TipoFonteDeCarga.IBGE =>
            "Lei 8.443/1992, art. 102: a estimativa anual da população por município",
        _ => "Decreto 8.777/2016 (Política de Dados Abertos do Executivo federal)"
    };

    private Recorte Votos(long pessoa, short legislatura)
    {
        var votos = _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == pessoa && (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Legislatura == legislatura);
        return new(
            $"Os votos com posição (Sim ou Não; abstenção não conta) desta pessoa nas votações da {legislatura}ª legislatura, "
            + "em plenário e comissões, uma linha por votação. É a mesma conta do número da ficha.",
            votos.Select(v => v.CargaId),
            votos.OrderByDescending(v => v.Votacao!.Data)
                .Select(v => new LinhaDaProcedenciaDto(
                    v.Votacao!.Descricao ?? v.VotacaoId, v.Valor == 1 ? "Sim" : "Não", v.Votacao.Data, null, null)));
    }

    private Recorte Cota(long pessoa, short legislatura, int? ano, string? categoria)
    {
        var (de, ate) = ano.HasValue ? (ano.Value, ano.Value) : Legislaturas.AnosDeDespesa(legislatura);
        var periodo = de == ate ? $"{de}" : $"{de} a {ate}";
        var despesas = _db.Despesas.AsNoTracking().Where(d => d.PessoaId == pessoa && d.Ano >= de && d.Ano <= ate);
        if (categoria is not null) despesas = despesas.Where(d => d.Categoria == categoria);
        return new(
            $"Os lançamentos da cota parlamentar desta pessoa em {periodo}"
            + (categoria is null ? "" : $", na categoria \"{categoria}\"")
            + ", pelo valor líquido. Estorno entra negativo.",
            despesas.Select(d => d.CargaId),
            despesas.OrderByDescending(d => d.ValorLiquido)
                .Select(d => new LinhaDaProcedenciaDto(
                    d.Fornecedor ?? "Fornecedor não informado", d.Categoria, d.DataEmissao, d.ValorLiquido, d.UrlDocumento)));
    }

    private Recorte Emendas(long pessoa, short legislatura, int? ano)
    {
        var (de, ate) = ano.HasValue ? (ano.Value, ano.Value) : Legislaturas.AnosDeEmenda(legislatura);
        var periodo = de == ate ? $"de {de}" : $"de {de} a {ate}";
        var emendas = _db.Emendas.AsNoTracking().Where(e => e.PessoaId == pessoa && e.Ano >= de && e.Ano <= ate);
        return new(
            $"As emendas {periodo} atribuídas a esta pessoa pelo código de autor, uma linha por "
            + "emenda e localidade, pelo valor empenhado. Só entra emenda com autor reconciliado.",
            emendas.Select(e => e.CargaId),
            emendas.OrderByDescending(e => e.ValorEmpenhado)
                .Select(e => new LinhaDaProcedenciaDto(
                    "Emenda " + e.CodigoEmenda, e.Localidade ?? e.Funcao, null, e.ValorEmpenhado, null)));
    }

    private Recorte Campanha(long pessoa, short legislatura, int? ano)
    {
        var eleicao = (short)(ano ?? Legislaturas.EleicaoDoMandato(legislatura));
        var receitas = _db.ReceitasDeCampanha.AsNoTracking().Where(r => r.PessoaId == pessoa && r.AnoEleicao == eleicao);
        return new(
            $"As receitas da campanha de {eleicao} desta pessoa, ao cargo da casa em que ela votou. "
            + "O documento do doador pessoa física fica guardado só como hash.",
            receitas.Select(r => r.CargaId),
            receitas.OrderByDescending(r => r.Valor)
                .Select(r => new LinhaDaProcedenciaDto(r.Doador ?? "Doador não informado", r.FonteReceita, null, r.Valor, null)));
    }

    private Recorte Patrimonio(long pessoa, short legislatura, int? ano)
    {
        var eleicao = (short)(ano ?? Legislaturas.EleicaoDoMandato(legislatura));
        var bens = _db.Patrimonios.AsNoTracking().Where(p => p.PessoaId == pessoa && p.AnoEleicao == eleicao);
        return new(
            $"Os bens declarados ao TSE na candidatura de {eleicao}, somados por tipo. "
            + "É autodeclaração: o TSE publica o que o candidato informou.",
            bens.Select(p => p.CargaId),
            bens.OrderByDescending(p => p.Valor)
                .Select(p => new LinhaDaProcedenciaDto(p.TipoBem, null, null, p.Valor, null)));
    }

    /// <remarks>
    /// <para>O mesmo filtro do mapa (<c>ServicoMapaDeEmendas.DoPeriodo</c> e <c>NoMapa</c>): o ano da emenda são os quatro primeiros dígitos do código; com estado ou cidade, só pessoa jurídica fora do intermediário, com a sede ligada por CNPJ.</para>
    /// </remarks>
    private Recorte Pagamentos(int de, int ate, string? uf, string? municipio)
    {
        var prefixos = Enumerable.Range(de, ate - de + 1).Select(a => a.ToString(System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking().Where(f => prefixos.Contains(f.CodigoEmenda.Substring(0, 4)));
        var lugar = "";
        if (uf is not null || municipio is not null)
        {
            pagamentos = pagamentos.Where(f => f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
                && _db.CnpjsMunicipio.Any(c => c.Cnpj == f.Documento
                    && (municipio != null ? c.CodigoIbge == municipio : c.Municipio!.Uf == uf)));
            lugar = municipio is not null ? ", a quem tem sede nesta cidade" : $", a quem tem sede em {uf}";
        }
        return new(
            $"Os pagamentos das emendas {(de == ate ? $"de {de}" : $"de {de} a {ate}")}{lugar}, do Portal da Transparência, "
            + "uma linha por emenda, mês e favorecido. O ano é o da emenda, e o pagamento pode ser de anos depois."
            + (lugar == "" ? "" : " A sede vem do cadastro de CNPJ da Receita Federal."),
            pagamentos.Select(f => f.CargaId),
            pagamentos.OrderByDescending(f => f.Valor)
                .Select(f => new LinhaDaProcedenciaDto(f.Nome ?? "Favorecido não informado", "Emenda " + f.CodigoEmenda, f.Competencia, f.Valor, null)));
    }

    /// <summary>Os números da página do Governo (Pendência 84), no mesmo período da página.</summary>
    /// <remarks>
    /// <para>O gasto soma a execução por função e os Encargos especiais do arquivo anual do orçamento. Os restos a pagar pagos vêm dos arquivos mensais de execução, que não entram como carga das linhas: a regra diz isso.</para>
    /// <para>O gasto sigiloso combina arquivos mensais do cartão e da execução, e suas linhas ficam sem carga; o painel diz quantas.</para>
    /// </remarks>
    private Recorte DoGoverno(string contexto, int de, int ate)
    {
        var periodo = de == ate ? $"de {de}" : $"de {de} a {ate}";
        return contexto switch
        {
            "governo-receitas" => new(
                $"A receita realizada do Poder Executivo federal {periodo}, por origem, do arquivo de receitas do Portal da Transparência, uma linha por ano, categoria e origem. "
                + "O que foi pego emprestado é a origem \"operações de crédito\" desse mesmo arquivo.",
                _db.ReceitasPorOrigem.AsNoTracking().Where(r => r.Ano >= de && r.Ano <= ate).Select(r => r.CargaId), null),
            "governo-sigiloso" => new(
                $"O gasto sigiloso {periodo}: cartão corporativo e ações marcadas como sigilosas, por órgão, dos arquivos mensais do Portal.",
                _db.GastosSigilosos.AsNoTracking().Where(g => g.Ano >= de && g.Ano <= ate).Select(g => g.CargaId), null),
            _ => new(
                $"O gasto pago do Poder Executivo federal {periodo}, do arquivo anual do orçamento do Portal da Transparência, uma linha por ano e função, mais os Encargos especiais por subfunção. "
                + "Os restos a pagar pagos somados vêm dos arquivos mensais de execução.",
                _db.OrcamentoPorFuncao.AsNoTracking().Where(o => o.Ano >= de && o.Ano <= ate).Select(o => o.CargaId)
                    .Concat(_db.EncargosEspeciais.AsNoTracking().Where(e => e.Ano >= de && e.Ano <= ate).Select(e => e.CargaId)), null),
        };
    }

    /// <remarks>
    /// <para>O mesmo filtro do índice de entidades (<c>ServicoEntidades.IndiceAsync</c>): pessoa jurídica que recebeu direto.</para>
    /// </remarks>
    private Recorte DaEntidade(string cnpj)
    {
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => f.Documento == cnpj && f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario);
        return new(
            "Os pagamentos de emenda a este CNPJ, de todos os anos carregados, do Portal da Transparência, "
            + "uma linha por emenda, mês e favorecido. Repasse feito por intermediário (como o Banco do Brasil) fica de fora.",
            pagamentos.Select(f => f.CargaId),
            pagamentos.OrderByDescending(f => f.Competencia)
                .Select(f => new LinhaDaProcedenciaDto("Emenda " + f.CodigoEmenda, null, f.Competencia, f.Valor, null)));
    }

    private Recorte Painel(TipoCasa casa, short legislatura)
    {
        var votacoes = _db.Votacoes.AsNoTracking()
            .Where(t => t.Casa == casa && t.Legislatura == legislatura && t.Plenario && _db.Votos.Any(v => v.VotacaoId == t.Id));
        return new(
            $"As votações de plenário da {legislatura}ª legislatura {(casa == TipoCasa.CAMARA ? "na Câmara" : "no Senado")} com voto nominal "
            + "registrado, uma linha por votação. É a mesma conta do painel: votação de comissão e votação sem voto nominal ficam de fora.",
            votacoes.Select(t => t.CargaId),
            votacoes.OrderByDescending(t => t.Data)
                .Select(t => new LinhaDaProcedenciaDto(t.Descricao ?? t.Id, null, t.Data, null, null)));
    }

    /// <summary>A contagem por arquivo e, quando o número é pequeno, as linhas.</summary>
    /// <remarks>
    /// <para>RISCO: nome de fornecedor, doador e favorecido passa por <see cref="TextoSemCpf"/>, como nas listas da ficha: o CPF não sai na tela.</para>
    /// </remarks>
    private async Task<ProcedenciaDto> MontarAsync(Recorte recorte, CancellationToken ct)
    {
        var porCarga = await recorte.Cargas
            .GroupBy(id => id)
            .Select(g => new { Id = g.Key, Linhas = g.Count() })
            .ToListAsync(ct);

        var ids = porCarga.Where(c => c.Id is not null).Select(c => c.Id!.Value).ToList();
        var linhas = porCarga.Where(c => c.Id is not null).ToDictionary(c => c.Id!.Value, c => c.Linhas);

        var detalhes = await _db.Cargas.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .ToListAsync(ct);

        var total = porCarga.Sum(c => c.Linhas);
        IReadOnlyList<LinhaDaProcedenciaDto>? lista = null;
        if (recorte.Linhas is not null && total <= LimiteDaLista)
            lista = [.. (await recorte.Linhas.Take(LimiteDaLista).ToListAsync(ct))
                .Select(l => l with { Descricao = TextoSemCpf.Limpar(l.Descricao) })];

        return new ProcedenciaDto(
            recorte.Regra,
            total,
            porCarga.Where(c => c.Id is null).Sum(c => c.Linhas),
            [.. detalhes
                .Select(c => new CargaDto(
                    c.Id, c.Fonte, Orgao(c.Fonte), BaseLegal(c.Fonte, c.Url), c.Url, c.BaixadoEm, c.Sha256, c.Bytes,
                    c.EtagDaFonte, c.ModificadoNaFonte, c.Comando, c.Versao, linhas[c.Id]))
                .OrderByDescending(c => c.Linhas)
                .ThenByDescending(c => c.BaixadoEm)],
            lista);
    }

    /// <summary>Um número: a regra, as cargas das linhas que entraram e, quando dá para listar, as linhas.</summary>
    private sealed record Recorte(string Regra, IQueryable<long?> Cargas, IQueryable<LinhaDaProcedenciaDto>? Linhas);
}
