namespace Poligraph.Data;

/// <summary>
/// Uma rede social que o próprio parlamentar publicou — à Câmara ou ao TSE, na candidatura.
/// </summary>
/// <remarks>
/// <para>
/// Deputado: a Câmara, que mantém a lista atual. Senador: o TSE, a da última candidatura,
/// porque o Senado não publica rede nenhuma. A ligação é por chave forte — o id da Câmara, ou
/// o código da candidatura até o CPF.
/// </para>
/// <para>RISCO: Só <c>http(s)</c>: é endereço que a tela vira link, e outro esquema seria porta para script.</para>
/// </remarks>
public class RedeSocialModel
{
    public long PessoaId { get; set; }

    public required string Url { get; set; }

    public TipoRedeSocial Rede { get; set; }

    public FonteDaRedeSocial Fonte { get; set; }

    /// <summary>O arquivo da Câmara ou do TSE de onde a rede veio.</summary>
    public long? CargaId { get; set; }
}

public enum TipoRedeSocial
{
    INSTAGRAM,
    FACEBOOK,
    X,
    YOUTUBE,
    TIKTOK,
    LINKEDIN,
    OUTRA,
}

public enum FonteDaRedeSocial
{
    CAMARA,
    TSE,
}
