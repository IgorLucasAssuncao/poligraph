using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Endpoints;


/// <summary>
/// RF-33 — os números da base, para a página inicial.
///
/// <para>
/// ⭐ Existe porque a alternativa era pedir <c>/api/grafo</c> só para contar: são
/// alguns MB de nós e arestas por casa, transferidos e descartados. Aqui são sete
/// inteiros.
/// </para>
///
/// <para>
/// 🔴 Público, e é decisão de método: todo número aqui vem do registro nominal
/// publicado. ⛔ Nada depende de quem está olhando, e por isso ⛔ não há nada a
/// proteger — nem a vazar.
/// </para>
/// </summary>
public static class EndpointsPanorama
{
    public static IEndpointRouteBuilder MapearPanorama(this IEndpointRouteBuilder app)
    {
        // 🔴 CT3 — `.Produces<T>()` ⛔ não é enfeite de documentação.
        //
        //    O handler devolve `Task<IResult>`, e daí o ASP.NET ⛔ não infere NADA:
        //    o OpenAPI saía com a rota e **zero** esquema de resposta. O `/scalar`
        //    listava os endpoints sem dizer o que devolvem, e o teste de contrato
        //    ⛔ não tinha o que conferir.
        //
        // ⚠️ Metadado PODE divergir do retorno real — por isso ele ⛔ não anda
        //    sozinho: `TestesContratoOpenApi` confere os campos contra o que o front
        //    lê, e os testes de integração desserializam a resposta de verdade.
        app.MapGet("/api/panorama", ObterAsync)
           .WithTags("Panorama")
           .Produces<PanoramaDto>();

        return app;
    }

    // ═══════════════════════════════════════════════════════════════

    private static async Task<IResult> ObterAsync(PoligraphDb db, CancellationToken ct)
    {
        var legislatura = await Legislaturas.CorrenteAsync(db, ct);

        // ⭐ Base vazia devolve panorama vazio, ⛔ não erro: é o estado do primeiro dia,
        //    e a tela tem um texto próprio para ele.
        if (legislatura is null)
            return Results.Ok(new PanoramaDto(null, 0, []));

        var perguntas = await db.Perguntas.AsNoTracking().CountAsync(p => p.Ativa, ct);

        var porCasa = new List<PanoramaDaCasaDto>();
        foreach (var casa in (Casa[])[Casa.CAMARA, Casa.SENADO])
            porCasa.Add(await DaCasaAsync(db, casa, legislatura.Value, ct));

        // Casa sem nenhuma votação ingerida fica fora — a tela ⛔ não deve anunciar
        // uma casa que ainda não entrou na base.
        return Results.Ok(new PanoramaDto(
            legislatura, perguntas, [.. porCasa.Where(c => c.Votacoes > 0)]));
    }

    private static async Task<PanoramaDaCasaDto> DaCasaAsync(
        PoligraphDb db, Casa casa, short legislatura, CancellationToken ct)
    {
        var votacoes = db.Votacoes.AsNoTracking()
            .Where(v => v.Casa == casa && v.Legislatura == legislatura);

        var votos = db.Votos.AsNoTracking()
            .Where(v => v.Votacao!.Casa == casa && v.Votacao.Legislatura == legislatura);

        var execucao = await db.Execucoes.AsNoTracking()
            .Where(e => e.Casa == casa
                     && e.Legislatura == legislatura
                     && e.Status == StatusDaExecucao.CONCLUIDA)
            .OrderByDescending(e => e.Id)
            .Select(e => (long?)e.Id)
            .FirstOrDefaultAsync(ct);

        return new PanoramaDaCasaDto(
            casa,
            // ⚠️ Quem VOTOU, e não quem está cadastrado: o cadastro traz 7.889 nomes de
            //    todas as legislaturas, e anunciar isso como "deputados" seria falso.
            Parlamentares: await votos.Select(v => v.PessoaId).Distinct().CountAsync(ct),
            Votacoes: await votacoes.CountAsync(ct),
            // 🔴 O sigilo do Senado é achado do trabalho, não detalhe — a tela mostra.
            VotacoesSecretas: await votacoes.CountAsync(v => v.Secreta, ct),
            // 🔴 `== 1 || == -1`, ⛔ não `!= null`: abstenção ⛔ não é posição.
            VotosComPosicao: await votos.CountAsync(v => v.Valor == 1 || v.Valor == -1, ct),
            Comunidades: execucao is null
                ? 0
                : await db.NosMetrica.AsNoTracking()
                    .Where(n => n.ExecucaoId == execucao && n.Comunidade != null)
                    .Select(n => n.Comunidade)
                    .Distinct()
                    .CountAsync(ct),
            Ligacoes: execucao is null
                ? 0
                : await db.ArestasGrafo.AsNoTracking()
                    .CountAsync(a => a.ExecucaoId == execucao
                                  && a.Tipo == TipoDeAresta.SIMILARIDADE_VOTO, ct));
    }
}
