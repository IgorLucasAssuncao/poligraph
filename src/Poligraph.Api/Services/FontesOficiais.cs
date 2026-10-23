using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// As páginas oficiais onde cada dado pode ser conferido.
/// </summary>
/// <remarks>
/// <para>
/// Todo endereço de fonte sai daqui, e de nenhum outro lugar: se a Câmara ou o Portal
/// mudarem o formato, a correção é uma linha. Cada formato foi aberto e conferido em
/// 2026-09-25, com resposta 200 e o título da página certa.
/// </para>
/// </remarks>
public static class FontesOficiais
{
    /// <summary>A página do deputado ou do senador na própria casa.</summary>
    public static string? Parlamentar(TipoCasa? casa, string? idPessoaNaCasa) => (casa, idPessoaNaCasa) switch
    {
        (_, null or "") => null,
        (TipoCasa.CAMARA, var idDeputadoNaCamara) => $"https://www.camara.leg.br/deputados/{idDeputadoNaCamara}",
        (TipoCasa.SENADO, var codigoSenadorNoSenado) => $"https://www25.senado.leg.br/web/senadores/senador/-/perfil/{codigoSenadorNoSenado}",
        _ => null,
    };

    /// <summary>A ficha de tramitação da proposição votada.</summary>
    public static string? Proposicao(TipoCasa casa, long? idProposicaoNaCasa) => (casa, idProposicaoNaCasa) switch
    {
        (_, null) => null,
        (TipoCasa.CAMARA, var idProposicaoNaCamara) => $"https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao={idProposicaoNaCamara}",
        (TipoCasa.SENADO, var codigoMateriaNoSenado) => $"https://www25.senado.leg.br/web/atividade/materias/-/materia/{codigoMateriaNoSenado}",
        _ => null,
    };

    /// <summary>
    /// O registro nominal da votação, com o voto de cada deputado, nos dados abertos da Câmara.
    /// </summary>
    /// <remarks>
    /// <para>Só a Câmara: o Senado não publica a votação em endereço estável por identificador.</para>
    /// </remarks>
    public static string? RegistroDaVotacao(TipoCasa casa, string votacaoId) =>
        casa == TipoCasa.CAMARA ? $"https://dadosabertos.camara.leg.br/api/v2/votacoes/{votacaoId}" : null;

    public static string Emenda(string codigoEmenda) =>
        $"https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda={codigoEmenda}";

    public static string Convenio(string numero) =>
        $"https://portaldatransparencia.gov.br/convenios/{numero}";

    /// <summary>A página da pessoa jurídica no Portal da Transparência: tudo o que ela recebeu do governo federal.</summary>
    /// <remarks>
    /// <para>Conferido em 2026-09-25: 200 com o nome da empresa para CNPJ existente, 404 para inexistente. O endereço sem <c>/busca</c> cai no desafio antirrobô do Portal.</para>
    /// </remarks>
    public static string PessoaJuridica(string cnpj) =>
        $"https://portaldatransparencia.gov.br/busca/pessoa-juridica/{cnpj}";

    /// <summary>A Resolução nº 35/2016 do Senado, que encerrou o impeachment de 2016, no LexML.</summary>
    /// <remarks><para>Conferido em 2026-10-23: 200, com o título "Resolução do Senado Federal nº 35 de 31/08/2016".</para></remarks>
    public const string ImpeachmentDe2016 = "https://www.lexml.gov.br/urn/urn:lex:br:senado.federal:resolucao:2016-08-31;35";
}
