using Poligraph.Api.Configuracao;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Data;
using Poligraph.Api.Textos;

namespace Poligraph.Api.Endpoints;

/// <summary>
/// Estes endpoints escrevem na tabela `segue`, que é REGISTRO DE CONVICÇÃO POLÍTICA
/// — dado sensível pela LGPD art. 5º, II.
///
/// Toda alteração aqui merece atenção extra: consentimento específico (RNF-12b) e o
/// endpoint de exclusão (art. 18) dependem do que esta tabela guarda.
/// </summary>
public static class EndpointsSeguir
{
    public static IEndpointRouteBuilder MapearSeguir(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/seguidos")
            .WithTags("Seguir")
            .RequireAuthorization()
            .ExigirCabecalhoDoSite();

        grupo.MapGet("/", ListarAsync)
             .Produces<IReadOnlyList<ParlamentarSeguidoDto>>();
        grupo.MapGet("/novidades", NovidadesAsync)
             .Produces<NovidadesDto>();
        grupo.MapPut("/{idPessoa:long}", SeguirAsync);
        grupo.MapDelete("/{idPessoa:long}", DeixarDeSeguirAsync);
        grupo.MapDelete("/consentimento", RevogarConsentimentoAsync);
        grupo.MapGet("/encerrados", EncerradosAsync)
             .Produces<SeguidosEncerradosDto>();
        grupo.MapDelete("/encerrados", DispensarEncerradosAsync);

        return app;
    }

    private static async Task<IResult> ListarAsync(
        ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);

