namespace Poligraph.Api.Dtos;

/// <summary>
/// Quem mandou dinheiro de emenda para uma cidade, e quem o recebeu lá.
/// </summary>
/// <remarks>
/// <para>
/// A emenda tem três autores possíveis (CF, art. 166): o parlamentar, sozinho; a bancada
/// do estado, junta; e uma comissão. Só o primeiro é pessoa — por isso os coletivos vêm em
/// lista própria, e não misturados aos deputados e senadores.
/// </para>
/// <para>
/// <see cref="NaPropriaCidade"/> é o que foi à prefeitura ou a órgão municipal: nesses
/// casos a sede é a cidade. O resto foi a entidades com sede nela, que podem ter aplicado o
/// dinheiro em outro lugar.
/// </para>
/// <para><see cref="NoGovernoDoEstado"/> é o que foi a órgão do governo do estado com sede aqui, a capital: separado
/// das entidades, porque não é dinheiro da cidade (2026-10-22).</para>
/// <para>As listas longas vêm na primeira página; o resto, pelos endpoints de página.</para>
/// </remarks>
public record EmendasDoMunicipioDto(
    MunicipioDto Municipio,
    PeriodoDto Periodo,
    IReadOnlyList<int> AnosDisponiveis,
    decimal Recebido,
    decimal NaPropriaCidade,
    decimal DeParlamentares,
    PaginaDto<ParlamentarQueMandouDto> Parlamentares,
    IReadOnlyList<ColetivoQueMandouDto> Coletivos,
    PaginaDto<FavorecidoDaEmendaDto> Favorecidos,
    ConveniosDaCidadeDto Convenios,
    decimal NoGovernoDoEstado = 0);

/// <summary>
/// Os convênios assinados por quem tem sede na cidade, com dinheiro das emendas do período.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="ALiberar"/> soma só os convênios em execução: nos outros a execução acabou, e a
/// diferença entre o combinado e o liberado não é dinheiro que ainda vai chegar.
/// </para>
/// <para>A cidade é a da sede do convenente, pelo CNPJ — a mesma regra do mapa.</para>
/// </remarks>
public record ConveniosDaCidadeDto(
    int Quantidade,
    int EmExecucao,
    decimal Combinado,
    decimal Liberado,
    decimal ALiberar,
    PaginaDto<ConvenioDaCidadeDto> Lista);

/// <summary>Um convênio da cidade: o que foi combinado, com quem, e quanto já saiu.</summary>
public record ConvenioDaCidadeDto(
    string Numero,
    string? Objeto,
    string Convenente,
    string Cnpj,
    string? Situacao,
    DateOnly DataPublicacao,
    decimal Valor,
    decimal? ValorLiberado,
    string UrlFonte);
