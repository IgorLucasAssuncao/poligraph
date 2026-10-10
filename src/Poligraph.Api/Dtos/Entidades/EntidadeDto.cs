using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>Uma pessoa jurídica que recebeu dinheiro de emenda, na lista e na busca.</summary>
/// <remarks>
/// <para>
/// O CNPJ sai aqui, e só aqui: é a chave da página da entidade e dado público de pessoa
/// jurídica. Empresário individual não entra na lista — o CNPJ dele é de uma pessoa (ver
/// <c>ServicoEntidades</c>).
/// </para>
/// </remarks>
public record EntidadeNaListaDto(
    string Cnpj,
    string Nome,
    string? NaturezaJuridica,
    GrupoDeEntidade Grupo,
    MunicipioDto? Sede,
    decimal Recebido,
    int Emendas);

/// <summary>
/// Os grupos em que a pessoa reconhece quem recebeu, no lugar das 35 naturezas jurídicas
/// da Receita.
/// </summary>
public enum GrupoDeEntidade
{
    /// <summary>Prefeitura, fundo municipal e demais órgãos do município.</summary>
    MUNICIPIO,

    /// <summary>Governo estadual ou do DF, e os órgãos e fundos dele.</summary>
    ESTADO,

    /// <summary>Associação, fundação privada, organização social, religiosa, sindicato, cooperativa.</summary>
    SEM_FINS_LUCRATIVOS,

    /// <summary>Sociedade empresária, privada ou estatal.</summary>
    EMPRESA,

    /// <summary>Consórcio público, organismo internacional e o que não cabe nos outros.</summary>
    OUTRO,
}

/// <summary>A página de uma entidade: quanto recebeu de emenda, de quem, e se aparece na cota.</summary>
/// <remarks>
/// <para>Todos os anos carregados, com a divisão por ano ao lado. O ano é o da emenda.</para>
/// <para><see cref="Sancoes"/> são as do CEIS e do CNEP no retrato mais recente; <see cref="ComOGoverno"/>, os contratos com o Executivo federal. Nulo ou vazio quando não há.</para>
/// </remarks>
public record EntidadeDto(
    string Cnpj,
    string Nome,
    string? NaturezaJuridica,
    GrupoDeEntidade Grupo,
    MunicipioDto? Sede,
    string UrlFonte,
    decimal Recebido,
    int Emendas,
    IReadOnlyList<RecebidoNoAnoDto> PorAno,
    decimal DeParlamentares,
    PaginaDto<ParlamentarQueMandouDto> Parlamentares,
    IReadOnlyList<ColetivoQueMandouDto> Coletivos,
    CotaDaEntidadeDto? NaCota,
    PaginaDto<ConvenioDaEntidadeDto> Convenios,
    IReadOnlyList<SancaoDaEntidadeDto> Sancoes,
    ContratosComOGovernoDto? ComOGoverno);

/// <summary>Uma sanção do CEIS ou do CNEP à entidade. <see cref="Vigente"/> compara o fim com a data de hoje.</summary>
public record SancaoDaEntidadeDto(
    string Cadastro, string Categoria, DateOnly? Inicio, DateOnly? Fim, bool Vigente, string OrgaoSancionador,
    string? Esfera, string? FundamentacaoLegal, decimal? ValorDaMulta);

/// <summary>Os contratos da entidade com o Executivo federal, somando os anos carregados.</summary>
public record ContratosComOGovernoDto(int Contratos, decimal Valor, int PrimeiroAno, int UltimoAno);

/// <summary>
/// Um convênio que a entidade assinou com dinheiro de emenda: o que foi combinado e quanto já saiu.
/// </summary>
/// <remarks>
/// <para>Ligado pelo CNPJ do convenente, do arquivo completo de convênios — não pelo nome, que o de emendas traz escrito de vários jeitos.</para>
/// </remarks>
public record ConvenioDaEntidadeDto(
    string Numero,
    string? Objeto,
    string? Situacao,
    DateOnly DataPublicacao,
    decimal Valor,
    decimal? ValorLiberado,
    string UrlFonte);

public record RecebidoNoAnoDto(int AnoDaEmenda, decimal Recebido);

/// <summary>
/// O que parlamentares pagaram a esta mesma pessoa jurídica com a cota, pelo CNPJ.
/// </summary>
/// <remarks>
/// <para>
/// ATENÇÃO: Aparecer nas duas listas não é indício de nada: a cota paga despesas do escritório à
/// própria prefeitura, e a emenda vai para a mesma prefeitura. A tela diz isso ao lado (RNF-16).
/// </para>
/// </remarks>
public record CotaDaEntidadeDto(decimal Total, int Lancamentos, IReadOnlyList<ParlamentarNaCotaDto> PorParlamentar);

public record ParlamentarNaCotaDto(long IdPessoa, string Nome, string? Partido, TipoCasa? Casa, decimal Total, int Lancamentos);

/// <summary>A busca do cabeçalho: um nome, três tipos de resposta.</summary>
/// <param name="LegislaturaCorrente">Quem tem outra legislatura já saiu, e a tela diz de quando era.</param>
public record BuscaDto(
    IReadOnlyList<ParlamentarNaListaDto> Parlamentares,
    IReadOnlyList<MunicipioDto> Municipios,
    IReadOnlyList<EntidadeNaListaDto> Entidades,
    short? LegislaturaCorrente = null);
