namespace Poligraph.Data;

public class ProposicaoModel
{
    /// <summary>
    /// A casa faz parte da CHAVE, não é atributo.
    ///
    /// <para>
    /// <c>Id</c> é o identificador da proposição <b>na fonte</b>, e as duas fontes
    /// numeram no mesmo espaço. Medido em 2026-08-29: a Câmara vai de <b>106.701</b>
    /// a 2.638.483 e o Senado de <b>121.883</b> a 175.446 — as faixas se sobrepõem, e
    /// 3 proposições da Câmara já estão dentro da faixa do Senado.
    /// </para>
    ///
    /// <para>
    /// Uma colisão não daria erro: vincularia a votação do Senado à ementa de um
    /// projeto da Câmara, e a ficha exibiria um assunto <b>plausível e errado</b>.
    /// </para>
    ///
    /// <para>
    /// Não foi preciso coluna nova em <c>votacoes</c>: a chave estrangeira usa a
    /// <c>TipoCasa</c> que a votação já tem, e que já carrega o valor certo.
    /// </para>
    /// </summary>
    public TipoCasa Casa { get; set; }

    public long Id { get; set; }
    public string? SiglaTipo { get; set; }
    public int? Numero { get; set; }
    public short? Ano { get; set; }
    public string? Ementa { get; set; }
    /// <summary>
    /// O texto integral da proposição (o PDF), do arquivo anual de proposições da Câmara. Nulo é "ainda não procurada";
    /// vazio é "procurada, e a casa não publica o texto". O Senado fica nulo: o serviço de textos dele foi trocado em 2026.
    /// </summary>
    public string? UrlInteiroTeor { get; set; }

    /// <summary>
    /// As palavras-chave da casa (Pendência 70): <c>keywords</c> da Câmara, <c>IndexacaoMateria</c> do
    /// Senado. É onde aparece o nome popular: a ementa da PEC 45/2019 diz "Altera o Sistema
    /// Tributário Nacional", e só as palavras-chave dizem "Reforma tributária".
    /// </summary>
    /// <remarks>
    /// <para>Nulo é "ainda não consultada"; vazio é "consultada, e a casa não publica nenhuma". Sem a diferença, a busca de quem falta repetiria as vazias para sempre.</para>
    /// </remarks>
    public string? PalavrasChave { get; set; }

    /// <summary>O arquivo da Câmara ou do Senado que gravou a linha por último.</summary>
    public long? CargaId { get; set; }

    /// <summary>As respostas da API da Câmara de onde vieram as palavras-chave.</summary>
    public long? PalavrasChaveCargaId { get; set; }

    /// <summary>O arquivo de proposições da Câmara de onde veio o endereço do texto integral.</summary>
    public long? UrlInteiroTeorCargaId { get; set; }
}
