namespace Poligraph.Data;

/// <summary>
/// Um arquivo ou resposta baixada de uma fonte oficial, com a impressão digital do que veio
/// (PL72, plano/10).
///
/// <para>
/// É o que permite afirmar "este número é idêntico ao arquivo da Câmara baixado em tal
/// data": cada linha de dado de fonte aponta para a carga de onde saiu, por
/// <c>carga_id</c>.
/// </para>
///
/// <para>
/// ATENÇÃO: o <see cref="Sha256"/> é calculado pelo ETL, sobre os bytes como chegaram. O
/// TSE tem o campo de hash no catálogo e o deixa vazio; a Câmara publica só
/// <c>ETag</c> e <c>Last-Modified</c>, e regenera os arquivos toda madrugada. O hash
/// prova que a cópia guardada não mudou depois do download; o <see cref="EtagDaFonte"/> e o
/// <see cref="ModificadoNaFonte"/> são a identificação que o próprio órgão deu à versão.
/// </para>
/// </summary>
public class CargaModel
{
    public long Id { get; set; }

    public TipoFonteDeCarga Fonte { get; set; }

    /// <summary>O endereço exato pedido, com os parâmetros.</summary>
    public required string Url { get; set; }

    public DateTimeOffset BaixadoEm { get; set; }

    /// <summary>SHA-256 em hexadecimal minúsculo, dos bytes como chegaram.</summary>
    public required string Sha256 { get; set; }

    public long Bytes { get; set; }

    /// <summary>O <c>ETag</c> que o servidor da fonte devolveu. Nulo quando ele não manda.</summary>
    public string? EtagDaFonte { get; set; }

    /// <summary>O <c>Last-Modified</c> da fonte: quando o órgão gerou aquela versão.</summary>
    public DateTimeOffset? ModificadoNaFonte { get; set; }

    /// <summary>O comando do ETL que baixou, com os argumentos.</summary>
    public required string Comando { get; set; }

    /// <summary>
    /// A versão do código que leu o arquivo: <c>etl-</c> e os 12 primeiros dígitos do SHA-256
    /// dos fontes da ETL (PL73). Nula nas cargas gravadas antes dela.
    /// </summary>
    /// <remarks>
    /// <para>A imagem da ETL não leva o repositório, então não há commit para ler. O hash dos fontes identifica o parser exato, e muda a cada mudança de código.</para>
    /// </remarks>
    public string? Versao { get; set; }
}
