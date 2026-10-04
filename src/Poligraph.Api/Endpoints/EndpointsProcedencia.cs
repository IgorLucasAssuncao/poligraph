using Poligraph.Api.Dtos;
using Poligraph.Api.Services;
using Poligraph.Api.Textos;
using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Endpoints;

public static class EndpointsProcedencia
{
    public static IEndpointRouteBuilder MapearProcedencia(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/procedencia/{contexto}", ObterAsync)
           .WithTags("Procedencia")
           .Produces<ProcedenciaDto>()
           .ProducesProblem(StatusCodes.Status400BadRequest)
           .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    /// <summary>
    /// De onde veio um número e como foi contado, para o modo auditoria (Pendência 73). Contextos:
    /// votos, cota, emendas, campanha, patrimonio (com <c>idPessoa</c>), painel (com <c>casa</c>), pagamentos
    /// (com <c>de</c> e <c>ate</c>, anos de emenda; com <c>uf</c> ou <c>municipio</c>, só o que chegou a quem tem sede ali), entidade
    /// (com <c>cnpj</c>) e os do governo (com <c>de</c> e <c>ate</c>, anos do orçamento). Em <c>cota</c>, <c>anoDaDespesa</c> e
    /// <c>categoria</c> restringem; em <c>emendas</c>, <c>anoDaEmenda</c>; em campanha e patrimônio, <c>anoDaEleicao</c>.
    /// </summary>
    /// <remarks>
    /// <para>Cada parâmetro tem tipo próprio e valida o formato ao ser lido: contexto desconhecido, CNPJ fora de 14 dígitos ou UF que não existe respondem 400. Falta de parâmetro que o contexto pede responde 404.</para>
    /// </remarks>
    private static async Task<IResult> ObterAsync(
        ContextoDeProcedencia contexto, ServicoProcedencia servico, CancellationToken ct,
        Periodo<AnoDaEmenda> periodoDasEmendas, Periodo<AnoDoOrcamento> periodoDoOrcamento,
        IdPessoa? idPessoa = null, Legislatura? legislatura = null, AnoDaDespesa? anoDaDespesa = null,
        AnoDaEmenda? anoDaEmenda = null, AnoDaEleicao? anoDaEleicao = null, TipoCasa? casa = null,
        Cnpj? cnpj = null, CategoriaDeDespesa? categoria = null, Uf? uf = null, CodigoIbge? municipio = null)
    {
        var consulta = new ConsultaDeProcedencia(
            contexto, idPessoa, legislatura, anoDaDespesa, anoDaEmenda, anoDaEleicao, casa,
            periodoDasEmendas, periodoDoOrcamento, cnpj, categoria, uf, municipio);

        return await servico.ObterAsync(consulta, ct) is { } procedencia
            ? Results.Ok(procedencia)
            : Results.Problem(TextosDaProcedencia.ContextoSemParametro, statusCode: StatusCodes.Status404NotFound);
    }
}
