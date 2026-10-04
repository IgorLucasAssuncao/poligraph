using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>Um deputado ou senador que mandou dinheiro de emenda — para uma cidade ou uma entidade.</summary>
/// <remarks>
/// <para><see cref="IdPessoa"/> é nulo quando o código do autor ainda não foi ligado a um parlamentar: o nome vem da emenda, e a tela não tem ficha para onde levar.</para>
/// </remarks>
public record ParlamentarQueMandouDto(
    long? IdPessoa,
    string Nome,
    string? Partido,
    string? Uf,
    TipoCasa? Casa,
    string? UrlFoto,
    decimal Recebido,
    int Emendas);

/// <summary>Uma bancada estadual ou comissão que mandou dinheiro de emenda.</summary>
public record ColetivoQueMandouDto(TipoAutorColetivo Tipo, string Nome, decimal Recebido, int Emendas);

/// <summary>O autor de emenda que não é uma pessoa.</summary>
public enum TipoAutorColetivo
{
    /// <summary>Os deputados e senadores de um estado, juntos (CF, art. 166, § 12).</summary>
    BANCADA,

    /// <summary>Uma comissão permanente da Câmara, do Senado ou mista.</summary>
    COMISSAO,

    /// <summary>Outro autor coletivo, como o relator-geral do orçamento, que existiu até 2022.</summary>
    OUTRO,
}
