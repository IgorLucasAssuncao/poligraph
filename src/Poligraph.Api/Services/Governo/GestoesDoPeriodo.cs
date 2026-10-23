using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>As gestões presidenciais que cobrem um período, para os atalhos do seletor de período.</summary>
/// <remarks>
/// <para>Orçamento, cartões, compras e viagens oferecem as mesmas gestões: comparar gestões medidas do mesmo jeito é o que mostra que a página não é sobre uma delas.</para>
/// <para>DECISÃO (autor, 2026-10-22): a gestão é a chapa eleita, e sai dos <c>mandatos</c> do TSE (presidente e vice da mesma eleição). A tabela <c>gestoes</c> repetia o mesmo dado e deixou de ser lida; sai num deploy seguinte.</para>
/// </remarks>
public static class GestoesDoPeriodo
{
    /// <summary>As gestões que cobrem o período, mais de uma quando ele atravessa uma posse.</summary>
    public static async Task<IReadOnlyList<GestaoDto>> ListarAsync(PoligraphDb db, int primeiroAno, int ultimoAno, CancellationToken ct) =>
        [.. (await ChapasAsync(db, primeiroAno, ultimoAno, ct)).Select(c => c.Gestao)];

    /// <summary>As chapas eleitas do período, com a carga de onde veio o presidente, para a procedência.</summary>
    public static async Task<IReadOnlyList<(GestaoDto Gestao, long? CargaId)>> ChapasAsync(
        PoligraphDb db, int primeiroAno, int ultimoAno, CancellationToken ct)
    {
        var eleitos = await (
                from m in db.Mandatos.AsNoTracking()
                join p in db.Pessoas.AsNoTracking() on m.PessoaId equals p.Id
                where (m.Cargo == TipoCargo.PRESIDENTE || m.Cargo == TipoCargo.VICE_PRESIDENTE)
                      && m.PrimeiroAno <= ultimoAno && m.UltimoAno >= primeiroAno
                select new { m.Cargo, m.AnoEleicao, m.PrimeiroAno, m.UltimoAno, m.Partido, m.NomeDeUrna, m.Coligacao, m.CargaId, p.NomeCivil })
            .ToListAsync(ct);

        return [.. eleitos
            .Where(e => e.Cargo == TipoCargo.PRESIDENTE)
            .OrderBy(e => e.PrimeiroAno)
            .SelectMany(presidente =>
            {
                var vice = eleitos.FirstOrDefault(e => e.Cargo == TipoCargo.VICE_PRESIDENTE && e.AnoEleicao == presidente.AnoEleicao);
                var titular = new PessoaDaGestaoDto(presidente.NomeCivil, presidente.NomeDeUrna, presidente.Partido);
                var doVice = vice is null ? null : new PessoaDaGestaoDto(vice.NomeCivil, vice.NomeDeUrna, vice.Partido);
                var chapa = new GestaoDto(
                    presidente.AnoEleicao, presidente.PrimeiroAno, presidente.UltimoAno, titular, doVice, presidente.Coligacao);
                return Dividida(chapa, SucessoesNaPresidencia.DaEleicao(presidente.AnoEleicao))
                    .Select(g => (g, presidente.CargaId));
            })
            .Where(c => c.g.PrimeiroAno <= ultimoAno && c.g.UltimoAno >= primeiroAno)];
    }

    /// <summary>A chapa inteira, ou as duas gestões dela quando o vice assumiu no meio do mandato (<see cref="SucessoesNaPresidencia"/>).</summary>
    /// <remarks>O titular vai até o afastamento; o vice assume nesse dia, sem vice, até o fim do mandato. As duas levam a troca.</remarks>
    public static IReadOnlyList<GestaoDto> Dividida(GestaoDto chapa, SucessoesNaPresidencia.Sucessao? sucessao)
    {
        if (sucessao is null || chapa.Vice is null)
        {
            return [chapa];
        }

        var troca = new SucessaoDto(sucessao.Motivo, sucessao.Afastamento, sucessao.Posse, sucessao.UrlDaFonte);
        return
        [
            chapa with { UltimoAno = sucessao.Afastamento.Year, Ate = sucessao.Afastamento, Sucessao = troca },
            chapa with
            {
                PrimeiroAno = sucessao.Afastamento.Year, Presidente = chapa.Vice, Vice = null, Desde = sucessao.Afastamento, Sucessao = troca,
            },
        ];
    }
}
