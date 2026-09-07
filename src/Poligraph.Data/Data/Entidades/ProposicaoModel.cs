namespace Poligraph.Data;

public class ProposicaoModel
{
    /// <summary>
    /// 🔴 A casa faz parte da CHAVE, ⛔ não é atributo.
    ///
    /// <para>
    /// <c>Id</c> é o identificador da proposição <b>na fonte</b>, e as duas fontes
    /// numeram no mesmo espaço. 📐 Medido em 2026-08-29: a Câmara vai de <b>106.701</b>
    /// a 2.638.483 e o Senado de <b>121.883</b> a 175.446 — as faixas se sobrepõem, e
    /// 3 proposições da Câmara já estão dentro da faixa do Senado.
    /// </para>
    ///
    /// <para>
    /// ⛔ Uma colisão ⛔ não daria erro: vincularia a votação do Senado à ementa de um
    /// projeto da Câmara, e a ficha exibiria um assunto <b>plausível e errado</b>.
    /// </para>
    ///
    /// <para>
    /// ⭐ ⛔ Não foi preciso coluna nova em <c>votacoes</c>: a chave estrangeira usa a
    /// <c>Casa</c> que a votação já tem, e que já carrega o valor certo.
    /// </para>
    /// </summary>
    public Casa Casa { get; set; }

    public long Id { get; set; }
    public string? SiglaTipo { get; set; }
    public int? Numero { get; set; }
    public short? Ano { get; set; }
    public string? Ementa { get; set; }
    public string? UrlInteiroTeor { get; set; }
}
