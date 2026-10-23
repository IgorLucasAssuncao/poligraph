namespace Poligraph.Api.Dtos;

/// <summary>
/// O pago em emendas no período, dividido pelos caminhos que o dinheiro fez: o tipo da emenda, a área e quem recebeu.
/// </summary>
/// <remarks>
/// <para>A soma dos caminhos é <see cref="Total"/>, o mesmo "pago em emendas" do mapa: o gráfico de fitas fecha com o número do topo da página.</para>
/// </remarks>
public record CaminhosDasEmendasDto(PeriodoDto Periodo, decimal Total, IReadOnlyList<CaminhoDaEmendaDto> Caminhos);

/// <summary>Um caminho: o tipo da emenda e a área (função) como o Portal escreve, o grupo de quem recebeu e o valor pago.</summary>
public record CaminhoDaEmendaDto(string? Tipo, string? Area, GrupoDoRecebedor Recebedor, decimal Valor);

/// <summary>Quem recebeu o pagamento da emenda, em grupos que se leem de longe.</summary>
public enum GrupoDoRecebedor
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

    /// <summary>O banco que repassa a transferência especial (a "emenda Pix"): ele recebe e paga ao ente depois.</summary>
    VIA_BANCO,

    /// <summary>Órgão do próprio governo federal (unidade gestora).</summary>
    ORGAO_FEDERAL,

    /// <summary>Pessoa física, sem o nome na tela.</summary>
    PESSOA,

    /// <summary>O Portal não informa quem recebeu.</summary>
    SEM_INFORMACAO,
}
