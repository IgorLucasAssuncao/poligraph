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
    /// votos, cota, emendas, campanha, patrimonio (com <c>pessoa</c>), painel (com <c>casa</c>), pagamentos
    /// (com <c>de</c> e <c>ate</c>; com <c>uf</c> ou <c>municipio</c>, só o que chegou a quem tem sede ali), entidade
    /// (com <c>cnpj</c>) e os do governo (com <c>de</c> e <c>ate</c>). Em <c>cota</c>, <c>categoria</c> restringe a uma categoria de despesa.
    /// </summary>
    /// <remarks>
    /// <para>Cada parâmetro tem tipo próprio e valida o formato ao ser lido: contexto desconhecido, CNPJ fora de 14 dígitos ou UF que não existe respondem 400. Falta de parâmetro que o contexto pede responde 404.</para>
    /// </remarks>
    private static async Task<IResult> ObterAsync(
        ContextoDeProcedencia contexto, ServicoProcedencia servico, CancellationToken ct,
        PessoaId? pessoa = null, Legislatura? legislatura = null, Ano? ano = null, TipoCasa? casa = null,
        Ano? de = null, Ano? ate = null, Cnpj? cnpj = null, CategoriaDeDespesa? categoria = null,
        Uf? uf = null, CodigoIbge? municipio = null)
    {
        var consulta = new ConsultaDeProcedencia(
            contexto, pessoa, legislatura, ano, casa, Periodo.Dos(de, ate), cnpj, categoria, uf, municipio);

        return await servico.ObterAsync(consulta, ct) is { } procedencia
            ? Results.Ok(procedencia)
            : Results.Problem(TextosDaProcedencia.ContextoSemParametro, statusCode: StatusCodes.Status404NotFound);
    }
}
