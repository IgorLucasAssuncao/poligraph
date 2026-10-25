namespace Poligraph.Api.Constantes;

/// <summary>
/// Os textos como as fontes oficiais os escrevem e que o código compara: natureza jurídica da
/// Receita, tipo de emenda e categoria de receita do Portal, partido da Câmara.
/// </summary>
/// <remarks>
/// <para>Não são texto de tela: são o vocabulário do dado. Mudou na fonte, muda aqui, num lugar só.</para>
/// </remarks>
public static class VocabularioDasFontes
{
    /// <summary>A natureza jurídica do município no cadastro da Receita.</summary>
    public const string Municipio = "Município";

    /// <summary>O sufixo das naturezas da administração municipal ("Autarquia Municipal").</summary>
    public const string SufixoMunicipal = "Municipal";

    /// <summary>A palavra das naturezas da administração estadual ("Autarquia Estadual").</summary>
    public const string PalavraEstadual = "Estadual";

    public const string EstadoOuDistritoFederal = "Estado ou Distrito Federal";

    public const string ConsorcioPublico = "Consórcio Público";

    /// <summary>
    /// As naturezas da administração municipal: nelas a sede é a própria cidade.
    /// </summary>
    /// <remarks>
    /// <para>MEDIDO: em 2023–2026, as duas primeiras depois de "Município" somam 74,9% do pago a pessoa jurídica; as outras, R$ 31 mi.</para>
    /// </remarks>
    public static readonly IReadOnlyList<string> NaturezasDaCidade =
    [
        Municipio,
        "Fundo Público da Administração Direta Municipal",
        "Órgão Público do Poder Executivo Municipal",
        "Autarquia Municipal",
        "Fundação Pública de Direito Público Municipal",
        "Fundação Pública de Direito Privado Municipal",
    ];

    /// <summary>
    /// As naturezas do governo do estado: a sede é a capital, e o dinheiro não é da cidade.
    /// </summary>
    /// <remarks>
    /// <para>MEDIDO em 2026-10-22, base inteira: R$ 18,5 bi pagos a elas, a maior parte em fundo (R$ 7,2 bi), órgão (R$ 5,7 bi) e o próprio estado (R$ 4,4 bi). No Rio de Janeiro capital, R$ 221 mi, que a página da cidade somava às entidades com sede ali.</para>
    /// <para>Por igualdade exata: os nomes são os da Receita, como em <see cref="NaturezasDaCidade"/>.</para>
    /// </remarks>
    public static readonly IReadOnlyList<string> NaturezasDoEstado =
    [
        EstadoOuDistritoFederal,
        "Fundo Público da Administração Direta Estadual ou do Distrito Federal",
        "Órgão Público do Poder Executivo Estadual ou do Distrito Federal",
        "Autarquia Estadual ou do Distrito Federal",
        "Fundação Pública de Direito Público Estadual ou do Distrito Federal",
        "Fundação Pública de Direito Privado Estadual ou do Distrito Federal",
        "Órgão Público Autônomo Estadual ou do Distrito Federal",
        "Órgão Público do Poder Judiciário Estadual",
        "Órgão Público do Poder Legislativo Estadual ou do Distrito Federal",
    ];

    /// <summary>O começo das naturezas sem fins lucrativos.</summary>
    public static readonly IReadOnlyList<string> InicioSemFinsLucrativos =
    [
        "Associação Privada",
        "Fundação Privada",
        "Organização Social",
        "Organização Religiosa",
        "Serviço Social Autônomo",
        "Entidade Sindical",
        "Cooperativa",
    ];

    /// <summary>O começo das naturezas de empresa.</summary>
    public static readonly IReadOnlyList<string> InicioDeEmpresa =
    [
        "Sociedade",
        "Empresa",
        "Consórcio de Sociedades",
        "Estabelecimento, no Brasil, de Sociedade",
    ];

    /// <summary>O começo do tipo da emenda individual no Portal ("Emenda Individual - Transferências...").</summary>
    public const string EmendaIndividual = "Emenda Individual";

    /// <summary>A palavra do tipo da emenda de bancada.</summary>
    public const string PalavraBancada = "Bancada";

    /// <summary>O começo da palavra do tipo da emenda de comissão ("Comissão", "Comissao").</summary>
    public const string InicioComissao = "Comiss";

    public const string ReceitasCorrentes = "Receitas Correntes";
    public const string ReceitasDeCapital = "Receitas de Capital";
    public const string OperacoesDeCredito = "Operações de Crédito";

    /// <summary>O partido que a Câmara grava quando não há registro do partido no voto.</summary>
    public const string PartidoSemRegistro = "Sem registro";
}
