using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;
using Poligraph.Api.Tipos;
using Poligraph.Api.Constantes;

namespace Poligraph.Api.Services;

/// <summary>
/// O perfil do governo federal no período: quem governa, de onde veio o dinheiro e para onde foi.
/// </summary>
/// <remarks>
/// <para>
/// Os dados de orçamento cobrem o Poder Executivo federal: Legislativo, Judiciário e
/// Ministério Público aparecem só em linhas residuais. Nada aqui liga a parlamentar, e
/// nada qualifica o governo: não há nota, meta nem saldo calculado.
/// </para>
/// <para>
/// O período soma os anos. Somar é legítimo para o que se paga e se arrecada — é dinheiro
/// que saiu e entrou em cada ano —, e é por isso que o saldo continua fora: ele pediria as
/// regras de resultado fiscal, que estes dados não seguem.
/// </para>
/// </remarks>
public class ServicoGoverno(PoligraphDb db, CacheDeLeitura leitura)
{
    /// <summary>
    /// Quanto do empenho pode passar da dotação publicada sem que ela deixe de valer.
    /// </summary>
    /// <remarks>
    /// <para>Medido em 2026-09-25 sobre o arquivo de cada ano. Em 2025 passam dela 23 das 28 funções: a parcela condicionada à regra de ouro ficou fora da dotação publicada. Nos outros anos passam Legislativa e Judiciária, linhas residuais de poderes que o arquivo não cobre, Comércio e Serviços em 2023 (2,0%), e Defesa (1,1%) e Relações Exteriores (5,3%) em 2024.</para>
    /// </remarks>
    public const decimal ToleranciaAcimaDaDotacao = 0.005m;

    private const string EncargosEspeciais = "28";
    private const string ReservaDeContingencia = "99";
    private const string ReceitasCorrentes = VocabularioDasFontes.ReceitasCorrentes;
    private const string ReceitasDeCapital = VocabularioDasFontes.ReceitasDeCapital;
    private const string OperacoesDeCredito = VocabularioDasFontes.OperacoesDeCredito;

    private readonly PoligraphDb _db = db;
    private readonly CacheDeLeitura _leitura = leitura;

    /// <remarks>
    /// <para>Sem período, todos os anos carregados. Ponta fora dos anos é trazida para dentro; ponta invertida, desinvertida.</para>
    /// <para>Sem dado, devolve <c>null</c>, e o endpoint responde 404.</para>
    /// </remarks>
    public Task<GovernoDto?> ObterAsync(Periodo<AnoDoOrcamento> periodoPedido, CancellationToken ct) =>
        _leitura.ObterAsync(("governo", periodoPedido), () => CalcularAsync(periodoPedido, ct));

    private async Task<GovernoDto?> CalcularAsync(Periodo<AnoDoOrcamento> periodoPedido, CancellationToken ct)
    {
        var anosDoOrcamentoCarregados = await _db.OrcamentoPorFuncao.AsNoTracking()
            .GroupBy(o => o.Ano)
            .Select(g => new { Ano = (int)g.Key, GeradoEm = g.Max(o => o.GeradoEm) })
            .OrderBy(a => a.Ano)
            .ToListAsync(ct);

        if (anosDoOrcamentoCarregados.Count == 0)
        {
            return null;
        }

        var primeiroAnoDoOrcamento = Math.Clamp(periodoPedido.Primeiro?.Valor ?? anosDoOrcamentoCarregados[0].Ano, anosDoOrcamentoCarregados[0].Ano, anosDoOrcamentoCarregados[^1].Ano);
        var ultimoAnoDoOrcamento = Math.Clamp(periodoPedido.Ultimo?.Valor ?? anosDoOrcamentoCarregados[^1].Ano, anosDoOrcamentoCarregados[0].Ano, anosDoOrcamentoCarregados[^1].Ano);
        if (primeiroAnoDoOrcamento > ultimoAnoDoOrcamento)
        {
            (primeiroAnoDoOrcamento, ultimoAnoDoOrcamento) = (ultimoAnoDoOrcamento, primeiroAnoDoOrcamento);
        }

        var anosMostrados = anosDoOrcamentoCarregados.Where(a => a.Ano >= primeiroAnoDoOrcamento && a.Ano <= ultimoAnoDoOrcamento).ToList();
        var anosMostradosParaConsulta = anosMostrados.Select(a => (short)a.Ano).ToList();

        var funcoes = await _db.OrcamentoPorFuncao.AsNoTracking().Where(o => anosMostradosParaConsulta.Contains(o.Ano)).ToListAsync(ct);
        var encargos = await _db.EncargosEspeciais.AsNoTracking().Where(e => anosMostradosParaConsulta.Contains(e.Ano)).ToListAsync(ct);
        var receitas = await _db.ReceitasPorOrigem.AsNoTracking().Where(r => anosMostradosParaConsulta.Contains(r.Ano)).ToListAsync(ct);
        var sigilosos = await _db.GastosSigilosos.AsNoTracking().Where(g => anosMostradosParaConsulta.Contains(g.Ano)).ToListAsync(ct);

        var emAndamento = anosMostrados.LastOrDefault(a => !AnoFechado(a.Ano, a.GeradoEm))?.Ano;

        return new GovernoDto(
            Gestoes: await GestoesAsync(primeiroAnoDoOrcamento, ultimoAnoDoOrcamento, ct),
            Periodo: new PeriodoDto(primeiroAnoDoOrcamento, ultimoAnoDoOrcamento),
            GeradoEm: anosMostrados.Max(a => a.GeradoEm),
            EmAndamento: emAndamento,
            AnosDisponiveis: [.. anosDoOrcamentoCarregados.Select(a => a.Ano)],
            Arrecadacao: Arrecadacao(receitas),
            Despesa: Despesa(funcoes, encargos),
            Sigilo: Sigilo(sigilosos),
            PorAno: [.. anosMostrados.Select(a =>
            {
                var anoDoOrcamento = (short)a.Ano;
                var doAno = Arrecadacao([.. receitas.Where(r => r.Ano == anoDoOrcamento)]);
                return new GovernoNoAnoDto(
                    a.Ano,
                    doAno.Arrecadado,
                    Gasto(Despesa([.. funcoes.Where(f => f.Ano == anoDoOrcamento)], [.. encargos.Where(e => e.Ano == anoDoOrcamento)])),
                    doAno.EmissaoDeDivida,
                    AnoFechado(a.Ano, a.GeradoEm));
            })],
            GestoesDisponiveis: await GestoesAsync(anosDoOrcamentoCarregados[0].Ano, anosDoOrcamentoCarregados[^1].Ano, ct));
    }

