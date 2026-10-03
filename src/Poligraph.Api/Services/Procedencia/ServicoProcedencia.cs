using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Textos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// O modo auditoria (Pendência 73): para um número da tela, os arquivos de onde vieram as linhas que
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
    /// <summary>Até quantas linhas o painel lista uma a uma.</summary>
    public const int LimiteDaLista = 50;

    private readonly PoligraphDb _db = db;

    /// <summary>A procedência de um número. Nulo quando falta o parâmetro que o contexto pede.</summary>
    public async Task<ProcedenciaDto?> ObterAsync(ConsultaDeProcedencia consulta, CancellationToken ct)
    {
        var recorte = await RecorteAsync(consulta, ct);
        if (recorte is null)
        {
            return null;
        }

        return await MontarAsync(recorte, ct);
    }

    private async Task<Recorte?> RecorteAsync(ConsultaDeProcedencia consulta, CancellationToken ct)
    {
        switch (consulta.Contexto.Tipo)
        {
            case TipoDeContexto.GovernoGastos:
            case TipoDeContexto.GovernoReceitas:
            case TipoDeContexto.GovernoSigiloso:
                return consulta.Periodo is { } periodoDoGoverno ? DoGoverno(consulta.Contexto.Tipo, periodoDoGoverno) : null;
            case TipoDeContexto.Entidade:
                return consulta.Cnpj is { } cnpj ? DaEntidade(cnpj) : null;
            case TipoDeContexto.Pagamentos:
                return consulta.Periodo is { } periodo ? Pagamentos(periodo, consulta.Uf, consulta.Municipio) : null;
        }

        var legislatura = consulta.Legislatura ?? await LegislaturaCorrenteAsync(ct);
        if (legislatura is null)
        {
            return null;
        }

        if (consulta.Contexto.Tipo == TipoDeContexto.Painel)
        {
            return consulta.Casa is { } casa ? Painel(casa, legislatura.Value) : null;
        }

        if (consulta.Pessoa is not { } pessoa)
        {
            return null;
        }

        return consulta.Contexto.Tipo switch
        {
            TipoDeContexto.Votos => Votos(pessoa, legislatura.Value),
            TipoDeContexto.Cota => Cota(pessoa, legislatura.Value, consulta.Ano, consulta.Categoria),
            TipoDeContexto.Emendas => Emendas(pessoa, legislatura.Value, consulta.Ano),
            TipoDeContexto.Campanha => Campanha(pessoa, legislatura.Value, consulta.Ano),
            _ => Patrimonio(pessoa, legislatura.Value, consulta.Ano),
        };
    }

    private async Task<Legislatura?> LegislaturaCorrenteAsync(CancellationToken ct) =>
        await Legislaturas.CorrenteAsync(_db, ct) is { } numero ? new Legislatura(numero) : null;

    private Recorte Votos(PessoaId pessoa, Legislatura legislatura)
    {
        var votos = _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == pessoa.Valor && (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Legislatura == legislatura.Numero);
        return new(
            TextosDaProcedencia.Votos(legislatura),
            votos.Select(v => v.CargaId),
            votos.OrderByDescending(v => v.Votacao!.Data)
                .Select(v => new LinhaDaProcedenciaDto(
                    v.Votacao!.Descricao ?? v.VotacaoId,
                    v.Valor == 1 ? TextosDaProcedencia.Sim : TextosDaProcedencia.Nao,
                    v.Votacao.Data, null, null)));
    }

    private Recorte Cota(PessoaId pessoa, Legislatura legislatura, Ano? ano, CategoriaDeDespesa? categoria)
    {
        var (de, ate) = ano.HasValue ? (ano.Value.Valor, ano.Value.Valor) : Legislaturas.AnosDeDespesa(legislatura.Numero);
        var despesas = _db.Despesas.AsNoTracking().Where(d => d.PessoaId == pessoa.Valor && d.Ano >= de && d.Ano <= ate);
        if (categoria is { } escolhida)
        {
            despesas = despesas.Where(d => d.Categoria == escolhida.Nome);
        }

        return new(
            TextosDaProcedencia.Cota(de, ate, categoria),
            despesas.Select(d => d.CargaId),
            despesas.OrderByDescending(d => d.ValorLiquido)
                .Select(d => new LinhaDaProcedenciaDto(
                    d.Fornecedor ?? TextosDaProcedencia.FornecedorNaoInformado, d.Categoria, d.DataEmissao, d.ValorLiquido, d.UrlDocumento)));
    }

    private Recorte Emendas(PessoaId pessoa, Legislatura legislatura, Ano? ano)
    {
        var (de, ate) = ano.HasValue ? (ano.Value.Valor, ano.Value.Valor) : Legislaturas.AnosDeEmenda(legislatura.Numero);
        var emendas = _db.Emendas.AsNoTracking().Where(e => e.PessoaId == pessoa.Valor && e.Ano >= de && e.Ano <= ate);
        return new(
            TextosDaProcedencia.Emendas(de, ate),
            emendas.Select(e => e.CargaId),
            emendas.OrderByDescending(e => e.ValorEmpenhado)
                .Select(e => new LinhaDaProcedenciaDto(
                    TextosDaProcedencia.Emenda(e.CodigoEmenda), e.Localidade ?? e.Funcao, null, e.ValorEmpenhado, null)));
    }

    private Recorte Campanha(PessoaId pessoa, Legislatura legislatura, Ano? ano)
    {
        var eleicao = (short)(ano?.Valor ?? Legislaturas.EleicaoDoMandato(legislatura.Numero));
        var receitas = _db.ReceitasDeCampanha.AsNoTracking().Where(r => r.PessoaId == pessoa.Valor && r.AnoEleicao == eleicao);
        return new(
            TextosDaProcedencia.Campanha(eleicao),
            receitas.Select(r => r.CargaId),
            receitas.OrderByDescending(r => r.Valor)
                .Select(r => new LinhaDaProcedenciaDto(r.Doador ?? TextosDaProcedencia.DoadorNaoInformado, r.FonteReceita, null, r.Valor, null)));
    }

    private Recorte Patrimonio(PessoaId pessoa, Legislatura legislatura, Ano? ano)
    {
        var eleicao = (short)(ano?.Valor ?? Legislaturas.EleicaoDoMandato(legislatura.Numero));
        var bens = _db.Patrimonios.AsNoTracking().Where(p => p.PessoaId == pessoa.Valor && p.AnoEleicao == eleicao);
        return new(
            TextosDaProcedencia.Patrimonio(eleicao),
            bens.Select(p => p.CargaId),
            bens.OrderByDescending(p => p.Valor)
                .Select(p => new LinhaDaProcedenciaDto(p.TipoBem, null, null, p.Valor, null)));
    }

    /// <remarks>
    /// <para>O mesmo filtro do mapa (<c>ServicoMapaDeEmendas.DoPeriodo</c> e <c>NoMapa</c>): o ano da emenda são os quatro primeiros dígitos do código; com estado ou cidade, só pessoa jurídica fora do intermediário, com a sede ligada por CNPJ.</para>
    /// </remarks>
    private Recorte Pagamentos(Periodo periodo, Uf? uf, CodigoIbge? municipio)
    {
        var prefixos = periodo.Anos.Select(a => a.ToString(CultureInfo.InvariantCulture)).ToArray();
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking().Where(f => prefixos.Contains(f.CodigoEmenda.Substring(0, 4)));
        if (municipio is { } cidade)
        {
            pagamentos = pagamentos.Where(f => f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
                && _db.CnpjsMunicipio.Any(c => c.Cnpj == f.Documento && c.CodigoIbge == cidade.Digitos));
        }
        else if (uf is { } estado)
        {
            pagamentos = pagamentos.Where(f => f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
                && _db.CnpjsMunicipio.Any(c => c.Cnpj == f.Documento && c.Municipio!.Uf == estado.Sigla));
        }

        return new(
            TextosDaProcedencia.Pagamentos(periodo, uf, municipio),
            pagamentos.Select(f => f.CargaId),
            pagamentos.OrderByDescending(f => f.Valor)
                .Select(f => new LinhaDaProcedenciaDto(
                    f.Nome ?? TextosDaProcedencia.FavorecidoNaoInformado, TextosDaProcedencia.Emenda(f.CodigoEmenda), f.Competencia, f.Valor, null)));
    }

    /// <summary>Os números da página do Governo (Pendência 84), no mesmo período da página.</summary>
    /// <remarks>
    /// <para>O gasto soma a execução por função e os Encargos especiais do arquivo anual do orçamento. Os restos a pagar pagos vêm dos arquivos mensais de execução, que não entram como carga das linhas: a regra diz isso.</para>
    /// <para>O gasto sigiloso combina arquivos mensais do cartão e da execução, e suas linhas ficam sem carga; o painel diz quantas.</para>
    /// </remarks>
    private Recorte DoGoverno(TipoDeContexto contexto, Periodo periodo)
    {
        var (de, ate) = (periodo.De.Valor, periodo.Ate.Valor);
        return contexto switch
        {
            TipoDeContexto.GovernoReceitas => new(
                TextosDaProcedencia.GovernoReceitas(periodo),
                _db.ReceitasPorOrigem.AsNoTracking().Where(r => r.Ano >= de && r.Ano <= ate).Select(r => r.CargaId), null),
            TipoDeContexto.GovernoSigiloso => new(
                TextosDaProcedencia.GovernoSigiloso(periodo),
                _db.GastosSigilosos.AsNoTracking().Where(g => g.Ano >= de && g.Ano <= ate).Select(g => g.CargaId), null),
            _ => new(
                TextosDaProcedencia.GovernoGastos(periodo),
                _db.OrcamentoPorFuncao.AsNoTracking().Where(o => o.Ano >= de && o.Ano <= ate).Select(o => o.CargaId)
                    .Concat(_db.EncargosEspeciais.AsNoTracking().Where(e => e.Ano >= de && e.Ano <= ate).Select(e => e.CargaId)), null),
        };
    }

    /// <remarks>
    /// <para>O mesmo filtro do índice de entidades (<c>ServicoEntidades.IndiceAsync</c>): pessoa jurídica que recebeu direto.</para>
    /// </remarks>
    private Recorte DaEntidade(Cnpj cnpj)
    {
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking()
            .Where(f => f.Documento == cnpj.Digitos && f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario);
        return new(
            TextosDaProcedencia.Entidade,
            pagamentos.Select(f => f.CargaId),
            pagamentos.OrderByDescending(f => f.Competencia)
                .Select(f => new LinhaDaProcedenciaDto(TextosDaProcedencia.Emenda(f.CodigoEmenda), null, f.Competencia, f.Valor, null)));
    }

    private Recorte Painel(TipoCasa casa, Legislatura legislatura)
    {
        var votacoes = _db.Votacoes.AsNoTracking()
            .Where(t => t.Casa == casa && t.Legislatura == legislatura.Numero && t.Plenario && _db.Votos.Any(v => v.VotacaoId == t.Id));
        return new(
            TextosDaProcedencia.Painel(casa, legislatura),
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
        {
            lista = [.. (await recorte.Linhas.Take(LimiteDaLista).ToListAsync(ct))
                .Select(l => l with { Descricao = TextoSemCpf.Limpar(l.Descricao) })];
        }

        return new ProcedenciaDto(
            recorte.Regra,
            total,
            porCarga.Where(c => c.Id is null).Sum(c => c.Linhas),
            [.. detalhes
                .Select(c => new CargaDto(
                    c.Id, c.Fonte, TextosDaProcedencia.Orgao(c.Fonte), TextosDaProcedencia.BaseLegal(c.Fonte, c.Url), c.Url,
                    c.BaixadoEm, c.Sha256, c.Bytes, c.EtagDaFonte, c.ModificadoNaFonte, c.Comando, c.Versao, linhas[c.Id]))
                .OrderByDescending(c => c.Linhas)
                .ThenByDescending(c => c.BaixadoEm)],
            lista);
    }

    /// <summary>Um número: a regra, as cargas das linhas que entraram e, quando dá para listar, as linhas.</summary>
    private sealed record Recorte(string Regra, IQueryable<long?> Cargas, IQueryable<LinhaDaProcedenciaDto>? Linhas);
}