        var seguidos = await db.Segue.AsNoTracking()
            .Where(s => s.UsuarioId == idUsuario)
            .Select(s => new
            {
                s.PessoaId,
                s.Pessoa!.NomeExibicao,
                s.Pessoa.UrlFoto,
                Ultimo = s.Pessoa.Votos
                    .OrderByDescending(v => v.Votacao!.Data)
                    .Select(v => new { v.Votacao!.Casa, v.PartidoNoVoto, v.UfNoVoto })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        return Results.Ok(seguidos.Select(s => new ParlamentarSeguidoDto(
            s.PessoaId, s.NomeExibicao, s.Ultimo?.Casa,
            s.Ultimo?.PartidoNoVoto ?? "", s.Ultimo?.UfNoVoto ?? "", s.UrlFoto)));
    }

    /// <summary>"O que mudou" sobre quem a pessoa segue (Pendência 63). Sem cache e sem log de nome: lê a tabela <c>segue</c>.</summary>
    private static async Task<IResult> NovidadesAsync(
        DateOnly? desde, ClaimsPrincipal principal, ServicoNovidades servico, CancellationToken ct) =>
        Results.Ok(await servico.ObterAsync(SessaoDoUsuario.IdDoUsuario(principal), desde, ct));

    /// <summary> PUT e não POST: seguir duas vezes tem de ser o mesmo que seguir uma.</summary>
    /// <summary>
    /// Decisão do autor (2026-10-02): seguir é acompanhar quem está no poder. Com o
    /// histórico na base, a lista e a busca trazem milhares de ex-parlamentares, e seguir
    /// alguém de 2005 guardaria dado sensível (LGPD art. 5º, II) sem nada a acompanhar.
    /// </summary>
    /// <remarks>
    /// <para>"Em exercício" é estar na lista oficial da casa (<c>em_exercicio</c>, decisão do autor de 2026-10-18); sem a lista carregada, ter votado na legislatura corrente. Quem deixa o mandato sai da lista de seguidos pelo worker, com aviso no site.</para>
    /// </remarks>
    private static async Task<bool> EmExercicioAsync(PoligraphDb db, long idPessoa, CancellationToken ct)
    {
        if (await EmExercicioNaBase.IdsAsync(db, ct) is { } ids)
        {
            return ids.Contains(idPessoa);
        }

        var corrente = await Legislaturas.CorrenteAsync(db, ct);
        return await db.Votos.AnyAsync(v => v.PessoaId == idPessoa && v.Votacao!.Legislatura == corrente, ct);
    }

    /// <summary>
    /// Segue, se houver consentimento vivo para a versão do texto que a tela mostra.
    /// </summary>
    /// <remarks>
    /// <para>Pendência 62 (2026-10-03): a política diz que o consentimento é dado ao seguir, e nada o gravava. Sem consentimento vivo, ou com um de outra versão do texto, a resposta é 428 e a tela pergunta; a pessoa aceitando, a mesma chamada volta com <c>aceite=true</c> e o consentimento é gravado com a versão.</para>
    /// </remarks>
    /// <param name="versao">A versão do texto de consentimento que a tela mostra (<c>VERSAO_CONSENTIMENTO</c> do front).</param>
    /// <param name="aceite">Verdadeiro só depois de a pessoa aceitar o texto daquela versão.</param>
    private static async Task<IResult> SeguirAsync(
        long idPessoa, string? versao, bool? aceite, ClaimsPrincipal principal, PoligraphDb db,
        ServicoConsentimentos consentimentos, ServicoAvisos avisos, CancellationToken ct)
    {
        if (!await db.Pessoas.AnyAsync(p => p.Id == idPessoa, ct))
        {
            return Results.NotFound();
        }

        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);

        if (await db.Segue.AnyAsync(s => s.UsuarioId == idUsuario && s.PessoaId == idPessoa, ct))
        {
            return Results.NoContent();
        }

        if (!await EmExercicioAsync(db, idPessoa, ct))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status422UnprocessableEntity,
                title: MensagensDaApi.SoSegueQuemEstaEmExercicio,
                detail: MensagensDaApi.SoSegueQuemEstaEmExercicioDetalhe);
        }

        if (!await consentimentos.EmDiaAsync(idUsuario, TipoFinalidadeDeConsentimento.SEGUIR_PARLAMENTARES, versao, aceite == true, ct))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                title: MensagensDaApi.FaltaConsentimentoParaSeguir,
                detail: MensagensDaApi.FaltaConsentimentoParaSeguirDetalhe);
        }

        await db.EmTransacaoAsync(async c =>
        {
            db.Segue.Add(new SegueModel { UsuarioId = idUsuario, PessoaId = idPessoa });
            await db.SaveChangesAsync(c);
            await avisos.MarcarParlamentarComoVistoAsync(idUsuario, idPessoa, c);
        }, ct);

        return Results.NoContent();
    }

    /// <summary>
    /// Exclusão FÍSICA, e de propósito.
    ///
    /// `segue` é **registro de convicção política** — dado sensível pela LGPD
    /// art. 5º, II. "Deixar de seguir" com exclusão lógica manteria no banco a
    /// informação de que a pessoa seguiu aquele parlamentar, que é exatamente o que ela
    /// pediu para desfazer. Ver a nota em `ExcluirContaAsync`. Pelo mesmo motivo saem os avisos
    /// já enviados sobre o parlamentar (Pendência 89).
    /// </summary>
    private static async Task<IResult> DeixarDeSeguirAsync(
        long idPessoa, ClaimsPrincipal principal, PoligraphDb db, ServicoAvisos avisos, CancellationToken ct)
    {
        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);

        await db.EmTransacaoAsync(async c =>
        {
            await db.Segue
                .Where(s => s.UsuarioId == idUsuario && s.PessoaId == idPessoa)
                .ExecuteDeleteAsync(c);
            await avisos.EsquecerParlamentarAsync(idUsuario, idPessoa, c);
        }, ct);

        return Results.NoContent();
    }

    /// <summary>Até quantos dias depois da posse a saída conta como virada de legislatura.</summary>
    public const int DiasDaVirada = 120;

    /// <summary>
    /// Quem saiu da lista de seguidos por ter deixado o mandato, para o aviso do site (decisão do autor, 2026-10-18).
    /// </summary>
    /// <remarks>
    /// <para>A legislatura nova vai junto quando a saída caiu nos primeiros 120 dias dela: o aviso diz "começou a 58ª legislatura". Fora disso, a saída foi renúncia, cassação ou licença, e o aviso diz só que a pessoa deixou o mandato.</para>
    /// </remarks>
    private static async Task<IResult> EncerradosAsync(ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);
        var encerrados = await db.SeguidosEncerrados.AsNoTracking()
            .Where(e => e.UsuarioId == idUsuario)
            .Join(db.Pessoas, e => e.PessoaId, p => p.Id, (e, p) => new { e.PessoaId, p.NomeExibicao, e.EncerradoEm })
            .OrderBy(e => e.NomeExibicao)
            .ToListAsync(ct);

        short? nova = null;
        if (encerrados.Count > 0 && await Legislaturas.CorrenteAsync(db, ct) is { } corrente)
        {
            var posse = new DateTimeOffset(Legislaturas.AnoInicial(corrente), 2, 1, 0, 0, 0, TimeSpan.Zero);
            if (encerrados.Any(e => e.EncerradoEm >= posse && e.EncerradoEm < posse.AddDays(DiasDaVirada)))
            {
                nova = corrente;
            }
        }

        return Results.Ok(new SeguidosEncerradosDto(nova, [.. encerrados.Select(e => new SeguidoEncerradoDto(e.PessoaId, e.NomeExibicao))]));
    }

    /// <summary>A pessoa viu o aviso: o registro de quem ela seguia sai, por exclusão física.</summary>
    private static async Task<IResult> DispensarEncerradosAsync(ClaimsPrincipal principal, PoligraphDb db, CancellationToken ct)
    {
        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);
        await db.SeguidosEncerrados.Where(e => e.UsuarioId == idUsuario).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }

    /// <summary>
    /// Revoga o consentimento de seguir (LGPD art. 8º, §5º) e apaga a lista, que dependia dele.
    /// </summary>
    /// <remarks>
    /// <para>O consentimento fica com <c>revogado_em</c>, como prova de que existiu e de quando acabou. A lista sai por exclusão física, como em <c>DeixarDeSeguirAsync</c>, e com ela os navegadores inscritos e os avisos enviados: sem ninguém seguido, não há o que avisar.</para>
    /// </remarks>
    private static async Task<IResult> RevogarConsentimentoAsync(
        ClaimsPrincipal principal, PoligraphDb db, ServicoConsentimentos consentimentos, ServicoAvisos avisos, CancellationToken ct)
    {
        var idUsuario = SessaoDoUsuario.IdDoUsuario(principal);

        await db.EmTransacaoAsync(async c =>
        {
            await db.Segue.Where(s => s.UsuarioId == idUsuario).ExecuteDeleteAsync(c);
            await db.SeguidosEncerrados.Where(e => e.UsuarioId == idUsuario).ExecuteDeleteAsync(c);
            await avisos.ApagarTudoAsync(idUsuario, c);
            await consentimentos.RevogarAsync(idUsuario, TipoFinalidadeDeConsentimento.SEGUIR_PARLAMENTARES, c);
        }, ct);

        return Results.NoContent();
    }
}