    /// <summary>O que se gastou de fato: as áreas, os repasses e a dívida paga — não a rolagem.</summary>
    private static decimal Gasto(DespesaDto despesa) =>
        despesa.Areas.Sum(a => a.Pago + a.RestosAPagarPagos)
        + despesa.Encargos.Where(e => e.Grupo != TipoGrupoDeEncargo.REFINANCIAMENTO).Sum(e => e.Pago + e.RestosAPagarPagos);

    /// <summary>O gasto sigiloso do período, por órgão e no total. Nulo se a carga ainda não trouxe nada dele.</summary>
    /// <remarks>
    /// <para>Só entra na lista o órgão com algum gasto sigiloso: o cartão de um ministério sem sigilo nenhum não responde à pergunta da seção.</para>
    /// <para><c>Meses</c> é o do ano mais recente do período: é ele que pode estar incompleto.</para>
    /// </remarks>
    private static SigiloDto? Sigilo(IReadOnlyList<GastoSigilosoModel> linhas)
    {
        if (linhas.Count == 0)
        {
            return null;
        }

        var cartao = linhas.Where(l => l.Origem == OrigemDoSigilo.CARTAO_CORPORATIVO).ToList();
        var acao = linhas.Where(l => l.Origem == OrigemDoSigilo.ACAO_SIGILOSA).ToList();
        var ultimoAno = linhas.Max(l => l.Ano);

        var porOrgao = linhas
            .GroupBy(l => l.OrgaoSuperior)
            .Select(g => new SigiloDoOrgaoDto(
                g.Key,
                g.Where(l => l.Origem == OrigemDoSigilo.CARTAO_CORPORATIVO).Sum(l => l.Sigiloso),
                g.Where(l => l.Origem == OrigemDoSigilo.CARTAO_CORPORATIVO).Sum(l => l.Total),
                g.Where(l => l.Origem == OrigemDoSigilo.ACAO_SIGILOSA).Sum(l => l.Sigiloso)))
            .Where(o => o.Cartao > 0 || o.Acao > 0)
            .OrderByDescending(o => o.Cartao + o.Acao)
            .ToList();

        return new SigiloDto(
            CartaoSigiloso: cartao.Sum(l => l.Sigiloso),
            CartaoTotal: cartao.Sum(l => l.Total),
            TransacoesSigilosas: cartao.Sum(l => l.Lancamentos ?? 0),
            AcaoSigilosa: acao.Sum(l => l.Sigiloso),
            Meses: linhas.Where(l => l.Ano == ultimoAno).Min(l => l.Meses),
            PorOrgao: porOrgao);
    }

    /// <summary>O ano está fechado quando o arquivo foi gerado depois de 31 de dezembro dele.</summary>
    private static bool AnoFechado(int anoDoOrcamento, DateOnly geradoEm) => geradoEm.Year > anoDoOrcamento;

