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
            case TipoDeContexto.GovernoViagens:
            case TipoDeContexto.GovernoCompras:
            case TipoDeContexto.GovernoDefesaCivil:
            case TipoDeContexto.GovernoComprasCentralizadas:
                return consulta.PeriodoDoOrcamento.Completo ? DoGoverno(consulta.Contexto.Tipo, consulta.PeriodoDoOrcamento) : null;
            case TipoDeContexto.Entidade:
                return consulta.Cnpj is { } cnpj ? DaEntidade(cnpj) : null;
            case TipoDeContexto.Sancoes:
                return consulta.Cnpj is { } sancionada ? Sancoes(sancionada) : null;
            case TipoDeContexto.Convenios when consulta.Cnpj is { } convenente:
                return ConveniosDaEntidade(convenente);
            case TipoDeContexto.Parlamentar:
                return consulta.IdPessoa is { } doCadastro ? DoParlamentar(doCadastro) : null;
            case TipoDeContexto.Populacao:
                return Populacao(consulta.Uf);
            case TipoDeContexto.Gestoes:
                return consulta.PeriodoDoOrcamento.Completo ? Gestoes(consulta.PeriodoDoOrcamento) : null;
            case TipoDeContexto.Pagamentos:
                return consulta.PeriodoDasEmendas.Completo ? Pagamentos(consulta.PeriodoDasEmendas, consulta.Uf, consulta.Municipio) : null;
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

        if (consulta.IdPessoa is not { } idPessoa)
        {
            return null;
        }

        return consulta.Contexto.Tipo switch
        {
            TipoDeContexto.Votos => Votos(idPessoa, legislatura.Value),
            TipoDeContexto.Cota => Cota(idPessoa, legislatura.Value, consulta.AnoDaDespesa, consulta.Categoria),
            TipoDeContexto.Emendas => Emendas(idPessoa, legislatura.Value, consulta.AnoDaEmenda),
            TipoDeContexto.Campanha => Campanha(idPessoa, legislatura.Value, consulta.AnoDaEleicao),
            TipoDeContexto.Ementas => Ementas(idPessoa, legislatura.Value),
            TipoDeContexto.Convenios => ConveniosDoParlamentar(idPessoa, legislatura.Value, consulta.AnoDaEmenda),
            _ => Patrimonio(idPessoa, legislatura.Value, consulta.AnoDaEleicao),
        };
    }

    private async Task<Legislatura?> LegislaturaCorrenteAsync(CancellationToken ct) =>
        await Legislaturas.CorrenteAsync(_db, ct) is { } numero ? new Legislatura(numero) : null;

    private Recorte Votos(IdPessoa idPessoa, Legislatura legislatura)
    {
        var votos = _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == idPessoa.Valor && (v.Valor == 1 || v.Valor == -1) && v.Votacao!.Legislatura == legislatura.Numero);
        return new(
            TextosDaProcedencia.Votos(legislatura),
            votos.Select(v => v.CargaId),
            votos.OrderByDescending(v => v.Votacao!.Data)
                .Select(v => new LinhaDaProcedenciaDto(
                    v.Votacao!.Descricao ?? v.VotacaoId,
                    v.Valor == 1 ? TextosDaProcedencia.Sim : TextosDaProcedencia.Nao,
                    v.Votacao.Data, null, null)));
    }

    private Recorte Cota(IdPessoa idPessoa, Legislatura legislatura, AnoDaDespesa? anoDaDespesa, CategoriaDeDespesa? categoria)
    {
        var (primeiroAnoDaDespesa, ultimoAnoDaDespesa) = anoDaDespesa is { } unico ? (unico.Valor, unico.Valor) : Legislaturas.AnosDeDespesa(legislatura.Numero);
        var despesas = _db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == idPessoa.Valor && d.Ano >= primeiroAnoDaDespesa && d.Ano <= ultimoAnoDaDespesa);
        if (categoria is { } escolhida)
        {
            despesas = despesas.Where(d => d.Categoria == escolhida.Nome);
        }

        return new(
            TextosDaProcedencia.Cota(primeiroAnoDaDespesa, ultimoAnoDaDespesa, categoria),
            despesas.Select(d => d.CargaId),
            despesas.OrderByDescending(d => d.ValorLiquido)
                .Select(d => new LinhaDaProcedenciaDto(
                    d.Fornecedor ?? TextosDaProcedencia.FornecedorNaoInformado, d.Categoria, d.DataEmissao, d.ValorLiquido, d.UrlDocumento)));
    }

    private Recorte Emendas(IdPessoa idPessoa, Legislatura legislatura, AnoDaEmenda? anoDaEmenda)
    {
        var (primeiroAnoDaEmenda, ultimoAnoDaEmenda) = anoDaEmenda is { } unico ? (unico.Valor, unico.Valor) : Legislaturas.AnosDeEmenda(legislatura.Numero);
        var emendas = _db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == idPessoa.Valor && e.Ano >= primeiroAnoDaEmenda && e.Ano <= ultimoAnoDaEmenda);
        return new(
            TextosDaProcedencia.Emendas(primeiroAnoDaEmenda, ultimoAnoDaEmenda),
            emendas.Select(e => e.CargaId),
            emendas.OrderByDescending(e => e.ValorEmpenhado)
                .Select(e => new LinhaDaProcedenciaDto(
                    TextosDaProcedencia.Emenda(e.CodigoEmenda), e.Localidade ?? e.Funcao, null, e.ValorEmpenhado, null)));
    }

    private Recorte Campanha(IdPessoa idPessoa, Legislatura legislatura, AnoDaEleicao? anoDaEleicaoPedido)
    {
        var anoDaEleicao = (short)(anoDaEleicaoPedido?.Valor ?? Legislaturas.EleicaoDoMandato(legislatura.Numero));
        var receitas = _db.ReceitasDeCampanha.AsNoTracking().Where(r => r.PessoaId == idPessoa.Valor && r.AnoEleicao == anoDaEleicao);
        return new(
            TextosDaProcedencia.Campanha(anoDaEleicao),
            receitas.Select(r => r.CargaId),
            receitas.OrderByDescending(r => r.Valor)
                .Select(r => new LinhaDaProcedenciaDto(r.Doador ?? TextosDaProcedencia.DoadorNaoInformado, r.FonteReceita, null, r.Valor, null)));
    }

    private Recorte Patrimonio(IdPessoa idPessoa, Legislatura legislatura, AnoDaEleicao? anoDaEleicaoPedido)
    {
        var anoDaEleicao = (short)(anoDaEleicaoPedido?.Valor ?? Legislaturas.EleicaoDoMandato(legislatura.Numero));
        var bens = _db.Patrimonios.AsNoTracking().Where(p => p.PessoaId == idPessoa.Valor && p.AnoEleicao == anoDaEleicao);
        return new(
            TextosDaProcedencia.Patrimonio(anoDaEleicao),
            bens.Select(p => p.CargaId),
            bens.OrderByDescending(p => p.Valor)
                .Select(p => new LinhaDaProcedenciaDto(p.TipoBem, null, null, p.Valor, null)));
    }

    /// <remarks>
    /// <para>O mesmo filtro do mapa (<c>ServicoMapaDeEmendas.DoPeriodo</c> e <c>NoMapa</c>): o ano da emenda são os quatro primeiros dígitos do código; com estado ou cidade, só pessoa jurídica fora do intermediário, com a sede ligada por CNPJ.</para>
    /// </remarks>
    private Recorte Pagamentos(Periodo<AnoDaEmenda> periodoDasEmendas, Uf? uf, CodigoIbge? municipio)
    {
        var prefixosDoCodigoDaEmenda = periodoDasEmendas.Anos.Select(a => a.ToString(CultureInfo.InvariantCulture)).ToArray();
        var pagamentos = _db.EmendasFavorecidos.AsNoTracking().Where(f => prefixosDoCodigoDaEmenda.Contains(f.CodigoEmenda.Substring(0, 4)));
        if (municipio is { } municipioDaSede)
        {
            pagamentos = pagamentos.Where(f => f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
                && _db.CnpjsMunicipio.Any(c => c.Cnpj == f.Documento && c.CodigoIbge == municipioDaSede.Digitos));
        }
        else if (uf is { } ufDaSede)
        {
            pagamentos = pagamentos.Where(f => f.Tipo == TipoFavorecido.PESSOA_JURIDICA && !f.Intermediario
                && _db.CnpjsMunicipio.Any(c => c.Cnpj == f.Documento && c.Municipio!.Uf == ufDaSede.Sigla));
        }

        return new(
            TextosDaProcedencia.Pagamentos(periodoDasEmendas, uf, municipio),
            pagamentos.Select(f => f.CargaId),
            pagamentos.OrderByDescending(f => f.Valor)
                .Select(f => new LinhaDaProcedenciaDto(
                    f.Nome ?? TextosDaProcedencia.FavorecidoNaoInformado, TextosDaProcedencia.Emenda(f.CodigoEmenda), f.Competencia, f.Valor, null)));
    }

    /// <summary>Os números da página do Governo (Pendência 84), no mesmo período da página.</summary>
    /// <remarks>
    /// <para>O gasto soma a execução por função e os Encargos especiais do arquivo anual do orçamento. Os restos a pagar pagos vêm dos arquivos mensais de execução, que não entram como carga das linhas: a regra diz isso.</para>
    /// <para>O gasto sigiloso soma por ano os arquivos mensais do cartão e da execução; cada linha aponta para o índice desses arquivos, que lista o hash de cada um.</para>
    /// <para>Viagens, compras, Defesa Civil e compras centralizadas usam o mesmo período da página, pelo ano do arquivo de cada uma.</para>
    /// </remarks>
    private Recorte DoGoverno(TipoDeContexto contexto, Periodo<AnoDoOrcamento> periodoDoOrcamento)
    {
        var (primeiroAnoDoOrcamento, ultimoAnoDoOrcamento) = (periodoDoOrcamento.Primeiro.GetValueOrDefault().Valor, periodoDoOrcamento.Ultimo.GetValueOrDefault().Valor);
        return contexto switch
        {
            TipoDeContexto.GovernoReceitas => new(
                TextosDaProcedencia.GovernoReceitas(periodoDoOrcamento),
                _db.ReceitasPorOrigem.AsNoTracking().Where(r => r.Ano >= primeiroAnoDoOrcamento && r.Ano <= ultimoAnoDoOrcamento).Select(r => r.CargaId), null),
            TipoDeContexto.GovernoSigiloso => new(
                TextosDaProcedencia.GovernoSigiloso(periodoDoOrcamento),
                _db.GastosSigilosos.AsNoTracking().Where(g => g.Ano >= primeiroAnoDoOrcamento && g.Ano <= ultimoAnoDoOrcamento).Select(g => g.CargaId), null),
            TipoDeContexto.GovernoViagens => new(
                TextosDaProcedencia.GovernoViagens(periodoDoOrcamento),
                _db.ViagensDoOrgao.AsNoTracking().Where(v => v.Ano >= primeiroAnoDoOrcamento && v.Ano <= ultimoAnoDoOrcamento).Select(v => v.CargaId), null),
            TipoDeContexto.GovernoCompras => new(
                TextosDaProcedencia.GovernoCompras(periodoDoOrcamento),
                _db.ContratacoesDoOrgao.AsNoTracking().Where(c => c.Ano >= primeiroAnoDoOrcamento && c.Ano <= ultimoAnoDoOrcamento).Select(c => c.CargaId), null),
            TipoDeContexto.GovernoDefesaCivil => new(
                TextosDaProcedencia.GovernoDefesaCivil(periodoDoOrcamento),
                _db.GastosDaDefesaCivil.AsNoTracking().Where(d => d.Ano >= primeiroAnoDoOrcamento && d.Ano <= ultimoAnoDoOrcamento).Select(d => d.CargaId), null),
            TipoDeContexto.GovernoComprasCentralizadas => new(
                TextosDaProcedencia.GovernoComprasCentralizadas(periodoDoOrcamento),
                _db.ComprasCentralizadasNoCartao.AsNoTracking().Where(c => c.Ano >= primeiroAnoDoOrcamento && c.Ano <= ultimoAnoDoOrcamento).Select(c => c.CargaId), null),
            _ => new(
                TextosDaProcedencia.GovernoGastos(periodoDoOrcamento),
                _db.OrcamentoPorFuncao.AsNoTracking().Where(o => o.Ano >= primeiroAnoDoOrcamento && o.Ano <= ultimoAnoDoOrcamento).Select(o => o.CargaId)
                    .Concat(_db.EncargosEspeciais.AsNoTracking().Where(e => e.Ano >= primeiroAnoDoOrcamento && e.Ano <= ultimoAnoDoOrcamento).Select(e => e.CargaId)), null),
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

    private Recorte Sancoes(Cnpj cnpj)
    {
        var sancoes = _db.SancoesDeEmpresas.AsNoTracking().Where(s => s.Cnpj == cnpj.Digitos);
        return new(
            TextosDaProcedencia.Sancoes,
            sancoes.Select(s => s.CargaId),
            sancoes.OrderByDescending(s => s.Inicio)
                .Select(s => new LinhaDaProcedenciaDto(s.Categoria, s.OrgaoSancionador, s.Inicio, s.ValorDaMulta, null)));
    }

    private Recorte ConveniosDaEntidade(Cnpj cnpj)
    {
        var convenios = _db.Convenios.AsNoTracking().Where(c => c.CnpjConvenente == cnpj.Digitos);
        return new(
            TextosDaProcedencia.ConveniosDaEntidade,
            convenios.Select(c => c.CargaId),
            convenios.OrderByDescending(c => c.DataPublicacao)
                .Select(c => new LinhaDaProcedenciaDto(c.Numero, c.Objeto, c.DataPublicacao, c.Valor, null)));
    }

    /// <remarks>
    /// <para>Os convênios das emendas do parlamentar no recorte, pela ligação emenda e convênio que o Portal publica.</para>
    /// </remarks>
    private Recorte ConveniosDoParlamentar(IdPessoa idPessoa, Legislatura legislatura, AnoDaEmenda? anoDaEmenda)
    {
        var (primeiroAnoDaEmenda, ultimoAnoDaEmenda) = anoDaEmenda is { } unico ? (unico.Valor, unico.Valor) : Legislaturas.AnosDeEmenda(legislatura.Numero);
        var codigos = _db.Emendas.AsNoTracking()
            .Where(e => e.PessoaId == idPessoa.Valor && e.Ano >= primeiroAnoDaEmenda && e.Ano <= ultimoAnoDaEmenda)
            .Select(e => e.CodigoEmenda);
        var convenios = _db.Convenios.AsNoTracking()
            .Where(c => _db.EmendasConvenios.Any(ec => ec.NumeroConvenio == c.Numero && codigos.Contains(ec.CodigoEmenda)));
        return new(
            TextosDaProcedencia.ConveniosDoParlamentar(primeiroAnoDaEmenda, ultimoAnoDaEmenda),
            convenios.Select(c => c.CargaId),
            convenios.OrderByDescending(c => c.Valor)
                .Select(c => new LinhaDaProcedenciaDto(c.Convenente, c.Objeto, c.DataPublicacao, c.Valor, null)));
    }

    /// <remarks>
    /// <para>A linha do parlamentar e as redes dele: cada uma aponta para o arquivo que a gravou.</para>
    /// </remarks>
    private Recorte DoParlamentar(IdPessoa idPessoa)
    {
        var redes = _db.RedesSociais.AsNoTracking().Where(r => r.PessoaId == idPessoa.Valor);
        return new(
            TextosDaProcedencia.Parlamentar,
            _db.Pessoas.AsNoTracking().Where(p => p.Id == idPessoa.Valor).Select(p => p.CargaId).Concat(redes.Select(r => r.CargaId)),
            redes.OrderBy(r => r.Url).Select(r => new LinhaDaProcedenciaDto(r.Url, r.Fonte.ToString(), null, null, r.Url)));
    }

    /// <remarks>
    /// <para>As proposições ligadas às votações em que a pessoa votou na legislatura, uma vez cada.</para>
    /// </remarks>
    private Recorte Ementas(IdPessoa idPessoa, Legislatura legislatura)
    {
        var votacoes = _db.Votos.AsNoTracking()
            .Where(v => v.PessoaId == idPessoa.Valor && v.Votacao!.Legislatura == legislatura.Numero && v.Votacao.ProposicaoId != null)
            .Select(v => new { v.Votacao!.Casa, v.Votacao.ProposicaoId });
        var proposicoes = _db.Proposicoes.AsNoTracking()
            .Where(p => votacoes.Any(v => v.Casa == p.Casa && v.ProposicaoId == p.Id));
        return new(
            TextosDaProcedencia.Ementas(legislatura),
            proposicoes.Select(p => p.CargaId),
            proposicoes.OrderByDescending(p => p.Ano)
                .Select(p => new LinhaDaProcedenciaDto((p.SiglaTipo ?? "") + " " + p.Numero + "/" + p.Ano, p.Ementa, null, null, null)));
    }

    private Recorte Populacao(Uf? uf)
    {
        var municipios = _db.Municipios.AsNoTracking().Where(m => m.Populacao != null);
        if (uf is { } escolhida)
        {
            municipios = municipios.Where(m => m.Uf == escolhida.Sigla);
        }

        return new(
            TextosDaProcedencia.Populacao(uf),
            municipios.Select(m => m.PopulacaoCargaId),
            municipios.OrderByDescending(m => m.Populacao)
                .Select(m => new LinhaDaProcedenciaDto(m.Nome, m.Uf + " · " + m.Populacao + " habitantes", null, null, null)));
    }

    private Recorte Gestoes(Periodo<AnoDoOrcamento> periodo)
    {
        var (primeiro, ultimo) = (periodo.Primeiro.GetValueOrDefault().Valor, periodo.Ultimo.GetValueOrDefault().Valor);
        var gestoes = _db.Gestoes.AsNoTracking().Where(g => g.PrimeiroAno <= ultimo && g.UltimoAno >= primeiro);
        return new(
            TextosDaProcedencia.Gestoes(periodo),
            gestoes.Select(g => g.CargaId),
            gestoes.OrderBy(g => g.PrimeiroAno)
                .Select(g => new LinhaDaProcedenciaDto(g.PresidenteNome, g.ViceNome, null, null, null)));
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
            .GroupBy(idCarga => idCarga)
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
