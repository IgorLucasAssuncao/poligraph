using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// De onde veio um número da tela e como ele foi contado: o que o modo análise mostra (Pendência 73).
/// </summary>
/// <param name="Regra">A conta em português, com o recorte: casa, legislatura, ano ou eleição.</param>
/// <param name="Linhas">As linhas do banco que entraram no recorte.</param>
/// <param name="LinhasSemCarga">As que foram gravadas antes da Pendência 72 e não sabem de que arquivo vieram. A tela diz quantas são, em vez de esconder.</param>
/// <param name="Cargas">Os arquivos de onde as outras saíram, o de mais linhas primeiro.</param>
/// <param name="Lista">As linhas, uma a uma, quando são poucas (até <c>ServicoProcedencia.LimiteDaLista</c>); nulo acima disso ou no contexto que não lista.</param>
public record ProcedenciaDto(
    string Regra,
    int Linhas,
    int LinhasSemCarga,
    IReadOnlyList<CargaDto> Cargas,
    IReadOnlyList<LinhaDaProcedenciaDto>? Lista);

/// <summary>Uma linha do banco que entrou no número: o que é, um detalhe, a data e o valor, quando há.</summary>
/// <param name="Url">O documento na fonte, quando a fonte o publica (a nota fiscal da cota).</param>
public record LinhaDaProcedenciaDto(string Descricao, string? Detalhe, DateOnly? Data, decimal? Valor, string? Url);

/// <summary>Um arquivo baixado de fonte oficial, com a impressão digital do que veio.</summary>
/// <param name="Orgao">O órgão que publica, por extenso.</param>
/// <param name="BaseLegal">A norma que obriga o órgão a publicar o dado.</param>
/// <param name="Versao">A versão da ETL que leu o arquivo: o hash dos fontes dela. Nula nas cargas anteriores à Pendência 73.</param>
/// <param name="Linhas">Quantas linhas do recorte saíram deste arquivo.</param>
public record CargaDto(
    long Id,
    TipoFonteDeCarga Fonte,
    string Orgao,
    string BaseLegal,
    string Url,
    DateTimeOffset BaixadoEm,
    string Sha256,
    long Bytes,
    string? EtagDaFonte,
    DateTimeOffset? ModificadoNaFonte,
    string Comando,
    string? Versao,
    int Linhas);