    /// <summary>As gestões que cobrem o período — mais de uma quando ele atravessa uma posse.</summary>
    private async Task<IReadOnlyList<GestaoDto>> GestoesAsync(int primeiroAnoDoOrcamento, int ultimoAnoDoOrcamento, CancellationToken ct)
    {
        var gestoes = await _db.Gestoes.AsNoTracking()
            .Where(g => g.PrimeiroAno <= ultimoAnoDoOrcamento && g.UltimoAno >= primeiroAnoDoOrcamento)
            .OrderBy(g => g.PrimeiroAno)
            .ToListAsync(ct);

        return [.. gestoes.Select(g => new GestaoDto(
            g.Eleicao, g.PrimeiroAno, g.UltimoAno,
            new PessoaDaGestaoDto(g.PresidenteNome, g.PresidenteNomeDeUrna, g.PresidentePartido),
            new PessoaDaGestaoDto(g.ViceNome, g.ViceNomeDeUrna, g.VicePartido),
            g.Coligacao))];
    }

    /// <remarks>
    /// <para>Arrecadado são as receitas correntes. A operação de crédito vai à parte: é dívida emitida, e em 2025 quase iguala tudo o que se arrecadou.</para>
    /// </remarks>
    private static ArrecadacaoDto Arrecadacao(IReadOnlyList<ReceitaPorOrigemModel> receitas)
    {
        var correntes = receitas.Where(r => r.Categoria == ReceitasCorrentes).ToList();
        var capital = receitas.Where(r => r.Categoria == ReceitasDeCapital).ToList();

        return new ArrecadacaoDto(
            Arrecadado: correntes.Sum(r => r.Realizada),
            PorOrigem: [.. correntes
                .GroupBy(r => r.Origem)
                .Select(g => new OrigemDaReceitaDto(g.Key, g.Sum(r => r.Prevista), g.Sum(r => r.Realizada)))
                .Where(o => o.Realizada != 0 || o.Prevista != 0)
                .OrderByDescending(o => o.Realizada)],
            EmissaoDeDivida: capital.Where(r => r.Origem == OperacoesDeCredito).Sum(r => r.Realizada),
            OutrasReceitasDeCapital: capital.Where(r => r.Origem != OperacoesDeCredito).Sum(r => r.Realizada));
    }

    /// <remarks>
    /// <para>As áreas saem em ordem do que foi pago, somado o de anos anteriores: é a ordem em que se lê uma distribuição. Encargos especiais e a reserva de contingência ficam fora delas: a primeira vai em grupos, a segunda não se paga.</para>
    /// <para>No período, a área soma os anos; a dotação é completa só se foi completa em todos eles.</para>
    /// </remarks>
    private static DespesaDto Despesa(IReadOnlyList<OrcamentoPorFuncaoModel> funcoes, IReadOnlyList<EncargoEspecialModel> encargos)
    {
        var areas = funcoes
            .Where(f => f.CodigoFuncao is not EncargosEspeciais and not ReservaDeContingencia)
            .GroupBy(f => new { f.CodigoFuncao, f.Funcao })
            .Select(g => new AreaDaDespesaDto(
                g.Key.CodigoFuncao, g.Key.Funcao,
                g.Sum(f => f.DotacaoAtualizada), g.Sum(f => f.Empenhado), g.Sum(f => f.Pago), g.Sum(f => f.RestosAPagarPagos),
                DotacaoCompleta: g.All(f => f.EmpenhadoAcimaDaDotacao <= f.DotacaoAtualizada * ToleranciaAcimaDaDotacao)))
            .OrderByDescending(a => a.Pago + a.RestosAPagarPagos);

        var grupos = encargos
            .GroupBy(e => GrupoDaSubfuncao(e.CodigoSubfuncao))
            .ToDictionary(g => g.Key, g => (Pago: g.Sum(e => e.Pago), Restos: g.Sum(e => e.RestosAPagarPagos)));

        return new DespesaDto(
            EmpenhadoAcimaDaDotacao: funcoes.Sum(f => f.EmpenhadoAcimaDaDotacao),
            Areas: [.. areas],
            Encargos: [.. Enum.GetValues<TipoGrupoDeEncargo>().Select(grupo =>
            {
                var (pago, restos) = grupos.GetValueOrDefault(grupo);
                return new EncargoDto(grupo, pago, restos);
            })]);
    }

    /// <summary>
    /// A classificação oficial das subfunções de Encargos especiais, reunida em quatro grupos.
    /// </summary>
    /// <remarks>
    /// <para>841 e 842: refinanciamento da dívida interna e externa. 843 e 844: serviço da dívida interna e externa. 845: outras transferências, onde estão FPM e FPE. 847: transferências para a educação básica. 846 e o que mais houver: outros encargos.</para>
    /// </remarks>
    private static TipoGrupoDeEncargo GrupoDaSubfuncao(string codigo) => codigo switch
    {
        "841" or "842" => TipoGrupoDeEncargo.REFINANCIAMENTO,
        "843" or "844" => TipoGrupoDeEncargo.SERVICO_DA_DIVIDA,
        "845" or "847" => TipoGrupoDeEncargo.TRANSFERENCIAS,
        _ => TipoGrupoDeEncargo.OUTROS,
    };
}
